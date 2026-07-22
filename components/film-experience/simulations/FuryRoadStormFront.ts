/**
 * The storm both halves of "into the storm" drive through: the wave table, the
 * hazard vocabulary, the scoring rule, and the deterministic front the
 * reduced-motion half plays.
 *
 * Three hazards, and each one telegraphs differently on purpose — a bolt takes
 * a whole lane, debris falls into one, and a whirl drifts a lane sideways
 * before it lands, so the safe lane moves while you are looking at it. Both
 * halves guarantee at least one lane is survivable on every beat: the storm is
 * meant to be read, not guessed.
 */

export const STORM_SCORE_ID = "fury-road-storm";

export const STORM_LANES = 5;
export const HULL_MAX = 3;
export const GRIT_MAX = 100;
/** Grit spent per second of bracing, and recovered per second out of it. */
export const BRACE_DRAIN = 34;
export const BRACE_REGAIN = 13;
export const DODGE_POINTS = 15;

export const LANE_NAMES = ["far left", "left", "centre", "right", "far right"] as const;

export type HazardKind = "bolt" | "debris" | "whirl";

export const HAZARD_LABEL: Record<HazardKind, string> = {
  bolt: "lightning",
  debris: "flung debris",
  whirl: "a whirl",
};

export type StormWave = Readonly<{
  label: string;
  /** Milliseconds of warning before a hazard lands. */
  telegraph: number;
  /** Milliseconds between spawns. */
  spawnMs: number;
  /** Which hazards this wave can throw. */
  kinds: readonly HazardKind[];
  /** Ceiling on the dust curtain's opacity during this wave. */
  dust: number;
}>;

/** Seconds each wave lasts before the next one rolls in. */
export const WAVE_SECONDS = 14;

export const STORM_WAVES: readonly StormWave[] = [
  { label: "the edge of it", telegraph: 1300, spawnMs: 1500, kinds: ["bolt"], dust: 0.12 },
  { label: "debris on the wind", telegraph: 1150, spawnMs: 1250, kinds: ["bolt", "debris"], dust: 0.22 },
  { label: "the first whirl", telegraph: 1000, spawnMs: 1050, kinds: ["bolt", "debris", "whirl"], dust: 0.32 },
  { label: "deep inside", telegraph: 880, spawnMs: 900, kinds: ["bolt", "debris", "whirl"], dust: 0.42 },
  { label: "the eye of it", telegraph: 760, spawnMs: 780, kinds: ["bolt", "debris", "whirl"], dust: 0.5 },
];

/** Which wave a run is in at a given elapsed time. One-based, capped. */
export function stormWaveAt(seconds: number) {
  return Math.min(STORM_WAVES.length, 1 + Math.floor(seconds / WAVE_SECONDS));
}

/**
 * The dust curtain: a rising floor with a slow swell over it, so visibility
 * comes and goes rather than only ever getting worse. Capped by the wave, and
 * hazards are always painted over it — the storm hides the road, never the
 * warning.
 */
export function dustDensity(seconds: number, wave: number) {
  const ceiling = STORM_WAVES[Math.min(wave, STORM_WAVES.length) - 1].dust;
  const swell = 0.5 + 0.5 * Math.sin(seconds * 0.55);
  return Math.min(ceiling, ceiling * (0.45 + 0.55 * swell));
}

/** Seconds held, paid out with a dodge bonus and a multiplier for the wave. */
export function stormRunScore(seconds: number, dodges: number, wave: number) {
  const base = Math.round(seconds * 10) + dodges * DODGE_POINTS;
  return Math.max(1, Math.round(base * (1 + (wave - 1) * 0.15)));
}

/** The line the run earns, so the ending is never just a number. */
export function stormRating(seconds: number, wave: number) {
  if (wave >= STORM_WAVES.length) return { grade: "Lovely day", note: "All the way into the eye of it and out the other side." };
  if (seconds >= 30) return { grade: "Held the line", note: "Deep into the front before it took the rig." };
  if (seconds >= 15) return { grade: "Rattled", note: "The storm found the rig, but not quickly." };
  return { grade: "Swallowed", note: "Straight into it and straight under. Read the warnings." };
}

// ---------------------------------------------------------------------------
// The reduced-motion half: the same front, called one beat at a time.
// ---------------------------------------------------------------------------

export type StormBeat = Readonly<{
  kind: HazardKind;
  /** What the storm is about to do, stated before it does it. */
  call: string;
  /** Lane indices the hazard lands on. Never all five. */
  strike: readonly number[];
}>;

/**
 * Five waves of scripted front. Every beat names the hazard and the lanes it
 * will take before the call is made, and every beat leaves at least two lanes
 * open — the same safe-lane guarantee the live gauntlet gets from its spawn
 * rules, so the plan is read-then-decide rather than a coin flip.
 */
export const STORM_SCRIPT: readonly (readonly StormBeat[])[] = [
  [
    { kind: "bolt", call: "A bolt is building over the centre lane.", strike: [2] },
    { kind: "bolt", call: "The charge walks left — far left and left are about to go.", strike: [0, 1] },
    { kind: "bolt", call: "It jumps to the right side of the front.", strike: [3, 4] },
    { kind: "bolt", call: "Centre and far right, together this time.", strike: [2, 4] },
  ],
  [
    { kind: "debris", call: "A wheel rim is tumbling down toward the left lane.", strike: [1] },
    { kind: "bolt", call: "Bolt over far left, and debris still falling into the centre.", strike: [0, 2] },
    { kind: "debris", call: "A sheet of roofing is coming down across the right pair.", strike: [3, 4] },
    { kind: "bolt", call: "Charge on the centre, debris on the far left.", strike: [0, 2] },
  ],
  [
    { kind: "whirl", call: "A whirl sits on the left and is drifting toward the centre — it will land on both.", strike: [1, 2] },
    { kind: "bolt", call: "Bolt over far right; the whirl has moved off.", strike: [4] },
    { kind: "whirl", call: "A whirl on the far right, drifting inward. Right and far right go.", strike: [3, 4] },
    { kind: "debris", call: "Debris across the centre, and a bolt on the far left.", strike: [0, 2] },
  ],
  [
    { kind: "whirl", call: "A whirl crosses from far left to left. Both are gone.", strike: [0, 1] },
    { kind: "bolt", call: "Bolts on the centre and the far right at once.", strike: [2, 4] },
    { kind: "whirl", call: "The whirl doubles back — left, centre, and right all go under.", strike: [1, 2, 3] },
    { kind: "debris", call: "Everything loose comes down on far left, left, and centre.", strike: [0, 1, 2] },
  ],
  [
    { kind: "whirl", call: "The eye. A whirl takes the centre three lanes.", strike: [1, 2, 3] },
    { kind: "bolt", call: "The rim of it lights up: far left, left, and far right.", strike: [0, 1, 4] },
    { kind: "debris", call: "The whole right side comes apart — centre, right, far right.", strike: [2, 3, 4] },
    { kind: "bolt", call: "Last of it: far left, centre, and far right.", strike: [0, 2, 4] },
  ],
];

export const PLAN_GRIT_MAX = 3;
/** Seconds of storm each called beat represents, for the shared score rule. */
export const PLAN_SECONDS_PER_BEAT = 3.5;
