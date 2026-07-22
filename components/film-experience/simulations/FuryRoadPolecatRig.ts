/**
 * The pole both halves of "polecat swing" ride: the cargo chain, the physics
 * constants the live swing integrates, the discrete ladder the reduced-motion
 * half climbs, and the one scoring rule they share.
 *
 * A cargo is always two decisions — reach it, then let it go over the deck —
 * because a polecat that only grabs is a polecat holding a crate over the
 * desert. Both halves spend those two decisions and pay out the same.
 */

export const POLECAT_SCORE_ID = "fury-road-polecat";

export const GRIP_MAX = 3;
/** Points a dead-on grab or release is worth before the chain multiplier. */
export const CARGO_BASE = 120;

// ---------------------------------------------------------------------------
// The live pendulum.
// ---------------------------------------------------------------------------

/** Gravity over pole length, in radians per second squared. */
export const GRAVITY_OVER_LENGTH = 7.4;
/**
 * Energy the pole bleeds to the wind every second. High enough that an
 * unattended arc visibly decays — the swing has to be maintained, not just
 * started — and low enough that two or three good pumps still climb a rung.
 */
export const DAMPING = 0.38;
/**
 * Angular acceleration a held pump adds, applied along the current swing.
 * Tuned so the arc takes roughly three seconds of pumping to reach the top
 * crate: fast enough to feel like effort pays, slow enough that holding the
 * control down is a way to whip yourself over the pivot rather than a strategy.
 */
export const PUMP_TORQUE = 2.6;
/** Beyond this the pole whips over the pivot and the rider is thrown. */
export const MAX_ANGLE = 1.5;
/** Grip spent per second of pumping, and returned by a clean grab. */
export const PUMP_GRIP_DRAIN = 9;
export const GRIP_UNIT = 100 / GRIP_MAX;

export type Cargo = Readonly<{
  label: string;
  /** Angle the cargo hangs at, in radians off vertical. */
  angle: number;
  /** Half-width of the reach around that angle, in radians. */
  reach: number;
  /** Angle over the rig deck the crate has to be let go at. */
  dropAngle: number;
  /** Half-width of the release window, in radians. */
  dropReach: number;
}>;

/**
 * Five crates, each hung higher than the last, so the swing has to be pumped
 * further every time — and the release window narrows as it goes.
 */
export const CARGOS: readonly Cargo[] = [
  { label: "a can of guzzoline", angle: 0.62, reach: 0.3, dropAngle: -0.5, dropReach: 0.3 },
  { label: "a crate of ammunition", angle: 0.82, reach: 0.26, dropAngle: -0.66, dropReach: 0.26 },
  { label: "the water barrel", angle: 1, reach: 0.22, dropAngle: -0.82, dropReach: 0.22 },
  { label: "a spare axle", angle: 1.16, reach: 0.19, dropAngle: -0.98, dropReach: 0.19 },
  { label: "the last of the seeds", angle: 1.3, reach: 0.16, dropAngle: -1.12, dropReach: 0.16 },
];

/** Points for one grab or release: how close it was, and the chain behind it. */
export function cargoScore(accuracy: number, chain: number) {
  return Math.max(1, Math.round(CARGO_BASE * accuracy * (1 + chain * 0.2)));
}

/** The whole run, banked. */
export function polecatRunScore(points: number, delivered: number) {
  return Math.max(1, Math.round(points * (1 + delivered * 0.12)));
}

/** The line the run earns, so the ending is never just a number. */
export function polecatRating(delivered: number) {
  if (delivered >= CARGOS.length)
    return { grade: "Full load", note: "Every crate off the pole and onto the deck." };
  if (delivered >= 3) return { grade: "Good hands", note: "Most of the load made it. The rig eats today." };
  if (delivered >= 1) return { grade: "One for the rig", note: "Something came down. Pump higher next time." };
  return { grade: "Empty pole", note: "Nothing delivered. Build the arc before you reach." };
}

// ---------------------------------------------------------------------------
// The reduced-motion half: the same pole, climbed a rung at a time.
// ---------------------------------------------------------------------------

/** The discrete arc: eight rungs of amplitude, with nine the whip-over. */
export const PLAN_MAX_ARC = 8;
export const PLAN_WHIP_ARC = 9;
export const PLAN_GRIP_MAX = 3;

export type PlanCargo = Readonly<{
  label: string;
  /** Arc rungs at which the crate is in reach. */
  reachAt: readonly number[];
  /** Arc rungs at which the crate can be let go over the deck. */
  dropAt: readonly number[];
  /** The spotter's line, so the requirement is always stated in words. */
  cue: string;
}>;

export const PLAN_CARGOS: readonly PlanCargo[] = [
  {
    label: "a can of guzzoline",
    reachAt: [3, 4],
    dropAt: [2, 3],
    cue: "The can swings level with the third rung of the arc. Get the pole up to three or four and reach.",
  },
  {
    label: "a crate of ammunition",
    reachAt: [4, 5],
    dropAt: [2, 3],
    cue: "The ammunition crate hangs a rung higher — four or five on the arc puts it in reach.",
  },
  {
    label: "the water barrel",
    reachAt: [5, 6],
    dropAt: [3, 4],
    cue: "The barrel is heavy and high. Five or six to reach it, and it needs height to clear the deck.",
  },
  {
    label: "a spare axle",
    reachAt: [6, 7],
    dropAt: [3, 4],
    cue: "The axle is lashed near the top. Six or seven — and the pole is starting to complain.",
  },
  {
    label: "the last of the seeds",
    reachAt: [7, 8],
    dropAt: [4, 5],
    cue: "The seeds are at the very top. Seven or eight, and one rung more whips the pole over.",
  },
];

/** How close a called arc was to the band it needed to be in. */
export function planAccuracy(arc: number, band: readonly number[]) {
  if (band.includes(arc)) {
    // Dead centre of the band pays full; its edges pay a shade less.
    const middle = (band[0] + band[band.length - 1]) / 2;
    return 1 - Math.abs(arc - middle) * 0.12;
  }
  return 0;
}
