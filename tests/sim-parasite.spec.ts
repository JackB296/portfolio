import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// The four Parasite games. Every assertion is either a fixed input sequence
// with a deterministic outcome or a loose bound — nothing here depends on
// winning a race against a timer.

test("Parasite · the con briefs the roster, judges a cover story, and pauses", async ({ page }) => {
  const pill = page.getByRole("button", { name: "You know what plan never fails?" });
  const dialog = await openFilmSim(page, {
    grade: "parasite",
    pill: "You know what plan never fails?",
    game: "the con",
    dialog: "The con",
  });
  // The reference card fronts every game — the allusion lands before the game.
  await expect(dialog.getByText("Jessica, only child, Illinois.")).toBeVisible();
  await dialog.getByRole("button", { name: "Work the door" }).click();
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-con-step", "who");

  // The whole point of the rewrite: a player who has never seen the film can
  // read every identity off the board, and the board never goes away.
  const dossiers = dialog.getByRole("region", {
    name: "Dossiers on the four people waiting to get in",
  });
  await expect(dossiers).toBeVisible();
  for (const person of ["Ki-woo", "Ki-jung", "Ki-taek", "Chung-sook"]) {
    await expect(dossiers.locator(`[data-con-person="${person}"]`)).toBeVisible();
  }
  await expect(dossiers.getByText(/way in:/).first()).toBeVisible();
  await expect(dossiers.getByText(/once inside:/).first()).toBeVisible();

  // Out of order first: the house doubts it, the con survives, and the reason
  // names the missing fact rather than assuming you know the plot.
  await dialog.getByRole("button", { name: "Place Ki-jung as the art therapist" }).click();
  await expect(board).toHaveAttribute("data-placed", "0");
  await expect(board).toHaveAttribute("data-sim-state", "placing");
  await expect(dialog.getByText(/Ki-jung cannot go yet/)).toBeVisible();
  const doubt = Number(await board.getAttribute("data-con-suspicion"));
  expect(doubt).toBeGreaterThan(0);

  // Then in order, and the cover story is a second decision.
  await dialog.getByRole("button", { name: "Place Ki-woo as the English tutor" }).click();
  await expect(board).toHaveAttribute("data-con-step", "cover");
  await dialog.getByRole("button", { name: /agency placed me/ }).click();
  await expect(board).toHaveAttribute("data-placed", "0");
  await dialog.getByRole("button", { name: /standing in for your son's tutor/ }).click();
  await expect(board).toHaveAttribute("data-placed", "1");
  await expect(board).toHaveAttribute("data-con-step", "who");
  expect(Number(await board.getAttribute("data-con-score"))).toBeGreaterThan(0);
  // The board tracks who is inside, so the next link in the chain is readable.
  await expect(dossiers.locator('[data-con-person="Ki-woo"]')).toHaveAttribute(
    "data-con-inside",
    "yes"
  );

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "placing");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Parasite · up and down routes both axes, banks a load, and clears a descent", async ({
  page,
}) => {
  // Reduced motion is this game's turn-based mode: one deliberate move per
  // press, and the water answers each one. Deterministic, and it exercises the
  // branch a motion-sensitive visitor actually plays.
  const pill = page.getByRole("button", { name: "You know what plan never fails?" });
  const dialog = await openFilmSim(page, {
    grade: "parasite",
    pill: "You know what plan never fails?",
    game: "up and down",
    dialog: "Up and down",
    start: "Take the stairs",
    reducedMotion: true,
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-sim-state", "running");
  await expect(board).toHaveAttribute("data-level", "1");
  await expect(board).toHaveAttribute("data-load", "0");

  // A press covers a fixed slice of world time rather than exactly one floor,
  // so position is polled toward rather than counted out. Both loops are
  // bounded, so a broken control fails the test instead of hanging it.
  const toFloor = async (target: number) => {
    for (let step = 0; step < 24; step += 1) {
      const floor = Number(await board.getAttribute("data-floor"));
      if (floor === target) return;
      await page.keyboard.press(floor > target ? "ArrowDown" : "ArrowUp");
    }
    throw new Error(`never reached floor ${target}`);
  };
  // data-lane is the position across the corridor in hundredths; the grab
  // radius is wider than this tolerance, so arriving is arriving.
  const toLane = async (target: number) => {
    for (let step = 0; step < 24; step += 1) {
      const lane = Number(await board.getAttribute("data-lane"));
      if (Math.abs(lane - target) <= 6) return;
      await page.keyboard.press(lane > target ? "ArrowLeft" : "ArrowRight");
    }
    throw new Error(`never reached lane ${target}`);
  };

  // Descending is not enough on its own — the framed photograph sits at the
  // far end of floor 6, so the second axis has to be walked.
  await toFloor(6);
  await expect(board).toHaveAttribute("data-carried", "0");
  await toLane(26);
  await expect(board).toHaveAttribute("data-carried", "1");
  // The photograph weighs two of the six units on your back.
  await expect(board).toHaveAttribute("data-load", "2");

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "running");

  // Reaching the landing banks the load and empties your back.
  await toFloor(8);
  await expect(board).toHaveAttribute("data-carried", "0");
  await expect(board).toHaveAttribute("data-load", "0");
  const firstBank = Number(await board.getAttribute("data-banked"));
  expect(firstBank).toBeGreaterThan(0);

  // A second trip, the other way across the shaft, clears the descent target.
  await toFloor(5);
  await toLane(72);
  await expect(board).toHaveAttribute("data-carried", "1");
  await toFloor(8);
  const target = Number(await board.getAttribute("data-target"));
  expect(Number(await board.getAttribute("data-banked"))).toBeGreaterThanOrEqual(target);

  // Target met, so leaving is now a choice rather than a wait.
  const escape = dialog.getByRole("button", { name: /Get out now/ });
  await expect(escape).toBeVisible();
  await escape.click();
  await expect(board).toHaveAttribute("data-sim-state", "landing");
  expect(Number(await board.getAttribute("data-stairs-score"))).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: /Down again/ }).click();
  await expect(board).toHaveAttribute("data-level", "2");
  await expect(board).toHaveAttribute("data-sim-state", "running");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Parasite · the wi-fi hunt sweeps warm and locks a bar", async ({ page }) => {
  // Reduced motion swaps the hold loop for a single deliberate press, which
  // makes the lock deterministic instead of a race against a timer.
  const pill = page.getByRole("button", { name: "You know what plan never fails?" });
  const dialog = await openFilmSim(page, {
    grade: "parasite",
    pill: "You know what plan never fails?",
    game: "the wi-fi hunt",
    dialog: "The Wi-Fi hunt",
    start: "Raise the phone",
    reducedMotion: true,
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-room", "1");
  const cold = Number(await board.getAttribute("data-wifi-signal"));

  const lock = dialog.getByRole("button", { name: "Hold to lock the signal" });
  // Cold, a lock attempt is refused and the room does not advance.
  await lock.click();
  await expect(board).toHaveAttribute("data-bars", "0");

  // The first room's router sits at a fixed spot: sweeping toward it is a
  // deterministic climb up the meter.
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
  const hot = Number(await board.getAttribute("data-wifi-signal"));
  expect(hot).toBeGreaterThan(cold);
  expect(hot).toBeGreaterThan(80);

  // One bar clears the first room and hands over the next.
  await lock.click();
  await expect(board).toHaveAttribute("data-bars", "1");
  await expect(board).toHaveAttribute("data-room", "2");
  expect(Number(await board.getAttribute("data-wifi-score"))).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "hunting");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Parasite · morse judges each symbol and counts strikes", async ({ page }) => {
  const pill = page.getByRole("button", { name: "You know what plan never fails?" });
  const dialog = await openFilmSim(page, {
    grade: "parasite",
    pill: "You know what plan never fails?",
    game: "morse in the dark",
    dialog: "Morse in the dark",
    start: "Watch the bulb",
  });
  const board = dialog.locator("[data-sim-state]");
  await expect(board).toBeVisible();

  // The bulb flickers first; the reply window opens on its own.
  await expect(board).toHaveAttribute("data-sim-state", "tapping");
  await expect(board).toHaveAttribute("data-round", "1");

  const dot = dialog.getByRole("button", { name: "Tap a dot" });
  const dash = dialog.getByRole("button", { name: "Tap a dash" });

  // Round one is ".-": dot, then dash.
  await dot.click();
  await expect(board).toHaveAttribute("data-morse-input", "1");
  await dash.click();
  await expect(board).toHaveAttribute("data-round", "2");
  expect(Number(await board.getAttribute("data-morse-score"))).toBeGreaterThan(0);

  // Round two is "-..": a dot first is judged wrong on the spot.
  await expect(board).toHaveAttribute("data-sim-state", "tapping");
  await dot.click();
  await expect(board).toHaveAttribute("data-strikes", "1");
  await expect(board).toHaveAttribute("data-morse-input", "0");

  await dialog.getByRole("button", { name: "pause" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "paused");
  await dialog.getByRole("button", { name: "resume" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "tapping");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
