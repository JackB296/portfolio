import { expect, test, type Page } from "@playwright/test";
import { openFilmSim } from "./helpers";

// Fury Road ships four games, and each one has two real halves: a live run and
// a turn-based half for reduced motion. Both are covered here. Everything
// asserted is a fixed sequence or a loose bound — the live halves are only ever
// checked for things that cannot depend on hitting a timing window, and the
// reduced-motion halves have no clock at all, so those runs are exact.

async function closeGame(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

/**
 * The live halves are one test per game, and each pauses immediately after
 * starting. Both choices matter: separate tests keep the wall clock down by
 * running in parallel, and pausing first means the run cannot have ended
 * underneath the assertions — a game that has already wrecked has no pause
 * button, and waiting on one is the only way this spec could hang.
 */
test.describe("live", () => {
  test("Fury Road: the war rig drives, pauses, and closes", async ({ page }) => {
    const rig = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "the war rig",
      dialog: "The war rig",
      start: "Hit the road",
    });
    const road = rig.locator("[data-sim-state]");
    await expect(road).toHaveAttribute("data-rig-mode", "chase");
    await expect(road).toHaveAttribute("data-sim-state", "running");
    await expect(road).toHaveAttribute("data-rig-hull", "3");

    await rig.getByRole("button", { name: "pause", exact: true }).click();
    await expect(road).toHaveAttribute("data-sim-state", "paused");
    await rig.getByRole("button", { name: "resume", exact: true }).click();
    await expect(road).toHaveAttribute("data-sim-state", "running");

    // Drive it: steer both ways and burn some boost. The road advances on its
    // own momentum, so climbing distance is the loose signal the loop is live.
    await rig.getByRole("button", { name: "Steer left" }).click();
    await rig.getByRole("button", { name: "Steer right" }).click();
    await rig.getByRole("button", { name: "Boost" }).click();
    await expect
      .poll(async () => Number(await road.getAttribute("data-rig-distance")), { timeout: 8_000 })
      .toBeGreaterThan(0);

    // The visible mute is a real toggle.
    await rig.getByRole("button", { name: "Mute sound" }).click();
    await expect(rig.getByRole("button", { name: "Unmute sound" })).toBeVisible();

    await closeGame(page, rig);
    await expect(page.getByRole("button", { name: "What a lovely day" })).toBeFocused();
  });

  test("Fury Road: witness me chromes up, leaps, and closes", async ({ page }) => {
    const witness = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "witness me",
      dialog: "Witness me",
      start: "Chrome up",
    });
    const pole = witness.locator("[data-sim-state]");
    await expect(pole).toHaveAttribute("data-witness-mode", "leap");
    await expect(pole).toHaveAttribute("data-sim-state", "chroming");
    await expect(pole).toHaveAttribute("data-witness-grip", "2");

    // Chrome first, jump second. Releasing the can sends the game to the aiming
    // beat — and the trailing click of that same gesture lands on the Leap
    // button that replaces it, so staying in "aiming" here is the assertion
    // that the stray click was rejected rather than spending a leap nobody made.
    await witness.getByRole("button", { name: "Chrome up" }).click();
    await expect(pole).toHaveAttribute("data-sim-state", "aiming");

    await witness.getByRole("button", { name: "pause", exact: true }).click();
    await expect(pole).toHaveAttribute("data-sim-state", "paused");
    await witness.getByRole("button", { name: "resume", exact: true }).click();
    await expect(pole).toHaveAttribute("data-sim-state", "aiming");

    // A real leap resolves one of several ways depending where the gap drifted.
    await witness.getByRole("button", { name: "Leap" }).click();
    await expect(pole).toHaveAttribute("data-sim-state", /chroming|flying|fallen|witnessed/);

    await closeGame(page, witness);
  });

  test("Fury Road: the polecat swings, pauses, and closes", async ({ page }) => {
    const polecat = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "polecat swing",
      dialog: "Polecat swing",
      start: "Man the pole",
    });
    const swing = polecat.locator("[data-sim-state]");
    await expect(swing).toHaveAttribute("data-polecat-mode", "swing");
    await expect(swing).toHaveAttribute("data-sim-state", "swinging");
    await expect(swing).toHaveAttribute("data-polecat-cargo", "1");

    await polecat.getByRole("button", { name: "pause", exact: true }).click();
    await expect(swing).toHaveAttribute("data-sim-state", "paused");
    await polecat.getByRole("button", { name: "resume", exact: true }).click();
    await expect(swing).toHaveAttribute("data-sim-state", "swinging");

    // Pump the arc, then reach. Where the bob is when the reach lands is a
    // matter of timing, so only the set of legal outcomes is asserted.
    await polecat.getByRole("button", { name: "Pump the swing" }).click();
    await polecat.getByRole("button", { name: "Reach for the cargo" }).click();
    await expect(swing).toHaveAttribute("data-sim-state", /swinging|carrying|fell/);

    await closeGame(page, polecat);
  });

  test("Fury Road: the storm run swerves, pauses, and closes", async ({ page }) => {
    const storm = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "into the storm",
      dialog: "Into the storm",
      start: "Drive in",
    });
    const front = storm.locator("[data-sim-state]");
    await expect(front).toHaveAttribute("data-storm-mode", "run");
    await expect(front).toHaveAttribute("data-sim-state", "running");
    await expect(front).toHaveAttribute("data-storm-lane", "2");
    await expect(front).toHaveAttribute("data-storm-hull", "3");

    await storm.getByRole("button", { name: "pause", exact: true }).click();
    await expect(front).toHaveAttribute("data-sim-state", "paused");
    await storm.getByRole("button", { name: "resume", exact: true }).click();
    await expect(front).toHaveAttribute("data-sim-state", "running");

    // Lane changes are exact: the rig starts centre of five and moves one at a
    // time. Nothing can strike this early — the first hazard needs a spawn
    // interval plus a full telegraph before it lands.
    await storm.getByRole("button", { name: "Swerve left" }).click();
    await expect(front).toHaveAttribute("data-storm-lane", "1");
    await storm.getByRole("button", { name: "Swerve right" }).click();
    await storm.getByRole("button", { name: "Swerve right" }).click();
    await expect(front).toHaveAttribute("data-storm-lane", "3");

    await expect
      .poll(async () => Number(await front.getAttribute("data-storm-time")), { timeout: 8_000 })
      .toBeGreaterThan(0);

    await closeGame(page, storm);
  });
});

test.describe("reduced motion", () => {
  // Reduced motion via openFilmSim: the project's device preset wins over a
  // fixture-level reducedMotion, so the media query has to be set directly.
  test("Fury Road: every game has a playable turn-based half", async ({ page }) => {
    // ---- the war rig, as a convoy plan -----------------------------------
    const rig = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "the war rig",
      dialog: "The war rig",
      start: "Hit the road",
      reducedMotion: true,
    });
    const road = rig.locator("[data-sim-state]");
    await expect(road).toHaveAttribute("data-rig-mode", "plan");
    await expect(road).toHaveAttribute("data-sim-state", "planning");
    await expect(road).toHaveAttribute("data-rig-blocked", "center");
    await expect(road).toHaveAttribute("data-rig-hull", "3");

    // Beat one blocks the centre and drops a canister on the right: the right
    // lane is clean, touches a blocked lane, and refuels — one squeak banked.
    await rig.getByRole("button", { name: /Take the right lane/ }).click();
    await expect(road).toHaveAttribute("data-rig-beat", "2");
    await expect(road).toHaveAttribute("data-rig-squeaks", "1");

    // Three deliberate rams take the hull down and end the run.
    await rig.getByRole("button", { name: /Take the left lane/ }).click();
    await expect(road).toHaveAttribute("data-rig-hull", "2");
    await rig.getByRole("button", { name: /Take the right lane/ }).click();
    await expect(road).toHaveAttribute("data-rig-hull", "1");
    await rig.getByRole("button", { name: /Take the centre lane/ }).click();
    await expect(road).toHaveAttribute("data-sim-state", "wrecked");
    expect(Number(await road.getAttribute("data-rig-score"))).toBeGreaterThan(0);

    // Restart is real: back to a full hull at wave one, beat one.
    await rig.getByRole("button", { name: "Roll out again" }).click();
    await expect(road).toHaveAttribute("data-sim-state", "planning");
    await expect(road).toHaveAttribute("data-rig-hull", "3");
    await expect(road).toHaveAttribute("data-rig-beat", "1");
    await closeGame(page, rig);

    // ---- witness me, as a called jump ------------------------------------
    const witness = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "witness me",
      dialog: "Witness me",
      start: "Chrome up",
      reducedMotion: true,
    });
    const pole = witness.locator("[data-sim-state]");
    await expect(pole).toHaveAttribute("data-witness-mode", "call");
    await expect(pole).toHaveAttribute("data-sim-state", "calling");
    await expect(pole).toHaveAttribute("data-witness-kind", "chrome");

    await witness.getByRole("button", { name: "A full coat, mouth and all" }).click();
    await expect(pole).toHaveAttribute("data-witness-kind", "leap");
    await witness.getByRole("button", { name: "Go now, straight across" }).click();
    await expect(pole).toHaveAttribute("data-witness-beat", "3");
    expect(Number(await pole.getAttribute("data-witness-points"))).toBeGreaterThan(0);

    // The third beat closes the first vehicle out and moves the boy up one.
    await witness.getByRole("button", { name: "Lead left, into the drift" }).click();
    await expect(pole).toHaveAttribute("data-witness-vehicle", "2");
    await expect(pole).toHaveAttribute("data-witness-streak", "2");
    await closeGame(page, witness);

    // ---- polecat swing, as a swing plan ----------------------------------
    const polecat = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "polecat swing",
      dialog: "Polecat swing",
      start: "Man the pole",
      reducedMotion: true,
    });
    const swing = polecat.locator("[data-sim-state]");
    await expect(swing).toHaveAttribute("data-polecat-mode", "plan");
    await expect(swing).toHaveAttribute("data-sim-state", "planning");
    await expect(swing).toHaveAttribute("data-polecat-arc", "2");
    await expect(swing).toHaveAttribute("data-polecat-band", "3,4");

    // One rung up puts the first crate in reach, and the deck is level there too.
    await polecat.getByRole("button", { name: /Pump one rung higher/ }).click();
    await expect(swing).toHaveAttribute("data-polecat-arc", "3");
    await polecat.getByRole("button", { name: "Reach for the cargo" }).click();
    await expect(swing).toHaveAttribute("data-polecat-carrying", "yes");
    await polecat.getByRole("button", { name: "Let the cargo go over the deck" }).click();
    await expect(swing).toHaveAttribute("data-polecat-delivered", "1");
    await expect(swing).toHaveAttribute("data-polecat-cargo", "2");
    await closeGame(page, polecat);

    // ---- into the storm, as a storm plan ---------------------------------
    const storm = await openFilmSim(page, {
      grade: "fury-road",
      pill: "What a lovely day",
      game: "into the storm",
      dialog: "Into the storm",
      start: "Drive in",
      reducedMotion: true,
    });
    const front = storm.locator("[data-sim-state]");
    await expect(front).toHaveAttribute("data-storm-mode", "plan");
    await expect(front).toHaveAttribute("data-sim-state", "planning");
    await expect(front).toHaveAttribute("data-storm-strike", "2");
    await expect(front).toHaveAttribute("data-storm-lane", "2");

    // Wave one, beat one takes the centre: anywhere else is a clean dodge.
    await storm.getByRole("button", { name: /Take the far left lane/ }).click();
    await expect(front).toHaveAttribute("data-storm-lane", "0");
    await expect(front).toHaveAttribute("data-storm-dodges", "1");
    await expect(front).toHaveAttribute("data-storm-hull", "3");

    // Beat two takes far left and left; bracing eats the hit for a grit.
    await expect(front).toHaveAttribute("data-storm-strike", "0,1");
    await storm.getByRole("button", { name: /Brace in the far left lane/ }).click();
    await expect(front).toHaveAttribute("data-storm-hull", "3");
    await expect(front).toHaveAttribute("data-storm-grit", "2");
    await expect(front).toHaveAttribute("data-storm-beat", "3");

    // And an unbraced lane that the front takes costs a plate.
    await expect(front).toHaveAttribute("data-storm-strike", "3,4");
    await storm.getByRole("button", { name: /Take the right lane/ }).click();
    await expect(front).toHaveAttribute("data-storm-hull", "2");
    await closeGame(page, storm);
  });
});
