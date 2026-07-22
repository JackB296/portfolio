import { expect, test, type Locator } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The two Arrival games share a launcher. Each block opens one from the menu,
// reads its reference card, plays it far enough to change state meaningfully,
// and closes it — the assertions are on fixed sequences and bounded loops, so
// nothing here depends on timing luck.

const state = (board: Locator) => board.getAttribute("data-sim-state");

test("Arrival draws the logogram across escalating shapes", async ({ page }) => {
  const pill = page.getByRole("button", { name: "Shall we begin?" });
  const dialog = await openFilmSim(page, {
    grade: "arrival",
    pill: "Shall we begin?",
    game: "draw the logogram",
    dialog: "Draw the logogram",
  });
  await expect(dialog.getByText("Human.")).toBeVisible();
  await dialog.getByRole("button", { name: "Raise the board" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "drawing");
  await expect(board).toHaveAttribute("data-logogram-utterance", "1");

  // The keyboard path draws a clean ring, which clears the utterance, blooms,
  // and banks points.
  await dialog.getByRole("button", { name: "Trace the ring" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "spoken");
  await expect(board).toHaveAttribute("data-rings", "1");
  await expect(board).not.toHaveAttribute("data-logogram-score", "0");

  // Progression: the next utterance asks for a harder shape at a higher bar.
  await dialog.getByRole("button", { name: "Answer again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "drawing");
  await expect(board).toHaveAttribute("data-logogram-utterance", "2");

  await dialog.getByRole("button", { name: "Trace the ring" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "spoken");
  await expect(board).toHaveAttribute("data-logogram-streak", "2");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Arrival reads a written message mark by mark", async ({ page }) => {
  const pill = page.getByRole("button", { name: "Shall we begin?" });
  const dialog = await openFilmSim(page, {
    grade: "arrival",
    pill: "Shall we begin?",
    game: "translate",
    dialog: "Translate",
  });
  await expect(dialog.getByText("What is your purpose on Earth?")).toBeVisible();
  await dialog.getByRole("button", { name: "Read the message" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "reading");
  // Message one is three marks long, and the reader starts with three hints.
  await expect(board).toHaveAttribute("data-remaining", "3");
  await expect(board).toHaveAttribute("data-translate-hints", "3");

  // The radical key is the whole hinting system's foundation, so it must be
  // on screen before a first-time reader has done anything.
  await expect(dialog.getByText("kin — three dots on the upper arc")).toBeVisible();

  // The clock is long enough to hold, and holding it stops the reading.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "reading");

  // One spent hint strikes readings off the selected mark and costs a token.
  await dialog.getByRole("button", { name: /^Hint/ }).click();
  await expect(board).toHaveAttribute("data-translate-hints", "2");

  // Every wrong reading is struck off that mark and disabled, so always taking
  // the first available reading terminates: at worst it walks the readings
  // still open once per mark. Nothing here depends on timing.
  const marks = dialog.locator('button[aria-label^="Mark"]:not([disabled])');
  const readings = dialog.locator('button[aria-label^="Reading"]:not([disabled])');
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if ((await state(board)) !== "reading") break;
    await marks.first().click();
    await readings.first().click();
  }
  await expect(board).toHaveAttribute("data-sim-state", "solved");
  await expect(board).toHaveAttribute("data-remaining", "0");
  // The decoded sentence, not a pile of pairs.
  await expect(dialog.getByText("The heptapods offer a tool.")).toBeVisible();

  // Replayable in place, and the next message is longer.
  await dialog.getByRole("button", { name: "The next message" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "reading");
  await expect(board).toHaveAttribute("data-translate-message", "2");
  await expect(board).toHaveAttribute("data-remaining", "4");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
