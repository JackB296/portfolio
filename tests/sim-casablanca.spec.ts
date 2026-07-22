import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The Casablanca games. Deterministic coverage leans on reduced motion, which
// each game maps to a deliberate playable alternative: the letters desk drops
// its clock (suspicion alone can end the run), the wheel resolves the drop
// instantly, the runway keeps a slow fixed spin-up with a wide window and an
// untimed goodbye, and the piano becomes an ordered step-through.

test("Casablanca letters desk clears all three shifts to the pardon", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "casablanca",
    pill: "Of all the games in all the world",
    game: "letters of transit",
    dialog: "Letters of transit",
    reducedMotion: true,
  });
  await expect(dialog.getByText("Round up the usual suspects.")).toBeVisible();
  await dialog.getByRole("button", { name: "Open the desk" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // Fixed decks: stamp genuine papers, reject forged ones, shift by shift.
  const shifts: boolean[][] = [
    [true, false, true, false],
    [false, true, false, true, true],
    [true, false, false, true, false, true],
  ];
  for (const [shiftIndex, deck] of shifts.entries()) {
    for (const genuine of deck) {
      await dialog.getByRole("button", { name: genuine ? "Stamp" : "Reject" }).click();
    }
    if (shiftIndex < shifts.length - 1) {
      await expect(board).toHaveAttribute("data-sim-state", "summary");
      await dialog.getByRole("button", { name: "Begin the next shift" }).click();
      await expect(board).toHaveAttribute("data-sim-state", "running");
    }
  }

  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(board).toHaveAttribute("data-letters-cleared", "15");
  await expect(board).toHaveAttribute("data-letters-suspicion", "0");

  // Replayable without a refresh.
  await dialog.getByRole("button", { name: "Reopen the desk" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-letters-cleared", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Of all the games in all the world" })
  ).toBeFocused();
});

test("Casablanca letters desk pauses, resumes, and tracks suspicion", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "casablanca",
    pill: "Of all the games in all the world",
    game: "letters of transit",
    dialog: "Letters of transit",
  });
  await dialog.getByRole("button", { name: "Open the desk" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // The first paper carries the true seal — stamping it advances the deck.
  await dialog.getByRole("button", { name: "Stamp" }).click();
  await expect(board).toHaveAttribute("data-letters-cleared", "1");

  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "Resume the shift" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // The second paper is forged; stamping it draws the gendarme's eye.
  await dialog.getByRole("button", { name: "Stamp" }).click();
  await expect(board).toHaveAttribute("data-letters-suspicion", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Casablanca roulette settles the drop and the runway flies its nights", async ({ page }) => {
  // Land it on twenty-two: the drop resolves and the table pays or clears.
  const roulette = await openFilmSim(page, {
    grade: "casablanca",
    pill: "Of all the games in all the world",
    game: "land it on 22",
    dialog: "Land it on twenty-two",
    reducedMotion: true,
  });
  await roulette.getByRole("button", { name: "Take the wheel" }).click();
  const wheelBoard = roulette.locator("[data-sim-state]");
  await expect(wheelBoard).toHaveAttribute("data-sim-state", "spinning");
  await roulette.getByRole("button", { name: "Drop the ball" }).click();
  await expect(wheelBoard).toHaveAttribute("data-sim-state", /won|missed/);

  // Either branch returns to a fresh spin — the streak keeps or resets.
  if ((await wheelBoard.getAttribute("data-sim-state")) === "won") {
    await expect(wheelBoard).toHaveAttribute("data-roulette-wins", "1");
    await roulette.getByRole("button", { name: "Cash out" }).click();
    await expect(wheelBoard).toHaveAttribute("data-sim-state", "cashed");
    await roulette.getByRole("button", { name: "Back to the wheel" }).click();
  } else {
    await expect(wheelBoard).toHaveAttribute("data-roulette-wins", "0");
    await roulette.getByRole("button", { name: "Spin again" }).click();
  }
  await expect(wheelBoard).toHaveAttribute("data-sim-state", "spinning");
  await page.keyboard.press("Escape");
  await expect(roulette).toHaveCount(0);

  // The runway goodbye: a full hold, the farewell beat, then a stalled night.
  const runway = await openFilmSim(page, {
    grade: "casablanca",
    pill: "Of all the games in all the world",
    game: "the runway goodbye",
    dialog: "The runway goodbye",
    reducedMotion: true,
  });
  await runway.getByRole("button", { name: "Walk to the plane" }).click();
  const runwayBoard = runway.locator("[data-sim-state]");
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "ready");
  await expect(runwayBoard).toHaveAttribute("data-runway-night", "1");

  const holdButton = runway.getByRole("button", { name: "Hold to depart" });
  await holdButton.hover();
  await page.mouse.down();
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "holding");
  await page.waitForTimeout(2400);
  await page.mouse.up();
  // Reduced motion never times the goodbye out — the beat waits to be said.
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "farewell");
  await runway.getByRole("button", { name: "Say the goodbye" }).click();
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "departed");
  await expect(runwayBoard).toHaveAttribute("data-runway-departures", "1");

  await runway.getByRole("button", { name: "Next departure" }).click();
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "ready");
  await expect(runwayBoard).toHaveAttribute("data-runway-night", "2");

  // A release well before the window stalls the night.
  await holdButton.hover();
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "stalled");
  await runway.getByRole("button", { name: "Ready the next flight" }).click();
  await expect(runwayBoard).toHaveAttribute("data-sim-state", "ready");
  await expect(runwayBoard).toHaveAttribute("data-runway-departures", "0");

  await page.keyboard.press("Escape");
  await expect(runway).toHaveCount(0);
});

test("Casablanca piano plays three verses through to the coda", async ({ page }) => {
  const piano = await openFilmSim(page, {
    grade: "casablanca",
    pill: "Of all the games in all the world",
    game: "play it, sam",
    dialog: "Play it, Sam",
    reducedMotion: true,
  });
  // The reference quote (distinct from the how-to-play objective, which also
  // names the song).
  await expect(piano.getByText(/Play it, Sam\. Play/)).toBeVisible();
  await piano.getByRole("button", { name: "Sit at the piano" }).click();

  const board = piano.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "playing");
  await expect(board).toHaveAttribute("data-piano-verse", "1");

  const mute = piano.getByRole("button", { name: "sound on" });
  await mute.click();
  await expect(piano.getByRole("button", { name: "sound off" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  // "As Time Goes By", by key label (B♭ renders as the flat), stepped through in
  // order, verse by verse. Under reduced motion each correct key advances the
  // phrase, so this mirrors the SEQUENCE in CasablancaPiano.tsx.
  const sequence = [
    "A", "B♭", "A", "G", "A", "F",
    "A", "B♭", "A", "G", "A", "E",
    "A", "B♭", "A", "G", "A", "D",
    "E", "F", "G", "A", "B♭", "C", "D", "C",
    "D", "E", "F",
  ];
  for (let verse = 0; verse < 3; verse += 1) {
    for (const key of sequence) {
      await piano.getByRole("button", { name: `Play ${key}` }).click();
    }
    if (verse < 2) {
      await expect(board).toHaveAttribute("data-sim-state", "break");
      await piano.getByRole("button", { name: "Next verse" }).click();
      await expect(board).toHaveAttribute("data-piano-verse", String(verse + 2));
    }
  }

  await expect(board).toHaveAttribute("data-sim-state", "done");
  // Three verses of the full phrase.
  await expect(board).toHaveAttribute("data-piano-hits", String(sequence.length * 3));

  await piano.getByRole("button", { name: "Play it again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "playing");
  await expect(board).toHaveAttribute("data-piano-hits", "0");

  await page.keyboard.press("Escape");
  await expect(piano).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Of all the games in all the world" })
  ).toBeFocused();
});
