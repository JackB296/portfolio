import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// Goodfellas ships the four-clock helicopter day. Everything asserted below is a
// fixed sequence or a loose bound — nothing depends on hitting a timing window.

test("Goodfellas: the helicopter day runs, pauses, and closes", async ({ page }) => {
  // Goodfellas now ships a single game, so the pill opens it directly (no
  // launcher menu) and its accessible name is "Open helicopter day".
  const day = await openFilmSim(page, {
    grade: "goodfellas",
    pill: "Open helicopter day",
    dialog: "Helicopter day",
  });
  await day.getByRole("button", { name: "Start the day" }).click();

  const board = day.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  // The day opens with one clock; the rest arrive as it wears on.
  await expect(board).toHaveAttribute("data-helicopter-tasks", "1");

  // Three stirs takes the sauce off the burn, which banks a serviced task.
  const stir = day.getByRole("button", { name: /^The sauce:/ });
  await expect(stir).toBeEnabled();
  await stir.click();
  await stir.click();
  await stir.click();
  await expect
    .poll(async () => Number(await board.getAttribute("data-helicopter-streak")), {
      timeout: 5_000,
    })
    .toBeGreaterThan(0);

  // The clock is genuinely running.
  await expect
    .poll(async () => Number(await board.getAttribute("data-helicopter-seconds")), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0);

  await day.getByRole("button", { name: "pause", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await day.getByRole("button", { name: "resume", exact: true }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");

  await page.keyboard.press("Escape");
  await expect(day).toHaveCount(0);
});
