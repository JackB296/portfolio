import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The one Royal Tenenbaums game. Everything here is deterministic: fixed
// click sequences against fixed opening states, and loose assertions wherever
// a real-time loop decides the outcome.
//
// A single-game film has no menu: the simulate pill opens the game directly,
// so its accessible name is "Open mordecai's return".

test("Mordecai: loose the hawk, pause, call him, close", async ({ page }) => {
  const dialog = await openFilmSim(page, {
    grade: "royal-tenenbaums",
    pill: "Open mordecai's return",
    dialog: "Mordecai's return",
    start: "Loose the hawk",
  });
  const board = dialog.locator("[data-sim-state]");

  await expect(board).toHaveAttribute("data-sim-state", "ready");
  await dialog.getByRole("button", { name: "Loose the hawk" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "flying");
  await expect(board).toHaveAttribute("data-flight", "1");
  await expect(board).toHaveAttribute("data-calls-left", "3");
  // The lure is not issued on the first cast.
  await expect(dialog.getByRole("button", { name: /Swing the lure/ })).toBeDisabled();

  // Pause holds the flight and resume returns it.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "flying");

  // Three calls always resolve the flight one way or the other; which way is
  // up to the arc, so the assertion stays loose.
  for (let i = 0; i < 3; i += 1) {
    const calling = dialog.getByRole("button", { name: "Call him back" });
    if (!(await calling.count())) break;
    await calling.click();
  }
  await expect(board).toHaveAttribute("data-sim-state", /caught|lost|done/);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
