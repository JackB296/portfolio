import { expect, test } from "@playwright/test";
import { grades } from "../lib/grades";
import { filmExperiences } from "../lib/filmExperiences";
import { planePosition } from "../components/film-experience/modes/casablanca";

test("film experience registry contract covers every named grade", () => {
  const gradeIds = grades.map((grade) => grade.id).sort();
  const experienceIds = filmExperiences.map((experience) => experience.id).sort();

  expect(experienceIds).toEqual(gradeIds);
  expect(new Set(experienceIds).size).toBe(16);

  for (const experience of filmExperiences) {
    expect(experience.signature.length).toBeGreaterThan(8);
    expect(experience.references.length).toBeGreaterThanOrEqual(5);
    expect(experience.audio.music.mode).toBe("music");
    for (const cue of [experience.audio.music, ...experience.audio.effects]) {
      expect(cue.label.length).toBeGreaterThan(3);
      expect(cue.src).toMatch(/^\/audio\/film-modes\/[a-z0-9-]+\.mp3$/);
      expect(cue.volume).toBeGreaterThan(0);
      expect(cue.volume).toBeLessThanOrEqual(1);
      expect(cue.filterFrequency).toBeGreaterThan(0);
      expect(cue.scrollResponse).toBeGreaterThanOrEqual(0);
      expect(cue.scrollResponse).toBeLessThanOrEqual(1);
      expect(cue.mode).toMatch(/^(loop|event|music)$/);
    }
    expect(experience.visualAssets.every((asset) => asset.src.startsWith("/posters/open/"))).toBe(true);
    expect(experience.tokens.motion).toMatch(/^(dissolve|drift|precision|pulse|stalk|descend|loop|rush|breathe|pantomime|snap|rupture|track|theatrical|terminal)$/);
    expect(typeof experience.loadVisuals).toBe("function");
  }
  expect(new Set(filmExperiences.map((experience) => experience.audio.music.src)).size).toBe(16);
  // After the 2026-07-16 motif overhaul, only these films keep DOM image
  // layers; the rest are fully authored canvas worlds. (2001's Jupiter plate
  // was retired along with its old aperture glow.)
  expect(
    filmExperiences
      .filter(({ visualAssets }) => visualAssets.length > 0)
      .map(({ id }) => id)
      .sort()
  ).toEqual(["arrival", "dune"]);

  const effectFilms = filmExperiences
    .filter(({ audio }) => audio.effects.length > 0)
    .map(({ id }) => id)
    .sort();
  expect(effectFilms).toEqual([
    "blade-runner",
    "casablanca",
    "dune",
    "fight-club",
    "fury-road",
    "goodfellas",
    "matrix",
    "wargames",
  ]);
  expect(filmExperiences.find(({ id }) => id === "matrix")?.audio.effects[0].label).toMatch(/data|number/i);
  expect(filmExperiences.find(({ id }) => id === "wargames")?.audio.effects[0].label).toMatch(/whisper/i);

  // Revved down 2026-07-16: the engine still reacts to scroll, but no longer
  // swells on every gesture.
  const furyScrollResponse = filmExperiences.find(
    (experience) => experience.id === "fury-road"
  )?.audio.effects[0].scrollResponse;
  expect(furyScrollResponse).toBeGreaterThanOrEqual(0.3);
  expect(furyScrollResponse).toBeLessThanOrEqual(0.6);
});

test("every film music and effect cue is a decodable local recording", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const cues = filmExperiences.flatMap(({ id, audio }) => [
    { id, role: "music", src: audio.music.src },
    ...audio.effects.map(({ src }) => ({ id, role: "effect", src })),
  ]);
  const decoded = await page.evaluate(async (sources) => {
    const context = new OfflineAudioContext(2, 1, 44100);
    return Promise.all(
      sources.map(async ({ id, role, src }) => {
        const response = await fetch(src);
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        return {
          id,
          role,
          src,
          ok: response.ok,
          contentType: response.headers.get("content-type"),
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
        };
      })
    );
  }, cues);

  expect(decoded).toHaveLength(24);
  for (const recording of decoded) {
    expect(recording.ok, recording.src).toBe(true);
    expect(recording.contentType, recording.src).toContain("audio/mpeg");
    expect(recording.duration, recording.src).toBeGreaterThan(1);
    expect(recording.channels, recording.src).toBeGreaterThanOrEqual(1);
  }
  expect(decoded.find(({ id, role }) => id === "amadeus" && role === "music")?.duration).toBeGreaterThan(40);
});

test("theater cover wall searches, previews, and exposes distinct materials", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]').first().click();

  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const search = dialog.getByRole("searchbox", { name: "Search films" });
  const catalog = dialog.locator("[data-theater-catalog]");
  const originalPosters = catalog.locator("img[data-original-poster]");
  await expect(search).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Media credits" })).toHaveAttribute(
    "href",
    "/film-credits"
  );
  await expect(catalog.locator("[data-film-scene]")).toHaveCount(17);
  await expect(originalPosters).toHaveCount(16);
  expect(
    await originalPosters.evaluateAll((images) =>
      images.every((image) => image.getAttribute("src")?.startsWith("/posters/original/"))
    )
  ).toBe(true);
  await expect
    .poll(() =>
      originalPosters.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0
        )
      )
    )
    .toBe(true);
  await expect
    .poll(() => catalog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1))
    .toBe(true);

  const textures = await catalog
    .locator("[data-poster-texture]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-poster-texture")));
  expect(new Set(textures).size).toBe(17);

  for (const { id } of grades) {
    await expect(
      catalog.locator(`[data-film-scene="${id}"] img[data-original-poster="${id}"]`)
    ).toHaveAttribute("src", `/posters/original/${id}.webp`);
  }
  await expect(
    catalog.locator('[data-film-scene="house"] img[data-open-asset="house"]')
  ).toHaveAttribute("src", "/posters/open/house-projector.svg");

  await search.fill("sand");
  await expect(catalog.locator("[data-film-scene]")).toHaveCount(1);
  const dune = catalog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  await expect(dialog.locator("[data-theater-detail]")).toContainText("Dune");
  await expect(dialog.locator("[data-theater-detail]")).toContainText(
    "All hail Villeneuve"
  );
  await expect(dialog.locator("[data-theater-detail]")).toContainText("Reviewed by");

  await search.fill("no matching film");
  await expect(dialog.getByText("No films match that search.")).toBeVisible();
});

test("film media credits publish the required attribution and edit notices", async ({
  page,
}) => {
  await page.goto("/film-credits");
  await expect(page.getByRole("heading", { name: "Media credits" })).toBeVisible();
  await expect(page.getByText("Kevin MacLeod")).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY 3.0" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/3.0/"
  );
  await expect(page.getByText(/copyright-free recording was supplied for/)).toBeVisible();
  // The Jupiter plate (the only CC BY visual) was retired on 2026-07-16 with
  // 2001's motif overhaul; background plates are CC0/PD and need no credit.
  await expect(page.getByText(/CC0, public-domain, or U.S. government works/)).toBeVisible();
});

test("theater emits preview, commit, and restore intent", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents = [];
    window.addEventListener("gradechange", (event) => {
      const detail = (event as CustomEvent<{ intent?: string }>).detail;
      (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents?.push(
        detail?.intent ?? "missing"
      );
    });
  });

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const dune = dialog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  await dune.getByRole("button", { name: "Use Dune grade" }).click();

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  await dialog
    .locator('[data-film-scene="matrix"]')
    .getByRole("button", { name: "Use The Matrix grade" })
    .focus();
  await page.getByRole("button", { name: "Close theater" }).click();

  const intents = await page.evaluate(
    () => (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents
  );
  expect(intents).toContain("preview");
  expect(intents).toContain("commit");
  expect(intents?.at(-1)).toBe("restore");
});

test("global film lifecycle keeps compact controls across routes and House tears down", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(0);

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const dune = dialog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await dune.getByRole("button", { name: "Use Dune grade" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "dune");
  const controls = page.getByRole("group", { name: "Cinematic mode controls" });
  await expect(controls).toBeVisible();
  await expect(controls.getByText("Dune")).toBeAttached();
  // Committing a film is a user gesture, so sound defaults on.
  await expect(controls.getByRole("button", { name: "Turn sound off" })).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 15_000 }
  );
  await expect(controls.getByRole("button", { name: /effects/ })).toHaveCount(0);

  await page.goto("/resume");
  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "dune");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toBeVisible();

  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const house = page.getByRole("dialog", { name: "Film theater" }).locator(
    '[data-film-scene="house"]'
  );
  await house.getByRole("button", { name: "Use House Grade grade" }).focus();
  await house.getByRole("button", { name: "Use House Grade grade" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-film-mode");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(0);
});

test("audio defaults on at commit, follows commits instead of previews, and mutes cleanly", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  let dialog = page.getByRole("dialog", { name: "Film theater" });
  const dune = dialog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await dune.getByRole("button", { name: "Use Dune grade" }).click();

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-audio-state", "running", { timeout: 20_000 });
  await expect(root).toHaveAttribute("data-audio-film", "dune");
  await expect(root).toHaveAttribute(
    "data-audio-music-source",
    "/audio/film-modes/dune-music.mp3"
  );
  await expect(root).toHaveAttribute("data-audio-effect-sources", "/audio/film-modes/dune-sand.mp3");
  await expect(page.getByRole("button", { name: "Turn sound off" })).toHaveAttribute(
    "title",
    /Cavernous desert choir.*Flowing desert sand/
  );
  await expect.poll(() => root.getAttribute("data-audio-nodes")).not.toBe("0");

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  dialog = page.getByRole("dialog", { name: "Film theater" });
  const matrix = dialog.locator('[data-film-scene="matrix"]');
  await matrix.getByRole("button", { name: "Use The Matrix grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "matrix");
  await expect(root).toHaveAttribute("data-audio-film", "dune");

  await matrix.getByRole("button", { name: "Use The Matrix grade" }).click();
  await expect(root).toHaveAttribute("data-audio-film", "matrix");

  const nextCues = {
    arrival: "/audio/film-modes/arrival-music.mp3",
    wargames: "/audio/film-modes/wargames-music.mp3",
    amadeus: "/audio/film-modes/amadeus-music.mp3",
    "fury-road": "/audio/film-modes/fury-road-music.mp3",
  } as const;
  for (const [gradeId, source] of Object.entries(nextCues)) {
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent("gradechange", {
        detail: { gradeId: id, intent: "commit" },
      }));
    }, gradeId);
    await expect(root).toHaveAttribute("data-audio-film", gradeId);
    await expect(root).toHaveAttribute(
      "data-audio-source",
      source
    );
  }
  // The engine still responds to scroll, but gently — revved down 2026-07-16
  // so the multi-rev loop stops swelling on every scroll gesture.
  const furyEngine = filmExperiences.find(({ id }) => id === "fury-road")?.audio.effects[0];
  expect(furyEngine?.scrollRate).toBeGreaterThan(0.05);
  expect(furyEngine?.scrollRate).toBeLessThanOrEqual(0.15);
  expect(Number(await root.getAttribute("data-audio-tracks"))).toBeLessThanOrEqual(4);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-audio-state", "suspended");
  await page.waitForTimeout(850);
  await expect(root).toHaveAttribute("data-audio-state", "suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-audio-state", "running");

  await page.getByRole("button", { name: "Turn sound off" }).click();
  await expect(root).toHaveAttribute("data-audio-state", "off");
  await expect(root).toHaveAttribute("data-audio-source", "none");
  await expect(root).toHaveAttribute("data-audio-nodes", "0");
  await expect(root).toHaveAttribute("data-audio-tracks", "0");

  // Committing another film re-arms the sound-on default.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gradechange", {
      detail: { gradeId: "arrival", intent: "commit" },
    }));
  });
  await expect(root).toHaveAttribute("data-audio-state", "running", { timeout: 20_000 });
  await expect(root).toHaveAttribute("data-audio-film", "arrival");
});

test("canvas runtime owns one renderer and House removes it", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  let dialog = page.getByRole("dialog", { name: "Film theater" });
  const dune = dialog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await dune.getByRole("button", { name: "Use Dune grade" }).click();

  const root = page.locator("[data-film-experience-root]");
  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(root).toHaveAttribute("data-visual-film", "dune");
  await expect(root).toHaveAttribute("data-frame-state", "running");
  await expect(canvas).toHaveCSS("pointer-events", "none");

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  dialog = page.getByRole("dialog", { name: "Film theater" });
  const house = dialog.locator('[data-film-scene="house"]');
  await house.getByRole("button", { name: "Use House Grade grade" }).focus();
  await house.getByRole("button", { name: "Use House Grade grade" }).click();
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-frame-state", "off");
});

test("reduced motion renders a deliberate static film frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const casablanca = dialog.locator('[data-film-scene="casablanca"]');
  await casablanca.getByRole("button", { name: "Use Casablanca grade" }).focus();
  await casablanca.getByRole("button", { name: "Use Casablanca grade" }).click();

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-frame-state", "static");
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveAttribute(
    "data-static-frame",
    "true"
  );

  await page.setViewportSize({ width: 720, height: 840 });
  await expect
    .poll(() =>
      page.locator("canvas[data-cinematic-layer]").evaluate((element) => {
        const context = element.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        let visible = 0;
        for (let index = 3; index < pixels.length; index += 64) {
          if (pixels[index] > 4) visible += 1;
        }
        return visible;
      })
    )
    .toBeGreaterThan(20);
});

test("Casablanca plane weaves left-to-right across the frame, not a diagonal landing", () => {
  const width = 1200;
  const height = 800;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let rawTime = 0; rawTime <= 60; rawTime += 0.25) {
    const { x, y } = planePosition(rawTime, width, height);
    xs.push(x);
    ys.push(y);
  }

  // Left-to-right crossing: the aircraft enters past the left edge and exits
  // past the right, sweeping the full width.
  expect(Math.min(...xs)).toBeLessThan(0);
  expect(Math.max(...xs)).toBeGreaterThan(width);

  // Weaving flight stays in the upper band the whole time — it is deliberately
  // NOT the earlier spec's diagonal descent that would end in the lower-right.
  expect(Math.min(...ys)).toBeGreaterThan(height * 0.05);
  expect(Math.max(...ys)).toBeLessThan(height * 0.4);
});

test("Casablanca serves its aircraft silhouette and renders an authored world", async ({ page }) => {
  await page.goto("/");
  const plane = await page.request.get("/posters/open/casablanca-plane.webp");
  expect(plane.ok()).toBe(true);
  expect(plane.headers()["content-type"]).toContain("image/webp");

  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const casablanca = dialog.locator('[data-film-scene="casablanca"]');
  await casablanca.getByRole("button", { name: "Use Casablanca grade" }).click();

  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveAttribute("data-renderer", "casablanca");
  await expect(canvas).toHaveAttribute("data-authored", "true");
  // The aircraft is drawn by the canvas runtime; no DOM image layer remains.
  await expect(page.locator("img[data-film-asset]")).toHaveCount(0);
});

test("film modes load their verified real-asset fragments", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-film-experience-root]")).toHaveAttribute(
    "data-experience-ready",
    "true"
  );

  for (const experience of filmExperiences) {
    await page.evaluate((gradeId) => {
      window.dispatchEvent(new CustomEvent("gradechange", {
        detail: { gradeId, intent: "commit" },
      }));
    }, experience.id);

    const assets = page.locator(`[data-film-asset][data-film-id="${experience.id}"]`);
    await expect(assets).toHaveCount(experience.visualAssets.length);
    if (experience.id === "matrix") continue;
    await expect
      .poll(() =>
        assets.evaluateAll((images) =>
          images.every((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          })
        )
      )
      .toBe(true);
  }
});

test("WarGames exposes a keyboard-operable draw simulation", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("film-grade", "wargames"));
  await page.goto("/");

  const openButton = page.getByRole("button", { name: "Open tic-tac-toe simulation" });
  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "JXN-83 tic-tac-toe simulation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Draw-seeking simulation")).toBeVisible();
  const closeButton = dialog.getByRole("button", { name: "Close simulation" });
  const resetButton = dialog.getByRole("button", { name: "Reset simulation" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(resetButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  const firstCell = dialog.getByRole("button", { name: "Cell 1 empty" });
  await firstCell.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "Cell 1 X" })).toBeVisible();
  await expect(dialog.locator("[data-simulation-moves]"))
    .toHaveAttribute("data-simulation-moves", "2");

  await resetButton.click();
  await expect(dialog.locator("[data-simulation-moves]"))
    .toHaveAttribute("data-simulation-moves", "0");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
});

test("complete catalog switches through one bounded experience lifecycle", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    if (source.includes("/_vercel/insights/") || message.text().includes("/_vercel/insights/")) return;
    errors.push(`${source}: ${message.text()}`);
  });
  await page.goto("/");

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-experience-ready", "true");
  for (const grade of grades) {
    await page.evaluate((gradeId) => {
      window.dispatchEvent(new CustomEvent("gradechange", {
        detail: { gradeId, intent: "commit" },
      }));
    }, grade.id);
    await expect(root).toHaveAttribute("data-committed-film", grade.id);
    await expect(root).toHaveAttribute("data-frame-state", "running");
    await expect(page.locator("canvas[data-cinematic-layer]")).toHaveAttribute(
      "data-renderer",
      grade.id
    );
    await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(1);
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gradechange", {
      detail: { gradeId: "casablanca", intent: "preview" },
    }));
  });
  await expect(root).toHaveAttribute("data-active-film", "casablanca");
  await expect(root).toHaveAttribute("data-committed-film", "wargames");

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gradechange", {
      detail: { gradeId: "wargames", intent: "restore" },
    }));
  });
  await expect(root).toHaveAttribute("data-active-film", "wargames");

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gradechange", {
      detail: { gradeId: null, intent: "commit" },
    }));
  });
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-frame-state", "off");
  expect(errors).toEqual([]);
});

test("mobile mode keeps the portfolio usable at the bounded quality tier", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("film-grade", "wall-e"));
  await page.goto("/");

  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveAttribute("data-renderer", "wall-e");
  expect(await canvas.evaluate((element) => element.width)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toBeVisible();

  const name = page.getByLabel("Name");
  await name.scrollIntoViewIfNeeded();
  await name.fill("Interaction remains available");
  await expect(name).toHaveValue("Interaction remains available");
  await expect(canvas).toHaveCSS("pointer-events", "none");
});

const filmRenderCases = [
  ["casablanca", "Casablanca", "departures"],
  ["dune", "Dune", "ground pulse"],
  ["matrix", "The Matrix", "glyph rain"],
  ["blade-runner", "Blade Runner 2049", "spinner traffic"],
  ["space-odyssey", "2001: A Space Odyssey", "JB-35"],
  ["the-batman", "The Batman", "cipher"],
  ["parasite", "Parasite", "Morse lamp"],
  ["arrival", "Arrival", "12 markers"],
  ["fury-road", "Mad Max: Fury Road", "eight-cylinder gauge"],
  ["her", "Her", "warm waveform"],
  ["wall-e", "WALL-E", "JB113"],
  ["royal-tenenbaums", "The Royal Tenenbaums", "record player"],
  ["fight-club", "Fight Club", "payphone"],
  ["goodfellas", "Goodfellas", "final-day dates"],
  ["amadeus", "Amadeus", "movement count"],
  ["wargames", "WarGames", "tic-tac-toe"],
] as const;

for (const [id, label, expectedReference] of filmRenderCases) {
  test(`${label} renders an authored, reference-dense film world`, async ({ page }) => {
    await page.addInitScript((filmId) => {
      localStorage.setItem("film-grade", filmId);
    }, id);
    await page.goto("/");

    const root = page.locator("[data-film-experience-root]");
    const canvas = page.locator("canvas[data-cinematic-layer]");
    await expect(root).toHaveAttribute("data-frame-state", "running");
    await expect(canvas).toHaveAttribute("data-renderer", id);
    await expect(canvas).toHaveAttribute("data-authored", "true");
    await expect(canvas).toHaveAttribute(
      "data-visual-references",
      new RegExp(expectedReference, "i")
    );
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const context = element.getContext("2d");
          if (!context) return 0;
          const pixels = context.getImageData(0, 0, element.width, element.height).data;
          let visible = 0;
          for (let index = 3; index < pixels.length; index += 64) {
            if (pixels[index] > 4) visible += 1;
          }
          return visible;
        })
      )
      .toBeGreaterThan(20);
  });
}
