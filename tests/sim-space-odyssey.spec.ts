import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The four 2001 games share one launcher. Each test opens it, plays its game
// far enough to prove the mechanic really advances, then escapes. Every
// assertion is either a fixed sequence or a loose range — nothing here depends
// on hitting a timing window, so the suite never rides on luck.

test("pod bay standoff talks HAL into opening the doors", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "open the pod bay doors",
    dialog: "Open the pod bay doors",
    start: "Probe the console",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "standoff");

  // HAL speaks his replies, so the standoff carries a visible mute. Muted
  // first, because the spoken lines are cosmetic and CI has no audio device.
  const mute = dialog.getByRole("button", { name: "Mute sound" });
  await mute.click();
  await expect(dialog.getByRole("button", { name: "Unmute sound" })).toBeVisible();

  // Asking plainly is refused and costs a breath of reserve — the whole point.
  await dialog.getByRole("button", { name: "Open the pod bay doors, HAL" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "standoff");
  await expect(board).toHaveAttribute("data-podbay-air", "9");

  // The talked-in path: directive, then the fault it exposes, then the
  // reassurance that brings his attention back down, then the plain ask.
  await dialog.getByRole("button", { name: "Cite the mission directive" }).click();
  await dialog.getByRole("button", { name: "Name the AE-35 fault" }).click();
  await expect(board).toHaveAttribute("data-podbay-leverage", "2");

  await dialog.getByRole("button", { name: "Tell him the mission still needs him" }).click();
  await dialog.getByRole("button", { name: "Ask him once more, plainly" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "talked-in");

  // Replayable without a refresh.
  await dialog.getByRole("button", { name: "Seal it and start over" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "standoff");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("pod bay offers a second way in through the override", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "open the pod bay doors",
    dialog: "Open the pod bay doors",
    start: "Probe the console",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();

  // Forcing it needs the schematic AND the severed bus, and the bus needs the
  // fault to justify it — so the order is fixed.
  await dialog.getByRole("button", { name: "Read the override schematic" }).click();
  await dialog.getByRole("button", { name: "Cite the mission directive" }).click();
  await dialog.getByRole("button", { name: "Name the AE-35 fault" }).click();
  await dialog.getByRole("button", { name: "Sever the airlock bus" }).click();
  await expect(board).toHaveAttribute("data-podbay-leverage", "4");

  await dialog.getByRole("button", { name: "Engage the manual override" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "forced-in");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("bone toss winds up, throws, and resolves the cut", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "the bone toss",
    dialog: "The bone toss",
    start: "Throw the bone",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "ready");

  const action = dialog.getByRole("button", { name: /Hold to wind up|Release|Cut/ });

  // Pause and resume before playing — the wind-up must survive it.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "ready");

  // Played from the keyboard: hold Space to charge, release to throw, press
  // again to cut. Pointer hovers re-measure the button on every step, which
  // can burn more than a whole flight on a loaded machine — the keys cannot.
  await action.focus();
  await page.keyboard.down("Space");
  await expect(board).toHaveAttribute("data-sim-state", "winding");
  await page.keyboard.up("Space");
  await expect(board).toHaveAttribute("data-sim-state", "arcing");

  // Cut. Where the cut lands depends on how much of the flight the harness
  // itself consumed, so this asserts only that the cut RESOLVES the throw —
  // the scoring path is pinned down deterministically in the next test.
  await page.keyboard.press("Space");
  await expect(board).toHaveAttribute("data-sim-state", /matched|missed/);
  await dialog.getByRole("button", { name: /Next throw|Pick it up again|Throw the five again/ }).click();
  await expect(board).toHaveAttribute("data-sim-state", "ready");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("bone toss lands a scoring cut and advances the run", async ({ page }) => {
  // Reduced motion is the deterministic way to prove the scoring path: it
  // stretches throw one to roughly 3.9s and widens the window to ±39% of the
  // flight, so a cut anywhere from ~0.4s to ~3.4s after the throw is a hit by
  // construction. It also exercises the reduced-motion branch end to end.
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "the bone toss",
    dialog: "The bone toss",
    start: "Throw the bone",
    reducedMotion: true,
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  const action = dialog.getByRole("button", { name: /Hold to wind up|Release|Cut/ });

  await action.focus();
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(board).toHaveAttribute("data-sim-state", "arcing");

  // Comfortably inside a three-second window, and driven by keys so no
  // hover re-measurement can eat the flight on a loaded machine.
  await page.waitForTimeout(1_200);
  await page.keyboard.press("Space");

  await expect(board).toHaveAttribute("data-sim-state", "matched");
  expect(Number(await board.getAttribute("data-bone-score"))).toBeGreaterThan(0);
  await expect(board).toHaveAttribute("data-bone-streak", "1");

  // A hit advances to the next throw; a miss would have repeated this one.
  await dialog.getByRole("button", { name: "Next throw" }).click();
  await expect(board).toHaveAttribute("data-bone-throw", "2");
  await expect(board).toHaveAttribute("data-sim-state", "ready");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("disconnect pulls a clean bank and punishes a wrong pull", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "disconnect HAL",
    dialog: "Disconnect HAL",
    start: "Pull the cores",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "extracting");
  await expect(board).toHaveAttribute("data-disconnect-bank", "1");

  // The bay speaks HAL's protests and synthesizes the wind-down song, so it
  // carries one mute that governs both. Toggled both ways: muting must not be
  // a trapdoor, and the game must stay playable either side of it.
  await dialog.getByRole("button", { name: "Mute sound" }).click();
  await expect(dialog.getByRole("button", { name: "Unmute sound" })).toBeVisible();
  await dialog.getByRole("button", { name: "Unmute sound" }).click();
  await expect(dialog.getByRole("button", { name: "Mute sound" })).toBeVisible();

  // Out-of-order pull scrambles the bay and drops the score.
  await dialog.getByRole("button", { name: /^Memory core 3,/ }).click();
  await expect(board).toHaveAttribute("data-disconnect-scrambles", "1");
  await expect(board).toHaveAttribute("data-disconnect-pulled", "0");

  // Bank one has four cores and none of them seize, so a plain ordered click
  // sequence clears it and moves the run to bank two.
  for (const n of [1, 2, 3, 4]) {
    await dialog.getByRole("button", { name: new RegExp(`^Memory core ${n},`) }).click();
  }
  await expect(board).toHaveAttribute("data-disconnect-bank", "2");
  await expect(board).toHaveAttribute("data-disconnect-pulled", "0");
  expect(Number(await board.getAttribute("data-disconnect-score"))).toBeGreaterThan(0);

  // Pause freezes the stability clock.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "extracting");

  // Restart returns the run to bank one.
  await dialog.getByRole("button", { name: "Slot them back" }).click();
  await expect(board).toHaveAttribute("data-disconnect-bank", "1");
  await expect(board).toHaveAttribute("data-disconnect-score", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("docking waltz judges nudges and tracks drift", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "space-odyssey",
    pill: "Good afternoon, gentlemen",
    game: "docking waltz",
    dialog: "Docking waltz",
    start: "Begin the approach",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "aligning");
  await expect(board).toHaveAttribute("data-docking-approach", "1");

  const nudge = dialog.getByRole("button", { name: "Nudge" });

  // Pause and mute first, while the ship is still on the corridor — an idle
  // measure legitimately accrues drift, so these controls are checked before
  // the run has had a chance to end. Resume is asserted as "no longer paused"
  // rather than "aligning": beats keep landing, and a slow machine could
  // legitimately have drifted out by the time the assertion runs.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).not.toHaveAttribute("data-sim-state", "paused");

  const mute = dialog.getByRole("button", { name: "Mute sound" });
  await mute.click();
  await expect(dialog.getByRole("button", { name: "Unmute sound" })).toBeVisible();

  // Driven from the keyboard: it covers the keyboard control path, and it
  // does not depend on the button holding still while judgments land.
  await nudge.focus();

  // Six rapid nudges inside one measure: at most one can be on a live beat, so
  // the rest must register as misses and push drift up. Asserting "drift moved
  // or the ship went adrift" keeps this independent of where the clock is.
  for (let i = 0; i < 6; i += 1) {
    if ((await board.getAttribute("data-sim-state")) !== "aligning") break;
    await page.keyboard.press("Space");
  }
  const outcome = await board.getAttribute("data-sim-state");
  if (outcome === "adrift") {
    // Replayable without a refresh, back to the first approach. Drift is NOT
    // asserted at zero here: the measure restarts live, so live beats left
    // unanswered start pushing the ship out again straight away — which is
    // the intended behaviour, not a leak from the previous run.
    await dialog.getByRole("button", { name: "Cast off again" }).click();
    await expect(board).toHaveAttribute("data-sim-state", "aligning");
    await expect(board).toHaveAttribute("data-docking-approach", "1");
    await expect(board).toHaveAttribute("data-docking-score", "0");
  } else {
    expect(Number(await board.getAttribute("data-docking-drift"))).toBeGreaterThan(0);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
