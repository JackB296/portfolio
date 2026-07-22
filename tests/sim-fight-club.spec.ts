import { expect, test, type Locator, type Page } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The tourist: a full authored week. Everything on the board is deterministic
// (fixed nights, fixed options, fixed breath steps under reduced motion), so
// these tests script exact runs. data-sim-state values:
// briefing → night (steps tag/line/probe) → marla → negotiation → settled|made.

// One clean line through the week: the guaranteed-fresh name each night plus
// the room's own tell. Probing nights use the reduced-motion breath steps —
// three breaths land the needle at 0.1, inside every night's still band.
const NIGHT_PLAYS = [
  { name: "Cornelius", line: "We're still men. Just... remaining.", probe: false },
  { name: "Travis", line: "The parasites and I have made our peace.", probe: true },
  { name: "Barry", line: "It's the cough at night that gives me away.", probe: false },
  { name: "Herman", line: "I want bowel cancer.", probe: true },
  { name: "Milo", line: "The scan lit up like a switchboard.", probe: true },
  { name: "Vance", line: "It started as a freckle I ignored.", probe: true },
  { name: "Otto", line: "Some nights the pain just hums along.", probe: true },
] as const;

// Single-game film: the pill opens the game directly, no launcher menu. The
// shared opener handles the grade, the pill, and reduced motion; the check-in
// and walk-in beats are this game's own entry into the week.
async function openGame(page: Page, reducedMotion = true): Promise<Locator> {
  const dialog = await openFilmSim(page, {
    grade: "fight-club",
    pill: "Open the tourist",
    dialog: "The tourist",
    reducedMotion,
  });
  await expect(dialog.getByText("You're a tourist.")).toBeVisible();
  await dialog.getByRole("button", { name: "Check in" }).click();
  await expect(dialog.locator("[data-sim-state]")).toHaveAttribute("data-sim-state", "briefing");
  await dialog.getByRole("button", { name: "Walk in" }).click();
  return dialog;
}

async function steadyBreath(dialog: Locator) {
  const breathe = dialog.getByRole("button", { name: "Breathe" });
  await breathe.click();
  await breathe.click();
  await breathe.click();
  await dialog.getByRole("button", { name: "Exhale" }).click();
}

async function playCleanWeek(dialog: Locator) {
  for (const [index, play] of NIGHT_PLAYS.entries()) {
    await dialog.getByRole("button", { name: new RegExp(play.name) }).click();
    await dialog.getByRole("button", { name: play.line, exact: true }).click();
    if (play.probe) await steadyBreath(dialog);
    if (index === 3) {
      // Marla's mid-week arrival: two staged beats, then a reaction.
      await dialog.getByRole("button", { name: "And then" }).click();
      await dialog.getByRole("button", { name: "And then" }).click();
      await dialog.getByRole("button", { name: "Stare her down" }).click();
    }
  }
  await expect(dialog.locator("[data-sim-state]")).toHaveAttribute("data-sim-state", "negotiation");
}

test("a perfect week: blend all seven nights, honor her claims, bank 178", async ({ page }) => {
  const dialog = await openGame(page);
  const board = dialog.locator("[data-sim-state]");

  await expect(board).toHaveAttribute("data-night", "1");
  await playCleanWeek(dialog);
  await expect(board).toHaveAttribute("data-composure", "10");

  // Cede exactly her three claims, keep the rest, settle first try.
  await dialog.getByRole("button", { name: /Blood parasites/ }).click();
  await dialog.getByRole("button", { name: /Ascending bowel cancer/ }).click();
  await dialog.getByRole("button", { name: /Melanoma/ }).click();
  await expect(dialog.getByText("No collisions")).toBeVisible();
  await dialog.getByRole("button", { name: "Settle the week" }).click();

  await expect(board).toHaveAttribute("data-sim-state", "settled");
  // 10 composure ×10 + 7 clean nights ×8 + first-try 12 + honored bowel 10.
  await expect(dialog.locator("[data-final-score]")).toHaveAttribute("data-final-score", "178");
  await expect(dialog.getByText("Faker of the year. Nobody slept better.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("getting made and checking back in", async ({ page }) => {
  const dialog = await openGame(page);
  const board = dialog.locator("[data-sim-state]");

  // "Bob" is on night one's sign-in sheet: every pick costs composure.
  const bob = dialog.getByRole("button", { name: /Bob/ });
  for (let hit = 0; hit < 9; hit += 1) await bob.click();
  await expect(board).toHaveAttribute("data-composure", "1");
  await expect(board).toHaveAttribute("data-sim-state", "night");
  await bob.click();
  await expect(board).toHaveAttribute("data-sim-state", "made");
  await expect(board).toHaveAttribute("data-composure", "0");

  // Replay without refreshing: composure and the week reset.
  await dialog.getByRole("button", { name: "Check in again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "night");
  await expect(board).toHaveAttribute("data-composure", "10");
  await expect(board).toHaveAttribute("data-night", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("negotiation: collisions cost, and keeping bowel cancer is paid for", async ({ page }) => {
  const dialog = await openGame(page);
  const board = dialog.locator("[data-sim-state]");
  await playCleanWeek(dialog);

  // Settling greedy (every room kept) collides on her non-bowel claims.
  await expect(dialog.getByText("2 collisions")).toBeVisible();
  await dialog.getByRole("button", { name: "Settle the week" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "negotiation");
  await expect(board).toHaveAttribute("data-composure", "9");

  // She pushes back the moment you re-claim bowel cancer.
  const bowel = dialog.getByRole("button", { name: /Ascending bowel cancer/ });
  await bowel.click(); // cede it...
  await bowel.click(); // ...then take it back — her line lands.
  await expect(dialog.getByText("I want bowel cancer.").first()).toBeVisible();

  // Cede only her other rooms; keep bowel cancer and pay for it.
  await dialog.getByRole("button", { name: /Blood parasites/ }).click();
  await dialog.getByRole("button", { name: /Melanoma/ }).click();
  await expect(dialog.getByText("keeping it will cost")).toBeVisible();
  await dialog.getByRole("button", { name: "Settle the week" }).click();

  await expect(board).toHaveAttribute("data-sim-state", "settled");
  // Composure 9 − 2 paid = 7 → 70, + 7 clean nights ×8 = 56; no bonuses.
  await expect(dialog.locator("[data-final-score]")).toHaveAttribute("data-final-score", "126");
  await expect(dialog.getByText("kept — paid for")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("animated mode: the breath needle runs and an exhale always resolves", async ({ page }) => {
  const dialog = await openGame(page, false);
  const board = dialog.locator("[data-sim-state]");

  await dialog.getByRole("button", { name: /Cornelius/ }).click();
  await dialog.getByRole("button", { name: NIGHT_PLAYS[0].line, exact: true }).click();
  await dialog.getByRole("button", { name: /Travis/ }).click();
  await dialog.getByRole("button", { name: NIGHT_PLAYS[1].line, exact: true }).click();

  // Animated probe: no step button, just the oscillating needle and the exhale.
  await expect(board).toHaveAttribute("data-step", "probe");
  await expect(dialog.getByRole("button", { name: "Breathe" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Exhale" }).click();
  // Steadied or slipped, the night always resolves and the week moves on.
  await expect(board).toHaveAttribute("data-night", "3");

  // The sound toggle is a real, labelled control.
  const sfx = dialog.getByRole("button", { name: "Toggle sound effects" });
  await expect(sfx).toHaveAttribute("aria-pressed", "false");
  await sfx.click();
  await expect(sfx).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
