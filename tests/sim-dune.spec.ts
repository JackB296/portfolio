import { expect, test } from "@playwright/test";
import { openFilmSim, visiblePixelCount } from "./helpers";

// The three Dune simulations, upgraded to staged experiences. Every sequence
// here is deterministic: fixed step cadences far outside the rhythm tolerance,
// holds comfortably past (or short of) fixed thresholds, and loose assertions
// where a value merely needs to have moved.

test("Dune sandwalk: uneven steps cross, thumpers plant, pause holds the sand", async ({
  page,
}) => {
  const pill = page.getByRole("button", { name: "The sleeper must awaken" });
  const dialog = await openFilmSim(page, {
    grade: "dune",
    pill: "The sleeper must awaken",
    game: "walk without rhythm",
    dialog: "Walk without rhythm",
  });
  await expect(dialog.getByText("You must walk without rhythm.")).toBeVisible();

  await dialog.getByRole("button", { name: "Cross the dune" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-leg", "1");

  // The stage actually draws.
  await expect
    .poll(() => visiblePixelCount(dialog.locator("canvas")))
    .toBeGreaterThan(0);

  // Four steps with wildly uneven gaps: every adjacent interval pair differs
  // by far more than the leg-one tolerance, so the maker never hears a beat.
  const stepButton = dialog.getByRole("button", { name: "Step", exact: true });
  const gaps = [90, 380, 120, 400];
  for (const gap of gaps) {
    await stepButton.click();
    await page.waitForTimeout(gap);
  }
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-steps", "4");

  // Step four picked up the leg's thumper; planting it spends the charge.
  await expect(board).toHaveAttribute("data-charges", "1");
  await dialog.getByRole("button", { name: "Plant thumper" }).click();
  await expect(board).toHaveAttribute("data-charges", "0");

  // Pause freezes the crossing; resume hands the step control back.
  await dialog.getByRole("button", { name: "Pause the crossing" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "Resume the crossing" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Dune gom jabbar: holding through trial one passes, an early pull fails", async ({
  page,
}) => {
  const pill = page.getByRole("button", { name: "The sleeper must awaken" });
  const dialog = await openFilmSim(page, {
    grade: "dune",
    pill: "The sleeper must awaken",
    game: "the gom jabbar",
    dialog: "The gom jabbar",
  });
  await expect(dialog.getByText("Fear is the mind-killer.")).toBeVisible();

  await dialog.getByRole("button", { name: "Put your hand in the box" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "ready");
  await expect(board).toHaveAttribute("data-trial", "1");

  // Trial one endures 3.2s: hold well past it and the trial banks mid-hold.
  const holdButton = dialog.getByRole("button", { name: "Hold your hand in the box" });
  await holdButton.hover();
  await page.mouse.down();
  await expect(board).toHaveAttribute("data-sim-state", "holding");
  await page.waitForTimeout(3700);
  await expect(board).toHaveAttribute("data-sim-state", "between");
  await page.mouse.up();

  // The verdict stage advances to trial two; pulling out early there fails.
  await dialog.getByRole("button", { name: "Continue to trial 2" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "ready");
  await expect(board).toHaveAttribute("data-trial", "2");

  await holdButton.hover();
  await page.mouse.down();
  await expect(board).toHaveAttribute("data-sim-state", "holding");
  await page.waitForTimeout(500);
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-sim-state", "failed");

  // A failure deep in the test can restart the whole gauntlet.
  await dialog.getByRole("button", { name: "Restart from the first trial" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "ready");
  await expect(board).toHaveAttribute("data-trial", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Dune slow blade: a steadied release lands, a hasty one flares the shield", async ({
  page,
}) => {
  const pill = page.getByRole("button", { name: "The sleeper must awaken" });
  const dialog = await openFilmSim(page, {
    grade: "dune",
    pill: "The sleeper must awaken",
    game: "the slow blade",
    dialog: "The slow blade",
  });
  await expect(dialog.getByText("The slow blade penetrates the shield.")).toBeVisible();

  await dialog.getByRole("button", { name: "Take the stance" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "aiming");

  // Tier one has no guard: a 1.6s hold decays the strike speed to ~0.08,
  // far under the 0.34 window, so the release always passes.
  const strikeButton = dialog.getByRole("button", { name: "Strike" });
  await strikeButton.hover();
  await page.mouse.down();
  await expect(board).toHaveAttribute("data-sim-state", "charging");
  await page.waitForTimeout(1600);
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-outcome", "touch");
  await expect(board).toHaveAttribute("data-player", "1");

  // The bout resolves back into the next exchange on its own.
  await expect(board).toHaveAttribute("data-sim-state", "aiming");

  // An immediate release commits near full speed: the shield turns it no
  // matter what the guard is doing, and the opponent takes the touch.
  await strikeButton.hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-outcome", "bounced");
  await expect(board).toHaveAttribute("data-opponent", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
