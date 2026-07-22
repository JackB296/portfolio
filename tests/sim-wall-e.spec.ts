import { expect, test, type Locator } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The three WALL·E games. Every game carries a deliberate (reduced-motion) mode
// where each input advances the world exactly one beat, so these runs are fixed
// input sequences with fixed outcomes rather than races against a timer.

test("WALL·E · the belt runs a shift, and the spork opens a third bin", async ({ page }) => {
  const pill = page.getByRole("button", { name: "Define playing" });
  const dialog = await openFilmSim(page, {
    grade: "wall-e",
    pill: "Define playing",
    game: "sort the spork",
    dialog: "Sort the spork",
    reducedMotion: true,
  });
  // The reference card fronts every game — the allusion lands before the game.
  await expect(dialog.getByText("breaks taxonomy")).toBeVisible();
  await dialog.getByRole("button", { name: "Open the stream" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();

  const crush = dialog.getByRole("button", { name: "← Crush" });
  const keep = dialog.getByRole("button", { name: "Keep →" });

  await expect(board).toHaveAttribute("data-sim-state", "sorting");
  await expect(board).toHaveAttribute("data-spork-shift", "1");
  // The binary is all there is to start with.
  await expect(board).toHaveAttribute("data-spork-bins", "2");
  await expect(dialog.getByRole("button", { name: "↓ Set aside" })).toHaveCount(0);

  // Shift one, in order: hubcap, bottle, bulb, paint can, scrap, cube.
  await keep.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "1");
  expect(Number(await board.getAttribute("data-spork-score"))).toBeGreaterThan(0);
  await crush.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "2");

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "sorting");

  await keep.click();
  await crush.click();
  await crush.click();
  await keep.click();
  await expect(board).toHaveAttribute("data-sim-state", "shift");
  await expect(board).toHaveAttribute("data-spork-sorted", "6");

  await dialog.getByRole("button", { name: /Run shift 2/ }).click();
  await expect(board).toHaveAttribute("data-spork-shift", "2");
  await expect(board).toHaveAttribute("data-sim-state", "sorting");

  // Cracked hubcap, lighter, soda can — and then the object that will not sort.
  await crush.click();
  await keep.click();
  await crush.click();
  await expect(board).toHaveAttribute("data-sim-state", "spork");
  await expect(board).toHaveAttribute("data-spork-bins", "3");
  await expect(board).toHaveAttribute("data-spork-sorted", "9");

  // Neither half of the binary will take it: the belt does not advance.
  await keep.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "9");
  await crush.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "9");

  // The third bin does — and the belt immediately tests whether the new
  // category was a fluke by sending another object that needs it.
  const aside = dialog.getByRole("button", { name: "↓ Set aside" });
  await aside.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "10");
  await expect(board).toHaveAttribute("data-sim-state", "spork");
  await aside.click();
  await expect(board).toHaveAttribute("data-spork-sorted", "11");
  await expect(board).toHaveAttribute("data-sim-state", "sorting");
  // And it stays open for the rest of the run.
  await expect(aside).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

/**
 * The band invariant, and the reason this file has pixel readouts at all: the
 * hit test and the picture must be the same band. `data-dance-px` is where the
 * canvas actually painted WALL·E relative to where it actually painted the
 * centre of the ring, and `data-dance-band-px` is the ring it actually painted
 * — both in CSS pixels. `data-dance-band` is what the game scored and what the
 * HUD says. If those ever disagree (they did: position was stored as a fraction
 * of width and height while the ring was drawn on the shorter side, so a wide
 * canvas put WALL·E hundreds of pixels outside a ring it called "in"), this
 * fails.
 */
async function expectBandAgreesWithPicture(board: Locator, dialog: Locator) {
  // The pixel readouts land on the first painted frame, which may be one frame
  // behind the state the HUD already shows.
  await expect(board).toHaveAttribute("data-dance-px", /^-?\d+,-?\d+$/);
  const drawnAt = (await board.getAttribute("data-dance-px"))!.split(",").map(Number);
  const ring = (await board.getAttribute("data-dance-band-px"))!.split(",").map(Number);
  const band = await board.getAttribute("data-dance-band");
  const drawn = Math.hypot(drawnAt[0], drawnAt[1]);
  // One pixel of slack for the rounding in the published values.
  if (band === "in") {
    expect(drawn).toBeGreaterThanOrEqual(ring[0] - 1);
    expect(drawn).toBeLessThanOrEqual(ring[1] + 1);
  } else if (band === "close") {
    expect(drawn).toBeLessThanOrEqual(ring[0] + 1);
  } else {
    expect(drawn).toBeGreaterThanOrEqual(ring[1] - 1);
  }
  // And the words on screen say the same thing as the number.
  const readout = dialog.locator("span", { hasText: /^where/ });
  await expect(readout).toContainText(
    band === "in" ? "in the band" : band === "close" ? "too close" : "too wide"
  );
}

test("WALL·E · the dance holds the band and closes a movement", async ({ page }) => {
  // Deliberate mode: ← → swing around EVE by a fixed arc and advance the world
  // one second, so the band clock is countable instead of raced.
  const pill = page.getByRole("button", { name: "Define playing" });
  const dialog = await openFilmSim(page, {
    grade: "wall-e",
    pill: "Define playing",
    game: "space dance",
    dialog: "Space dance",
    reducedMotion: true,
  });
  // The reference card fronts every game — the allusion lands before the game.
  await expect(dialog.getByText("Define dancing.")).toBeVisible();
  await dialog.getByRole("button", { name: "Fire the extinguisher" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();

  const swing = dialog.getByRole("button", { name: "Swing clockwise" });
  const tighten = dialog.getByRole("button", { name: "Tighten the orbit" });
  const widen = dialog.getByRole("button", { name: "Widen the orbit" });
  await expect(board).toHaveAttribute("data-sim-state", "drifting");
  await expect(board).toHaveAttribute("data-dance-movement", "1");
  await expect(board).toHaveAttribute("data-orbit", "0.0");
  // The dance opens on the ring, and says so.
  await expect(board).toHaveAttribute("data-dance-band", "in");
  await expectBandAgreesWithPicture(board, dialog);

  await swing.click();
  await expect(board).toHaveAttribute("data-orbit", "1.0");
  await expectBandAgreesWithPicture(board, dialog);

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "drifting");

  // Three notches inward crosses the inner edge of the ring that is drawn, and
  // the readout has to cross with it.
  await tighten.click();
  await expect(board).toHaveAttribute("data-dance-band", "in");
  await expect(board).toHaveAttribute("data-orbit", "2.0");
  await tighten.click();
  await tighten.click();
  await expect(board).toHaveAttribute("data-dance-band", "close");
  await expectBandAgreesWithPicture(board, dialog);
  // Outside the band the clock stops climbing and bleeds back.
  expect(Number(await board.getAttribute("data-orbit"))).toBeLessThan(3);

  // Back out onto the ring, and the state flips back.
  await widen.click();
  await widen.click();
  await expect(board).toHaveAttribute("data-dance-band", "in");
  await expectBandAgreesWithPicture(board, dialog);

  // Five seconds in the band closes the first movement.
  await swing.click();
  await expect(board).toHaveAttribute("data-sim-state", "movement");
  expect(Number(await board.getAttribute("data-dance-score"))).toBeGreaterThan(0);
  // No plating drifts through the deliberate dance.
  await expect(board).toHaveAttribute("data-dance-hits", "0");

  await dialog.getByRole("button", { name: /Next movement/ }).click();
  await expect(board).toHaveAttribute("data-dance-movement", "2");
  await expect(board).toHaveAttribute("data-sim-state", "drifting");
  await expect(board).toHaveAttribute("data-orbit", "0.0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("WALL·E · the sprout survives the first wave and the scan fills", async ({ page }) => {
  // Deliberate mode: every input is one beat of the wave. The first wave's
  // columns never aim at the boot, so a clean run keeps all three lives.
  const pill = page.getByRole("button", { name: "Define playing" });
  const dialog = await openFilmSim(page, {
    grade: "wall-e",
    pill: "Define playing",
    game: "protect the sprout",
    dialog: "Protect the sprout",
    reducedMotion: true,
  });
  // The reference card fronts every game — the allusion lands before the game.
  await expect(dialog.getByText("Directive?")).toBeVisible();
  await dialog.getByRole("button", { name: "Raise the cover" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();

  const right = dialog.getByRole("button", { name: "Move WALL·E right" });
  const left = dialog.getByRole("button", { name: "Move WALL·E left" });
  const shield = dialog.getByRole("button", { name: "Toggle the shield" });

  await expect(board).toHaveAttribute("data-sim-state", "guarding");
  await expect(board).toHaveAttribute("data-sprout-wave", "1");
  await expect(board).toHaveAttribute("data-health", "3");
  await expect(board).toHaveAttribute("data-scan", "0");

  // Four beats of patrolling.
  for (let i = 0; i < 4; i += 1) await right.click();
  expect(Number(await board.getAttribute("data-scan"))).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "guarding");

  // The dome costs reserve while it is up — two beats of it, then back down.
  const fullReserve = Number(await board.getAttribute("data-shield"));
  await shield.click();
  await shield.click();
  expect(Number(await board.getAttribute("data-shield"))).toBeLessThan(fullReserve);

  // Ten beats fills the first wave's scan.
  for (let i = 0; i < 4; i += 1) await left.click();
  await expect(board).toHaveAttribute("data-sim-state", "wave");
  await expect(board).toHaveAttribute("data-health", "3");
  expect(Number(await board.getAttribute("data-sprout-score"))).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: /Next wave/ }).click();
  await expect(board).toHaveAttribute("data-sprout-wave", "2");
  await expect(board).toHaveAttribute("data-sim-state", "guarding");
  await expect(board).toHaveAttribute("data-scan", "0");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
