import { expect, test } from "@playwright/test";
import { openFilmSim, readSimulationScores } from "./helpers";

// Deep gameplay coverage for the Matrix trials. Launcher-level checks (menu
// opens each game, escape returns focus) live in film-modes.spec.ts; this
// spec plays each game meaningfully. Deterministic only: the decode phrase
// order is fixed, and bullet-time is exercised under reduced motion, where
// the volley windows are fixed and generous.

const PHRASES = [
  "wake up, jack",
  "there is no spoon",
  "the matrix has you",
  "follow the white rabbit",
  "no one can be told what the matrix is",
] as const;

test("decode the rain: combo, error penalty, pause, full clear, replay", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "matrix",
    pill: "Free your mind",
    game: "decode the rain",
    dialog: "Decode the rain",
  });
  await expect(dialog.getByText("Wake up, Neo…")).toBeVisible();
  const runButton = dialog.getByRole("button", { name: "Run the trace" });
  await expect(runButton).toBeFocused();
  await runButton.click();

  const board = dialog.locator("[data-sim-state]");
  const input = dialog.getByRole("textbox", { name: "Type the pass phrase" });
  await expect(input).toBeFocused();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-decode-round", "1");
  await expect(board).toHaveAttribute("data-decode-mode", "trial");

  // The live speed chart is on screen from the first frame, with its readouts.
  const graph = dialog.getByRole("img", { name: /Typing speed graph/ });
  await expect(graph).toBeVisible();
  await expect(dialog.locator("[data-decode-readout='wpm']")).toBeVisible();
  await expect(dialog.locator("[data-decode-readout='raw']")).toBeVisible();
  await expect(dialog.locator("[data-decode-readout='accuracy']")).toBeVisible();

  // Clear round one straight away — the fixed phrase is the deterministic
  // hook — then do the fiddly assertions early in round two's fresh clock.
  await input.pressSequentially(PHRASES[0]);
  await expect(board).toHaveAttribute("data-decode-round", "2");

  // Correct keys build the combo (13 carried over, plus 5 here); a wrong
  // keystroke is rejected (the field only ever holds a prefix of the phrase)
  // and breaks the combo.
  await input.pressSequentially("there");
  await expect(board).toHaveAttribute("data-decode-combo", "18");
  await input.pressSequentially("x");
  await expect(input).toHaveValue("there");
  await expect(board).toHaveAttribute("data-decode-combo", "0");

  // Pause freezes the trace and locks the input; resume hands focus back.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await expect(input).toBeDisabled();
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(input).toBeFocused();

  // Clear the remaining rounds. The phrase order is fixed by design.
  await input.pressSequentially(PHRASES[1].slice("there".length));
  await expect(board).toHaveAttribute("data-decode-round", "3");
  for (let round = 2; round < PHRASES.length; round += 1) {
    await input.pressSequentially(PHRASES[round]);
  }
  await expect(board).toHaveAttribute("data-sim-state", "done");

  // The graph persists on the results screen rather than vanishing with the run.
  await expect(graph).toBeVisible();
  expect(Number(await board.getAttribute("data-decode-wpm"))).toBeGreaterThan(0);

  // The composite score is banked as the personal best.
  const score = Number(await board.getAttribute("data-decode-score"));
  expect(score).toBeGreaterThan(0);
  const banked = await readSimulationScores(page);
  expect(banked["matrix-decode"]).toBeGreaterThan(0);

  // Replay resets the run without remounting the dialog.
  await dialog.getByRole("button", { name: "Run it back" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-decode-round", "1");
  await expect(board).toHaveAttribute("data-decode-score", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Free your mind" })).toBeFocused();
});

test("decode the rain: freeplay runs untimed while the graph records", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "matrix",
    pill: "Free your mind",
    game: "decode the rain",
    dialog: "Decode the rain",
  });
  await dialog.getByRole("button", { name: "Run the trace" }).click();

  const board = dialog.locator("[data-sim-state]");
  const input = dialog.getByRole("textbox", { name: "Type the pass phrase" });

  // The mode toggle switches the run and resets it.
  await dialog.getByRole("button", { name: "Freeplay mode" }).click();
  await expect(board).toHaveAttribute("data-decode-mode", "freeplay");
  await expect(board).toHaveAttribute("data-decode-round", "1");
  await expect(board).toHaveAttribute("data-decode-score", "0");
  await expect(dialog.getByText("no trace · freeplay")).toBeVisible();

  // Freeplay phrases are drawn from a shuffled pool, so the spec reads the
  // accessible line rather than assuming one — and it never runs out.
  for (let index = 0; index < 3; index += 1) {
    const label = (await dialog.locator("p.sr-only").first().textContent()) ?? "";
    const phrase = label.replace("Phrase to type:", "").trim();
    expect(phrase.length).toBeGreaterThan(0);
    await input.pressSequentially(phrase);
    await expect(board).toHaveAttribute("data-decode-round", String(index + 2));
  }
  expect(Number(await board.getAttribute("data-decode-score"))).toBeGreaterThan(0);

  // The chart samples once a second: with typing under way, samples accrue.
  await expect
    .poll(async () => Number(await board.getAttribute("data-decode-samples")), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0);

  const graph = dialog.getByRole("img", { name: /Typing speed graph/ });
  await expect(graph).toBeVisible();

  // Ending a freeplay run banks it and keeps the chart on screen.
  await dialog.getByRole("button", { name: "End run" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(graph).toBeVisible();

  // The toggle goes back, and the trial's fixed first phrase returns.
  await dialog.getByRole("button", { name: "Trial mode" }).click();
  await expect(board).toHaveAttribute("data-decode-mode", "trial");
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await input.pressSequentially(PHRASES[0]);
  await expect(board).toHaveAttribute("data-decode-round", "2");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("bullet-time: dodge in the window, pause, take the hit, jack back in", async ({ page }) => {
  // Reduced motion pins the volley to fixed, generous windows — the
  // deterministic way to play the timing game under test.
  const dialog = await openFilmSim(page, {
    grade: "matrix",
    pill: "Free your mind",
    game: "bullet-time",
    dialog: "Bullet-time",
    reducedMotion: true,
  });
  await dialog.getByRole("button", { name: "Enter the loop" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-bullet-round", "0");

  // Volley one: wait for the lean window, dodge, and the streak banks.
  await expect(board).toHaveAttribute("data-bullet-window", "in", { timeout: 10_000 });
  await dialog.getByRole("button", { name: "Lean" }).click();
  await expect(board).toHaveAttribute("data-bullet-streak", "1");
  const scoreAfterDodge = Number(await board.getAttribute("data-bullet-score"));
  expect(scoreAfterDodge).toBeGreaterThanOrEqual(100);

  // The next volley chains automatically; pause holds it mid-charge.
  await expect(board).toHaveAttribute("data-bullet-round", "1", { timeout: 10_000 });
  await expect(board).toHaveAttribute("data-sim-state", "charging", { timeout: 10_000 });
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "charging");

  // Not leaning lets the tracer land: the run ends and the score banks.
  await expect(board).toHaveAttribute("data-sim-state", "hit", { timeout: 15_000 });
  const banked = await readSimulationScores(page);
  expect(banked["matrix-bullet-time"]).toBeGreaterThanOrEqual(100);

  // Replay resets the loop.
  await dialog.getByRole("button", { name: "Jack back in" }).click();
  await expect(board).toHaveAttribute("data-bullet-round", "0");
  await expect(board).toHaveAttribute("data-bullet-streak", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Free your mind" })).toBeFocused();
});

test("red or blue: both branches stage their consequence and replay", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "matrix",
    pill: "Free your mind",
    game: "red pill or blue",
    dialog: "Red pill or blue",
  });
  await dialog.getByRole("button", { name: "Take the offer" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "choosing");
  await expect(dialog.getByText("Both hands are open.")).toBeVisible();

  // Red: the room rewrite animates through a swallow beat, then lands.
  await dialog.getByRole("button", { name: "Red pill" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "swallow-red");
  await expect(board).toHaveAttribute("data-sim-state", "red", { timeout: 5_000 });
  await expect(dialog.getByText("Down the rabbit hole")).toBeVisible();
  await expect(dialog.getByText("The blue pill is still on the table.")).toBeVisible();

  // The offer comes back, remembering what has been seen.
  await dialog.getByRole("button", { name: "Offer the pills again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "choosing");
  await expect(dialog.getByText("The blue pill is still on the table.")).toBeVisible();

  // Blue: the other branch is worth seeing, and both-seen is acknowledged.
  await dialog.getByRole("button", { name: "Blue pill" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "blue", { timeout: 5_000 });
  await expect(dialog.getByText("The story ends")).toBeVisible();
  await expect(dialog.getByText("You have now seen both sides of the choice.")).toBeVisible();

  await dialog.getByRole("button", { name: "Offer the pills again" }).click();
  await expect(dialog.getByText("You have seen both sides of the choice.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Free your mind" })).toBeFocused();
});
