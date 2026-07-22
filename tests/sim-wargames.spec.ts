import { expect, test, type Locator } from "@playwright/test";
import { openFilmSim, readSimulationScores } from "./helpers";

// Deep gameplay coverage for the two WarGames simulations. Launcher-level
// checks (the menu opens each game, escape returns focus) live in
// film-modes.spec.ts; this spec plays each one meaningfully.
//
// Determinism: the games with real-time windows are played under reduced
// motion, where the flight and intercept windows are fixed and generous — that
// also exercises the reduced-motion branch the house rules require.

const stateOf = (board: Locator) => board.getAttribute("data-sim-state");

test("tic-tac-toe: play WOPR, hand it the board, watch it learn futility", async ({
  page,
}) => {
  // Reduced motion makes WOPR reply synchronously, so the operator round is a
  // fixed sequence of clicks rather than a wait.
  const dialog = await openFilmSim(page, {
    grade: "wargames",
    pill: "Shall we play a game?",
    game: "tic-tac-toe simulation",
    dialog: "JXN-83 tic-tac-toe simulation",
    start: "Play a game",
    reducedMotion: true,
  });

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "operator");
  await expect(board).toHaveAttribute("data-ttt-round", "1");
  await expect(board).toHaveAttribute("data-simulation-moves", "0");

  // Play the round out by always taking the first open cell. WOPR answers
  // every move, so the board fills two marks at a time until it settles.
  for (let move = 0; move < 5; move += 1) {
    if ((await stateOf(board)) !== "operator") break;
    const open = dialog.locator('button[aria-label$="empty"]:not([disabled])');
    if ((await open.count()) === 0) break;
    await open.first().click();
  }
  await expect(board).toHaveAttribute("data-sim-state", "between");

  // Hand the board over: the lattice takes the stage and the counter starts.
  await dialog.getByRole("button", { name: "Let it play itself" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "selfplay");
  await expect(board).toHaveAttribute("data-ttt-throttle", "1");

  // Pause freezes the counter; resume releases it.
  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "selfplay");

  // Push the tube to its top notch. It may fault and drop back to the safe
  // notch on the way — either way the counter only ever climbs.
  for (let push = 0; push < 4; push += 1) {
    await dialog.getByRole("button", { name: "Push throttle" }).click();
  }
  await expect(board).toHaveAttribute("data-ttt-throttle", "5");

  await expect(board).toHaveAttribute("data-sim-state", "learned", { timeout: 30_000 });
  await expect(board).toHaveAttribute("data-ttt-games", "400");
  await expect(
    dialog.getByText("The only winning move is not to play.")
  ).toBeVisible();

  const banked = await readSimulationScores(page);
  expect(banked["wargames-tic-tac-toe"]).toBeGreaterThan(0);

  // Replay without remounting the dialog.
  await dialog.getByRole("button", { name: "Run it again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "operator");
  await expect(board).toHaveAttribute("data-ttt-round", "1");
  await expect(board).toHaveAttribute("data-ttt-score", "0");
  await expect(board).toHaveAttribute("data-ttt-games", "0");

  await dialog.getByRole("button", { name: "Close simulation" }).focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shall we play a game?" })).toBeFocused();
});

test("thermonuclear: strike, intercept, escalate, then refuse for the win", async ({
  page,
}) => {
  // Reduced motion pins the flight times, so the intercept window is fixed.
  const dialog = await openFilmSim(page, {
    grade: "wargames",
    pill: "Shall we play a game?",
    game: "global thermonuclear war",
    dialog: "Global thermonuclear war",
    start: "Begin simulation",
    reducedMotion: true,
  });

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "briefing");
  await expect(board).toHaveAttribute("data-defcon", "5");
  await expect(board).toHaveAttribute("data-cities-ours", "8");
  await expect(board).toHaveAttribute("data-cities-theirs", "8");
  await expect(board).toHaveAttribute("data-intercepts", "3");

  // Targets are a real choice: a soft target takes two, and provokes more.
  const soft = dialog.getByRole("radio", { name: /Coastal submarine yard/ });
  await soft.click();
  await expect(soft).toHaveAttribute("aria-checked", "true");

  await dialog.getByRole("button", { name: "Launch strike" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "incoming", { timeout: 10_000 });
  await expect(board).toHaveAttribute("data-cities-theirs", "6");
  await expect(board).toHaveAttribute("data-defcon", "4");

  // One of the two inbound is taken off the board; the other lands.
  await dialog.getByRole("button", { name: "Intercept (space)" }).click();
  await expect(board).toHaveAttribute("data-intercepts", "2");
  await expect(board).toHaveAttribute("data-sim-state", "briefing", { timeout: 15_000 });
  await expect(board).toHaveAttribute("data-cities-ours", "7");
  await expect(board).toHaveAttribute("data-exchanges", "1");

  // The refusal is the scored win, and the score is simply what is standing.
  await dialog.getByRole("button", { name: "Decline to play" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "refused");
  await expect(board).toHaveAttribute("data-war-score", "1500");
  await expect(
    dialog.getByText("The only winning move is not to play.")
  ).toBeVisible();

  const banked = await readSimulationScores(page);
  expect(banked["wargames-thermonuclear"]).toBe(1500);

  // Another scenario resets the board without remounting the dialog.
  await dialog.getByRole("button", { name: "Run another scenario" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "briefing");
  await expect(board).toHaveAttribute("data-defcon", "5");
  await expect(board).toHaveAttribute("data-cities-ours", "8");
  await expect(board).toHaveAttribute("data-exchanges", "0");

  await dialog.getByRole("button", { name: "Close simulation" }).focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shall we play a game?" })).toBeFocused();
});
