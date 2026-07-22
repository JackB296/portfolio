import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

/**
 * The three Amadeus games. Each run opens the launcher, plays the game
 * meaningfully, and leaves by escape with focus returned to the pill. Every
 * assertion is either a fixed sequence or a poll — nothing here depends on
 * landing a beat at the right millisecond.
 */

test("Amadeus flawless page: sweep, adjudicate marks, turn the page, close", async ({
  page,
}) => {
  // Reduced motion is the deterministic path through this game: there is no
  // flame loop to re-resolve what is under the lens, so the marks are listed
  // as buttons and the test can name exactly which one it is calling. Under
  // the live flame the browser can deliver a boundary mousemove to the canvas
  // whenever layout shifts, which would decide the focused mark for us.
  const pill = page.getByRole("button", { name: "From your obedient servant" });
  const dialog = await openFilmSim(page, {
    grade: "amadeus",
    pill: "From your obedient servant",
    game: "the flawless page",
    dialog: "The flawless page",
    reducedMotion: true,
  });
  await expect(dialog.getByText("No corrections of any kind.")).toBeVisible();
  await dialog.getByRole("button", { name: "Read the originals" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "reading");
  await expect(board).toHaveAttribute("data-page", "1");

  const notACorrection = dialog.getByRole("button", {
    name: "Not a correction",
    exact: true,
  });
  const nextMark = dialog.getByRole("button", {
    name: "Move the flame to the next mark",
  });

  const mark = (n: number) => dialog.getByRole("button", { name: `Inspect mark ${n}` });

  // The rule the whole game turns on is on screen the whole time.
  await expect(dialog.getByText("A correction changes the music")).toBeVisible();

  // Page one is Mozart's hand: four marks, none of them a correction. The first
  // is called from the keyboard, which is also the binding check: J is NOT a
  // correction, K is a correction. The panel describes what the lens shows
  // rather than naming the mark, so the call is made on evidence.
  await mark(1).click();
  await expect(dialog.getByText("under the flame", { exact: true })).toBeVisible();
  await expect(dialog.getByText("A round bead of dried ink").first()).toBeVisible();
  await page.keyboard.press("j");
  await expect(board).toHaveAttribute("data-marks-read", "1");
  await expect(board).toHaveAttribute("data-misreads", "0");

  // The rest of the page goes through the buttons.
  for (const n of [2, 3]) {
    await mark(n).click();
    await expect(notACorrection).toBeEnabled();
    await notACorrection.click();
  }
  await nextMark.click();
  await expect(notACorrection).toBeEnabled();
  await notACorrection.click();

  await expect(board).toHaveAttribute("data-sim-state", "turning");
  await expect(board).toHaveAttribute("data-marks-read", "4");
  await expect(Number(await board.getAttribute("data-manuscript-score"))).toBeGreaterThan(0);

  // The second page is Salieri's own draft, where corrections are real.
  await dialog.getByRole("button", { name: "Turn the page" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "reading");
  await expect(board).toHaveAttribute("data-page", "2");

  // K calls a correction, and the first mark on Salieri's draft is one: the
  // lens shows the four noteheads the stroke cancels.
  await mark(1).click();
  await expect(dialog.getByText("cancelling every one of them").first()).toBeVisible();
  await page.keyboard.press("k");
  await expect(board).toHaveAttribute("data-marks-read", "1");
  await expect(board).toHaveAttribute("data-misreads", "0");

  // J on a real correction is a misread, and the page says what the mark was.
  await mark(2).click();
  await page.keyboard.press("j");
  await expect(board).toHaveAttribute("data-misreads", "1");
  await expect(dialog.getByText(/that WAS a correction/)).toBeVisible();

  // The buttons still make the same calls. The third mark on Salieri's own
  // draft is only a blot — not everything on his page is a wound.
  await mark(3).click();
  await expect(dialog.getByText("A bead of ink on open paper").first()).toBeVisible();
  await notACorrection.click();
  await expect(board).toHaveAttribute("data-marks-read", "3");
  await expect(board).toHaveAttribute("data-misreads", "1");

  // Pause and resume both hold the run.
  await dialog.getByRole("button", { name: "pause", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "reading");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Amadeus conduct: beat, cue both sections, pause, close", async ({ page }) => {
  const pill = page.getByRole("button", { name: "From your obedient servant" });
  const dialog = await openFilmSim(page, {
    grade: "amadeus",
    pill: "From your obedient servant",
    game: "conduct",
    dialog: "Conduct",
  });
  await dialog.getByRole("button", { name: "Raise the baton" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "conducting");
  await expect(board).toHaveAttribute("data-movement", "1");

  // Beat the andante at its marked 84. Space is used rather than the button
  // because a Playwright click costs hundreds of milliseconds on a loaded
  // machine, and this game measures the interval between strokes: clicking
  // would conduct at ~55 against a marked 84 and correctly tear the run apart.
  await page.keyboard.press("Space");
  await expect(board).toHaveAttribute("data-playing", "84");

  // A steady hand pulls the players together. Beat until cohesion clears the
  // bar rather than snapshotting after a fixed count: the game rewards on-tempo
  // strokes and drains off-tempo ones, so on a loaded machine — where a stray
  // waitForTimeout can overshoot one interval and dent cohesion — the following
  // steady beats recover it. A clean machine clears in the first handful; the
  // cap is headroom, not the expected path.
  let cohesion = 0;
  for (let i = 0; i < 16 && cohesion <= 45; i += 1) {
    await page.waitForTimeout(714);
    await page.keyboard.press("Space");
    cohesion = Number(await board.getAttribute("data-cohesion"));
  }

  // A steady hand keeps the players together and the pulse moving.
  await expect(board).toHaveAttribute("data-sim-state", "conducting");
  expect(cohesion).toBeGreaterThan(40);
  await expect
    .poll(async () => Number(await board.getAttribute("data-beat")), { timeout: 8000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await board.getAttribute("data-conduct-score")))
    .toBeGreaterThan(0);
  // The orchestra took its tempo from the hand, not from a metronome — it is
  // live and in a plausible conducting range. The exact figure is not asserted:
  // the harness's own keypress latency sets the beat, so on a loaded machine
  // the players correctly follow a slower hand than the marked 84.
  await expect
    .poll(async () => Number(await board.getAttribute("data-playing")))
    .toBeGreaterThan(30);
  await expect
    .poll(async () => Number(await board.getAttribute("data-playing")))
    .toBeLessThan(200);

  // Both sections can be pulled back onto the beat.
  await dialog
    .getByRole("button", { name: "Cue the strings back onto the beat" })
    .click();
  await dialog.getByRole("button", { name: "Cue the winds back onto the beat" }).click();
  await expect(board).toHaveAttribute("data-cues", "2");

  await dialog.getByRole("button", { name: "pause", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "conducting");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Amadeus too many notes: hear it, cut notes, concede, close", async ({ page }) => {
  const pill = page.getByRole("button", { name: "From your obedient servant" });
  const dialog = await openFilmSim(page, {
    grade: "amadeus",
    pill: "From your obedient servant",
    game: "too many notes",
    dialog: "Too many notes",
  });
  await expect(dialog.getByText("There are simply too many notes.")).toBeVisible();
  await dialog.getByRole("button", { name: "Take the Emperor's note" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "trimming");
  await expect(board).toHaveAttribute("data-passage", "1");

  await dialog.getByRole("button", { name: "Play the passage as written" }).click();

  // Cut the suspension: the expensive one. The phrase plays with the hole and
  // the note comes straight back.
  await dialog.getByRole("button", { name: /^Cut note 4 of 6/ }).click();
  await expect(board).toHaveAttribute("data-sim-state", "cutting");
  await expect(board).toHaveAttribute("data-attempts", "1");
  await expect(board).toHaveAttribute("data-sim-state", "trimming", { timeout: 15000 });

  // Cut the passing tone: the cheapest cut on the page, and still a wound.
  await dialog.getByRole("button", { name: /^Cut note 6 of 6/ }).click();
  await expect(board).toHaveAttribute("data-sim-state", "trimming", { timeout: 15000 });
  await expect(board).toHaveAttribute("data-best-damage", "13");

  // Concede the passage rather than spend the third cut.
  await dialog.getByRole("button", { name: "It cannot be cut" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "interval");
  await expect(Number(await board.getAttribute("data-notes-score"))).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "The next passage" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "trimming");
  await expect(board).toHaveAttribute("data-passage", "2");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
