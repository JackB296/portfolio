import { expect, test } from "@playwright/test";
import { dispatchGrade, visiblePixelCount, waitForHydration } from "./helpers";
import { tonightsFeatureId } from "../lib/featurePresentation";
import { getGrade } from "../lib/grades";

// Coverage for the uniqueness suite (docs/specs/uniqueness-suite-2026-07-17.md):
// the feature-presentation leader, the Now Showing label, director's
// commentary, the guest terminal, and the playground takeover.

test.describe("feature presentation", () => {
  test("never shows under automation by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-feature-leader]")).toHaveCount(0);
  });

  test("forced leader counts down, applies tonight's grade, marks itself seen", async ({
    page,
  }) => {
    // The pick is date-hashed, so the test can compute the same answer the
    // browser will: the leader must name tonight's film, then apply it.
    const feature = getGrade(tonightsFeatureId());
    if (!feature) throw new Error("tonight's feature has no grade record");

    await page.addInitScript(() => {
      localStorage.setItem("feature-leader-force", "1");
    });
    await page.goto("/");
    const leader = page.locator("[data-feature-leader]");
    await expect(leader).toBeVisible();
    await expect(leader).toContainText(
      `Now showing · ${feature.film} (${feature.year})`
    );
    // The countdown runs ~2.4s, then the fade applies the preview grade.
    await expect(page.locator("html")).toHaveAttribute(
      "data-grade",
      feature.id,
      { timeout: 6_000 }
    );
    // A SILENT commit by design: the film experience runs for the visit, but
    // sound stays off (no gesture asked for audio) and the controls pulse
    // their sound toggle instead.
    await expect(page.locator("[data-film-experience-root]")).toHaveAttribute(
      "data-committed-film",
      feature.id
    );
    await expect(page.locator("[data-film-experience-root]")).toHaveAttribute(
      "data-audio-state",
      "off"
    );
    const soundButton = page.getByRole("button", { name: "sound off" });
    await expect(soundButton).toBeVisible();
    await expect(soundButton).toHaveAttribute("data-sound-nudge", "on");
    await expect(page.locator("[data-feature-leader]")).toHaveCount(0, {
      timeout: 6_000,
    });
    // Transient by design: nothing was committed…
    expect(
      await page.evaluate(() => localStorage.getItem("film-grade"))
    ).toBeNull();
    // …but the leader never replays.
    expect(
      await page.evaluate(() => localStorage.getItem("feature-leader-seen"))
    ).toBe("1");
  });

  test("skip applies the grade immediately", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("feature-leader-force", "1");
    });
    await page.goto("/");
    await expect(page.locator("[data-feature-leader]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-grade", /.+/);
  });

  test("a committed grade suppresses the leader", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("feature-leader-force", "1");
      localStorage.setItem("film-grade", "dune");
    });
    await page.goto("/");
    await expect(page.locator("[data-feature-leader]")).toHaveCount(0);
  });
});

test.describe("now showing label", () => {
  test("the theater button names the active grade", async ({ page }) => {
    await page.goto("/");
    const trigger = page.locator("[data-now-showing]").first();
    await expect(trigger).toHaveAttribute("data-now-showing", "house");
    await expect(trigger).toContainText("Theater");
    await dispatchGrade(page, "matrix", "commit");
    await expect(trigger).toHaveAttribute("data-now-showing", "matrix");
    await expect(trigger).toContainText("The Matrix");
  });
});

test.describe("director's commentary", () => {
  test("toggle pins the track, cards open and close, state persists", async ({
    page,
  }) => {
    await page.goto("/");
    const root = page.locator("[data-commentary]");
    await expect(root).toHaveAttribute("data-commentary", "off");

    await page.getByRole("button", { name: /commentary/i }).click();
    await expect(root).toHaveAttribute("data-commentary", "on");
    await expect(page.locator("[data-commentary-pin]")).toHaveCount(6);

    await page.locator('[data-commentary-pin="top"]').click();
    const card = page.locator('[data-commentary-card="top"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("Reel 01");
    await expect(card).toContainText("icosahedron");
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);

    await page.reload();
    await expect(page.locator("[data-commentary]")).toHaveAttribute(
      "data-commentary",
      "on"
    );
    await expect(page.locator("[data-commentary-pin]")).toHaveCount(6);
  });
});

test.describe("guest terminal", () => {
  test("backquote opens it; theme/play commands act on the real site", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-terminal]")).toHaveAttribute(
      "data-terminal",
      "closed"
    );
    await waitForHydration(page);
    await page.keyboard.press("`");
    const dialog = page.getByRole("dialog", { name: "Guest terminal" });
    await expect(dialog).toBeVisible();

    const input = page.getByLabel("Terminal command");
    await input.fill("theme matrix");
    await input.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-grade", "matrix");
    expect(
      await page.evaluate(() => localStorage.getItem("film-grade"))
    ).toBe("matrix");

    await input.fill("play cloth");
    await input.press("Enter");
    await page.waitForURL("**/cloth");
    await expect(dialog).toHaveCount(0);
  });

  test("tab completion, unknown commands, escape to close", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    await page.keyboard.press("`");
    const input = page.getByLabel("Terminal command");

    await input.fill("who");
    await input.press("Tab");
    await expect(input).toHaveValue("whoami");
    await input.press("Enter");
    await expect(
      page.locator("[data-terminal-output] div").filter({ hasText: /^guest$/ })
    ).toHaveCount(1);

    await input.fill("frobnicate");
    await input.press("Enter");
    await expect(page.locator("[data-terminal-output]")).toContainText(
      "command not found: frobnicate"
    );

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Guest terminal" })
    ).toHaveCount(0);
    await expect(page.locator("[data-terminal]")).toHaveAttribute(
      "data-terminal",
      "closed"
    );
  });

  test("the navbar button opens it", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Open guest terminal" }).click();
    await expect(
      page.getByRole("dialog", { name: "Guest terminal" })
    ).toBeVisible();
  });
});

test.describe("playground takeover", () => {
  test("defaults on with three live layers and defers to film mode", async ({
    page,
  }) => {
    await page.goto("/");
    const pill = page.locator("[data-playground]");
    await expect(pill).toHaveAttribute("data-playground", "on");
    await expect(page.locator("[data-playground-layer]")).toHaveCount(3);

    // The cloth actually draws.
    const cloth = page.locator('[data-playground-layer="cloth"]');
    await cloth.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await visiblePixelCount(cloth)).toBeGreaterThan(10);

    // Film mode takes the stage: layers unmount, pill reports the rule.
    await dispatchGrade(page, "dune", "commit");
    await expect(pill).toHaveAttribute("data-playground", "paused");
    await expect(page.locator("[data-playground-layer]")).toHaveCount(0);

    // House lights back up: the playground resumes.
    await dispatchGrade(page, null, "commit");
    await expect(pill).toHaveAttribute("data-playground", "on");
    await expect(page.locator("[data-playground-layer]")).toHaveCount(3);

    // Opting out sticks across reloads.
    await pill.click();
    await expect(pill).toHaveAttribute("data-playground", "off");
    await expect(page.locator("[data-playground-layer]")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-playground]")).toHaveAttribute(
      "data-playground",
      "off"
    );
  });
});
