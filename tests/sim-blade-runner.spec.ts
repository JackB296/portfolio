import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The Blade Runner slate: Voight-Kampff (probe tells, wager, call), Enhance
// (three photographs, each hiding one detail that only resolves under
// magnification), Origami tell (timed creases fold a unicorn). Every run is
// deterministic: subject data, scene layouts, the Esper's lock hint slewing to
// a fixed sector, and — for origami — the reduced-motion marker that parks
// inside the window.

test("Voight-Kampff runs a full session to the case file", async ({ page }) => {
  // Six subjects × probe/wager/call/advance is ~24 interactions; on a loaded
  // machine that outruns the default ceiling without anything being wrong.
  test.slow();
  const dialog = await openFilmSim(page, {
    grade: "blade-runner",
    pill: "More human than human",
    game: "voight-kampff",
    dialog: "Voight-Kampff",
  });
  await expect(dialog.getByText("Tell me about your mother.")).toBeVisible();
  await dialog.getByRole("button", { name: "Begin the baseline" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // Calls cannot be made blind: probing unlocks them.
  await expect(dialog.getByRole("button", { name: "Call human" })).toBeDisabled();

  // The fixed roster's truths, in order. One probe, full-confidence wager:
  // each correct call pays 3 × (4 − 1) = 9 chips.
  const calls = ["Call human", "Call replicant", "Call replicant", "Call human", "Call replicant", "Call human"];
  for (let subject = 0; subject < calls.length; subject += 1) {
    await expect(board).toHaveAttribute("data-vk-index", String(subject + 1));
    await dialog.getByRole("button", { name: "Probe pupil" }).click();
    await dialog.getByRole("button", { name: "Wager 3 chips" }).click();
    await dialog.getByRole("button", { name: calls[subject] }).click();
    await dialog
      .getByRole("button", { name: subject < calls.length - 1 ? "Next subject" : "Open the case file" })
      .click();
  }

  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(board).toHaveAttribute("data-vk-chips", "54");
  await expect(dialog.getByText("Blade runner", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Run a new session" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-vk-index", "1");
  await expect(board).toHaveAttribute("data-vk-chips", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Enhance walks three photographs from the brief to the hard copy", async ({ page }) => {
  // Three cases, each opened wide and closed on a printed detail.
  test.slow();
  const dialog = await openFilmSim(page, {
    grade: "blade-runner",
    pill: "More human than human",
    game: "enhance",
    dialog: "Enhance",
  });
  await expect(dialog.getByText("Deckard walking a photograph")).toBeVisible();
  await dialog.getByRole("button", { name: "Load the photo" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-enhance-case", "1");
  await expect(board).toBeFocused();

  // The brief is the whole starting position — no grid, no sweep.
  await expect(dialog.getByText("The tenant swears he spent the evening alone")).toBeVisible();
  await expect(dialog.getByText("too coarse to read")).toBeVisible();

  // A print from the wide frame is emulsion and nothing else, and it costs one
  // of the three prints the case allows.
  await dialog.getByRole("button", { name: "Print this frame" }).click();
  await expect(board).toHaveAttribute("data-enhance-misses", "1");
  await expect(dialog.getByText("Nothing but emulsion")).toBeVisible();

  const hint = dialog.getByRole("button", { name: /Spend a hint/ });
  const zoomIn = dialog.getByRole("button", { name: "Increase magnification" });

  // Case 1 — the mirror. Hints narrow to the glass, then to the reflected
  // doorway, and the last one slews the deck to the sector; the operator still
  // has to push the magnification past the detail's own threshold.
  await hint.click();
  await expect(dialog.getByText("The window looks out. The mirror looks back.")).toBeVisible();
  await hint.click();
  await expect(dialog.getByText("look at the doorway the mirror keeps")).toBeVisible();
  await hint.click();
  await expect(board).toHaveAttribute("data-enhance-hints", "3");
  for (let push = 0; push < 3; push += 1) await zoomIn.click();
  await expect(dialog.getByText("resolution sufficient")).toBeVisible();
  await dialog.getByRole("button", { name: "Print this frame" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "printed");
  await expect(dialog.getByText("standing in the reflected doorway")).toBeVisible();

  await dialog.getByRole("button", { name: "Next case" }).click();
  await expect(board).toHaveAttribute("data-enhance-case", "2");
  await expect(board).toHaveAttribute("data-enhance-misses", "0");

  // Case 2 — the luggage tag. The stencil is unreadable until past ×9.
  await expect(dialog.getByText("A case was left at the desk")).toBeVisible();
  for (let spend = 0; spend < 3; spend += 1) await hint.click();
  for (let push = 0; push < 3; push += 1) await zoomIn.click();
  await dialog.getByRole("button", { name: "Print this frame" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "printed");
  await expect(dialog.getByText("N6-4041")).toBeVisible();

  await dialog.getByRole("button", { name: "Next case" }).click();
  await expect(board).toHaveAttribute("data-enhance-case", "3");

  // Case 3 — the doorway dark, deepest of the three at ×11.
  await expect(dialog.getByText("left something behind as a message")).toBeVisible();
  for (let spend = 0; spend < 3; spend += 1) await hint.click();
  for (let push = 0; push < 3; push += 1) await zoomIn.click();
  await dialog.getByRole("button", { name: "Print this frame" }).click();
  await expect(dialog.getByText("A folded paper unicorn")).toBeVisible();

  await dialog.getByRole("button", { name: "Close the file" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(dialog.getByText("Case file · closed")).toBeVisible();

  await dialog.getByRole("button", { name: "Pull the frames again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-enhance-case", "1");
  await expect(board).toHaveAttribute("data-enhance-hints", "0");
  await expect(board).toHaveAttribute("data-enhance-score", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Enhance pans and magnifies the photograph from the keyboard", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "blade-runner",
    pill: "More human than human",
    game: "enhance",
    dialog: "Enhance",
  });
  await dialog.getByRole("button", { name: "Load the photo" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeFocused();

  // The magnification is announced rather than only drawn, so the readout is
  // asserted where a screen reader would hear it.
  const readout = dialog.getByRole("status");
  await expect(readout).toContainText("×1.0 magnification");

  // Plus pushes in by a fixed factor per press: 1.4⁴ ≈ 3.8.
  for (let push = 0; push < 4; push += 1) await page.keyboard.press("+");
  await expect(readout).toContainText("×3.8 magnification");

  // Arrows walk the frame, and minus pulls back out to the fit.
  for (const key of ["ArrowRight", "ArrowRight", "ArrowDown"]) await page.keyboard.press(key);
  for (let pull = 0; pull < 6; pull += 1) await page.keyboard.press("-");
  await expect(readout).toContainText("×1.0 magnification");
  await expect(dialog.getByText("too coarse to read")).toBeVisible();

  // H spends a hint without touching the pointer.
  await page.keyboard.press("h");
  await expect(board).toHaveAttribute("data-enhance-hints", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Origami folds the unicorn crease by crease under reduced motion", async ({ page }) => {
  // Reduced motion parks the marker inside every crease window, so each
  // deliberate press lands — the deterministic path through a timing game.
  const dialog = await openFilmSim(page, {
    grade: "blade-runner",
    pill: "More human than human",
    game: "origami tell",
    dialog: "Origami tell",
    reducedMotion: true,
  });
  await expect(dialog.getByText("Gaff's paper unicorn")).toBeVisible();
  await dialog.getByRole("button", { name: "Start folding" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "folding");
  await expect(board).toHaveAttribute("data-folds", "0");

  const fold = dialog.getByRole("button", { name: "Fold", exact: true });
  for (let crease = 1; crease <= 6; crease += 1) {
    await fold.click();
    if (crease < 6) await expect(board).toHaveAttribute("data-folds", String(crease));
  }

  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(dialog.getByText("Unicorn folded")).toBeVisible();

  await dialog.getByRole("button", { name: "Fold another" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "folding");
  await expect(board).toHaveAttribute("data-folds", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
