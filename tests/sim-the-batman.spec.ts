import { expect, test, type Locator } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The four The Batman games. Deterministic coverage leans on reduced motion,
// which each game maps to a deliberate playable alternative: the cipher desk
// drops the trace clock, the crime scene trades the timed dwell for a discrete
// examine-then-file press, the platform becomes turn-based stealth with a
// visible shadow map, and the corkboard is untimed either way.

/** Rotate the selected word until its first letter reads as the guess. */
const guessFirst = async (dialog: Locator, word: number, letter: string) => {
  await dialog.getByLabel(`First letter of word ${word}`).selectOption(letter);
};

test("The Batman cipher desk works the whole deck to the last card", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "the-batman",
    pill: "A riddle for you",
    game: "decode the riddle",
    dialog: "Decode the riddle",
    reducedMotion: true,
  });
  await expect(dialog.getByText("From your secret friend")).toBeVisible();
  await dialog.getByRole("button", { name: "Open the card" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-riddle-card", "1");

  // Card one: a single rotated word. Spend a hint first — the frequency read
  // names the letter the word starts on, which is what cracks a rotation.
  await dialog.getByRole("button", { name: "Spend a hint" }).click();
  await expect(dialog.getByText("Frequency read:")).toBeVisible();
  await guessFirst(dialog, 1, "R");
  await expect(board).toHaveAttribute("data-sim-state", "solved");
  await expect(board).toHaveAttribute("data-riddle-solved", "1");

  // Pause and resume survive between cards.
  await dialog.getByRole("button", { name: "Next card" }).click();
  await expect(board).toHaveAttribute("data-riddle-card", "2");
  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "Resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // Card two: a keyed alphabet. The wrong key spells noise and costs the run.
  await dialog.getByRole("button", { name: "Try the key ORPHAN" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await dialog.getByRole("button", { name: "Try the key GOTHAM" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "solved");

  // Card three: two words, taken out of order to prove word selection works.
  await dialog.getByRole("button", { name: "Next card" }).click();
  await expect(board).toHaveAttribute("data-riddle-card", "3");
  await dialog.getByRole("button", { name: /^Select word 2/ }).click();
  await guessFirst(dialog, 2, "L");
  await expect(board).toHaveAttribute("data-riddle-locked", "1");
  await guessFirst(dialog, 1, "T");
  await expect(board).toHaveAttribute("data-sim-state", "solved");

  // Card four: the rebus is read, not decoded.
  await dialog.getByRole("button", { name: "Next card" }).click();
  await dialog.getByRole("button", { name: "Answer WINGED RAT" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "solved");

  // Card five: three words, and the deck closes.
  await dialog.getByRole("button", { name: "Next card" }).click();
  await expect(board).toHaveAttribute("data-riddle-card", "5");
  await guessFirst(dialog, 1, "F");
  await guessFirst(dialog, 2, "T");
  await guessFirst(dialog, 3, "R");
  await expect(board).toHaveAttribute("data-sim-state", "done");
  await expect(board).toHaveAttribute("data-riddle-solved", "5");

  // Replayable without a refresh.
  await dialog.getByRole("button", { name: "Deal the deck again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-riddle-card", "1");
  await expect(board).toHaveAttribute("data-riddle-solved", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "A riddle for you" })).toBeFocused();
});

test("The Batman flashlight reads a scene and moves to the next", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "the-batman",
    pill: "A riddle for you",
    game: "the flashlight",
    dialog: "The flashlight",
    reducedMotion: true,
  });
  await dialog.getByRole("button", { name: "Take the torch" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "sweeping");
  await expect(board).toHaveAttribute("data-scene", "1");
  await expect(board).toHaveAttribute("data-logged", "0");

  // Under reduced motion a mark is examined by one press and filed by the
  // next. The lamp belongs to the house, so filing it costs charge.
  const mark = (id: string) => dialog.locator(`[data-mark="${id}"]`);
  await mark("s-lamp").click();
  await expect(board).toHaveAttribute("data-resolved", "1");
  await mark("s-lamp").click();
  await expect(dialog.getByText("That is the room, not the case.")).toBeVisible();
  await expect(board).toHaveAttribute("data-logged", "0");

  for (const id of ["s-card", "s-tape", "s-thumb"]) {
    await mark(id).click();
    await mark(id).click();
  }

  await expect(board).toHaveAttribute("data-sim-state", "summary");
  await expect(board).toHaveAttribute("data-logged", "3");
  await expect(dialog.getByText("Case board — The study")).toBeVisible();

  await dialog.getByRole("button", { name: "Next scene" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "sweeping");
  await expect(board).toHaveAttribute("data-scene", "2");
  await expect(board).toHaveAttribute("data-logged", "0");

  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "Resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "sweeping");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("The Batman platform walk clears stages by reading the shadow map", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "the-batman",
    pill: "A riddle for you",
    game: "i'm vengeance",
    dialog: "I'm vengeance",
    reducedMotion: true,
  });
  await dialog.getByRole("button", { name: "Step from the dark" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "stalking");
  await expect(board).toHaveAttribute("data-vengeance-stage", "1");
  await expect(board).toHaveAttribute("data-vengeance-cell", "0");

  const step = dialog.getByRole("button", { name: "Step forward one cell" });
  const waitBeat = dialog.getByRole("button", { name: "Wait one beat" });
  const back = dialog.getByRole("button", { name: "Step back one cell" });
  const hold = dialog.getByRole("button", { name: "Hold the dark" });

  // Turn play: the shadow map says what the next beat holds, so every turn is
  // a decision the test can make the same way a player would.
  let cleared = 0;
  for (let turn = 0; turn < 90; turn += 1) {
    const state = await board.getAttribute("data-sim-state");
    if (state === "done" || state === "busted") break;
    if (state === "caught") {
      await dialog.getByRole("button", { name: "Back to the shadows" }).click();
      continue;
    }
    if (state === "cleared") {
      cleared += 1;
      await dialog.getByRole("button", { name: "Next platform" }).click();
      continue;
    }
    const [safe, holdSafe, backSafe, charges] = await Promise.all([
      board.getAttribute("data-vengeance-safe"),
      board.getAttribute("data-vengeance-hold"),
      board.getAttribute("data-vengeance-back"),
      board.getAttribute("data-vengeance-charges"),
    ]);
    if (safe === "yes") await step.click();
    else if (holdSafe === "yes") await waitBeat.click();
    else if (backSafe === "yes") await back.click();
    else if (Number(charges) > 0) await hold.click();
    else await waitBeat.click();
  }

  // The walk got past at least the first platform, and ended in a real
  // terminal state rather than stalling mid-stage.
  expect(cleared).toBeGreaterThan(0);
  await expect(board).toHaveAttribute("data-sim-state", /done|busted|cleared/);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("The Batman evidence board strings every thread and names the case", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "the-batman",
    pill: "A riddle for you",
    game: "the evidence board",
    dialog: "The evidence board",
    reducedMotion: true,
  });
  await dialog.getByRole("button", { name: "String the board" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "linking");
  await expect(board).toHaveAttribute("data-evidence-clues", "6");
  await expect(board).toHaveAttribute("data-evidence-certainty", "100");

  const clue = (label: string) => dialog.getByRole("button", { name: `Clue ${label}` });
  const exhibit = dialog.locator("[data-exhibit]");

  // Every pin carries an exhibit card. It is empty until a pin is pointed at,
  // and both hover and keyboard focus fill it — a clue label alone is not
  // enough to reason a thread out of.
  await expect(exhibit).toHaveAttribute("data-exhibit", "");
  await clue("THE MAYOR").hover();
  await expect(exhibit).toHaveAttribute("data-exhibit", "mayor");
  await expect(dialog.getByText("A campaign portrait of the sitting mayor")).toBeVisible();
  await expect(dialog.getByText("No money leaves this city without his signature")).toBeVisible();

  await clue("RENEWAL FUND").focus();
  await expect(exhibit).toHaveAttribute("data-exhibit", "renewal");
  await expect(dialog.getByText("one billion dollars pledged to rebuild Gotham")).toBeVisible();

  // Touch has no hover, so reading is a mode: tapping a pin reads it out and
  // strings nothing.
  await dialog.getByRole("button", { name: /^Read clues/ }).click();
  await clue("FALCONE").click();
  await expect(exhibit).toHaveAttribute("data-exhibit", "falcone");
  await expect(dialog.getByText("twenty years of charges, not one conviction")).toBeVisible();
  await expect(board).toHaveAttribute("data-links", "0");
  await dialog.getByRole("button", { name: /^Stop reading clues/ }).click();

  // A pairing with no thread through it costs certainty and pins nothing.
  await clue("THE MAYOR").click();
  await clue("FALCONE").click();
  await expect(board).toHaveAttribute("data-links", "0");
  await expect(board).toHaveAttribute("data-evidence-certainty", "86");

  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "Resume" }).click();

  // The first tier: each true thread pulls two more clues onto the board.
  await clue("THE MAYOR").click();
  await clue("RENEWAL FUND").click();
  await expect(board).toHaveAttribute("data-links", "1");
  await expect(board).toHaveAttribute("data-evidence-clues", "8");

  await clue("FALCONE").click();
  await clue("THE INFORMANT").click();
  await clue("THE CARDS").click();
  await clue("GREEN INK").click();
  await expect(board).toHaveAttribute("data-links", "3");
  await expect(board).toHaveAttribute("data-evidence-clues", "12");

  // The second tier closes the web.
  await clue("THE RAT").click();
  await clue("THE DEAL").click();
  await clue("EL RATA ALADA").click();
  await clue("A WINGED RAT").click();
  await clue("THE ORPHANAGE").click();
  await clue("WAYNE MONEY").click();
  await expect(board).toHaveAttribute("data-sim-state", "naming");
  await expect(board).toHaveAttribute("data-links", "6");

  // Naming it wrong is survivable; naming it right closes the case.
  await dialog
    .getByRole("button", { name: "Name the case: The Riddler wanted the city to notice him." })
    .click();
  await expect(board).toHaveAttribute("data-sim-state", "naming");
  await dialog
    .getByRole("button", {
      name: "Name the case: Renewal was the laundry, and the rat kept the ledger.",
    })
    .click();
  await expect(board).toHaveAttribute("data-sim-state", "done");

  await dialog.getByRole("button", { name: "String it again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "linking");
  await expect(board).toHaveAttribute("data-links", "0");
  await expect(board).toHaveAttribute("data-evidence-certainty", "100");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
