/**
 * The road both halves of "the war rig" are driven down: the wave table, the
 * scoring rule, and the deterministic convoy script the reduced-motion half
 * plays. Keeping them here means the live chase and the turn-based plan reward
 * the same things and escalate on the same curve — the plan is the same game
 * called out one beat at a time, not a consolation prize.
 */

export const RIG_SCORE_ID = "fury-road-rig";

export const NEAR_MISS_POINTS = 25;
const WAVE_METERS = 340;

export type RigWave = Readonly<{
  label: string;
  /** Multiplier on the base road speed. */
  speed: number;
  /** Milliseconds between spawns. */
  spawnMs: number;
  /** How many hazards may share the road at once. */
  maxOnRoad: number;
  /** How hard a buzzard tracks the rig laterally. */
  flank: number;
  fuelChance: number;
  buzzardChance: number;
  interceptorChance: number;
}>;

export const WAVES: readonly RigWave[] = [
  {
    label: "open road",
    speed: 1,
    spawnMs: 900,
    maxOnRoad: 4,
    flank: 0.5,
    fuelChance: 0.22,
    buzzardChance: 0.12,
    interceptorChance: 0.16,
  },
  {
    label: "buzzards on the flank",
    speed: 1.14,
    spawnMs: 760,
    maxOnRoad: 5,
    flank: 0.75,
    fuelChance: 0.2,
    buzzardChance: 0.26,
    interceptorChance: 0.2,
  },
  {
    label: "the canyon run",
    speed: 1.28,
    spawnMs: 640,
    maxOnRoad: 6,
    flank: 0.95,
    fuelChance: 0.19,
    buzzardChance: 0.32,
    interceptorChance: 0.24,
  },
  {
    label: "war party",
    speed: 1.44,
    spawnMs: 540,
    maxOnRoad: 7,
    flank: 1.15,
    fuelChance: 0.18,
    buzzardChance: 0.36,
    interceptorChance: 0.28,
  },
  {
    label: "the long ride home",
    speed: 1.6,
    spawnMs: 460,
    maxOnRoad: 8,
    flank: 1.35,
    fuelChance: 0.18,
    buzzardChance: 0.4,
    interceptorChance: 0.3,
  },
];

/** Which wave a run is in at a given distance. One-based, capped at the table. */
export function rigWaveAt(meters: number) {
  return Math.min(WAVES.length, 1 + Math.floor(meters / WAVE_METERS));
}

/** Distance held, paid out with a squeak bonus and a multiplier for the wave. */
export function rigRunScore(meters: number, squeaks: number, wave: number) {
  const base = Math.round(meters) + squeaks * NEAR_MISS_POINTS;
  return Math.max(1, Math.round(base * (1 + (wave - 1) * 0.12)));
}

// ---------------------------------------------------------------------------
// The convoy plan: the reduced-motion half.
// ---------------------------------------------------------------------------

/** Where the rig sits across the road, and where a threat is called. */
export type Lane = "left" | "center" | "right";

export const LANES: readonly Lane[] = ["left", "center", "right"];

export type RigBeat = Readonly<{
  /** What the spotter calls: the state of the road one beat ahead. */
  call: string;
  /** Lanes that are impassable this beat. Never all three. */
  blocked: readonly Lane[];
  /** A lane holding a canister; sitting in it this beat buys fuel back. */
  canister?: Lane;
  /** Metres of road this beat covers. */
  meters: number;
}>;

/**
 * Five waves of scripted road. Each beat names the threat before it lands, so
 * the plan is read-then-decide rather than guess-then-hope, and every beat
 * leaves at least one lane open — the same safe-lane guarantee the live chase
 * gets from its spawn rules.
 */
export const RIG_SCRIPT: readonly (readonly RigBeat[])[] = [
  [
    { call: "Open road. A burnt hulk sits square in the centre lane.", blocked: ["center"], meters: 90, canister: "right" },
    { call: "Two wrecks off the left shoulder, nose to nose.", blocked: ["left"], meters: 95 },
    { call: "Wreckage strewn right; the left shoulder is clean sand.", blocked: ["right"], meters: 100 },
    { call: "A rolled interceptor blocks the centre. Canister on the left.", blocked: ["center"], meters: 105, canister: "left" },
  ],
  [
    { call: "Buzzards on the left flank, closing to ram.", blocked: ["left"], meters: 110 },
    { call: "They swing wide — the right flank fills, centre is a wreck field.", blocked: ["right", "center"], meters: 115 },
    { call: "One buzzard cuts back left, another blocks the centre.", blocked: ["left", "center"], meters: 120, canister: "right" },
    { call: "Right flank clears; the pack piles into the left and centre.", blocked: ["left", "center"], meters: 125 },
  ],
  [
    { call: "Canyon walls tighten. Rockfall takes the right lane out.", blocked: ["right"], meters: 130 },
    { call: "Boulder in the centre, buzzards riding the right wall.", blocked: ["center", "right"], meters: 135, canister: "left" },
    { call: "Left wall crumbles; the centre is the only clean line.", blocked: ["left", "right"], meters: 140 },
    { call: "Interceptors block left and centre. Hard right, now.", blocked: ["left", "center"], meters: 145 },
  ],
  [
    { call: "War party spreads across the left and centre.", blocked: ["left", "center"], meters: 150, canister: "right" },
    { call: "They rotate — right and centre are a wall of spikes.", blocked: ["right", "center"], meters: 155 },
    { call: "A lancer drops in the centre; both shoulders are open.", blocked: ["center"], meters: 160 },
    { call: "The pack collapses left and right. Thread the middle.", blocked: ["left", "right"], meters: 165, canister: "center" },
  ],
  [
    { call: "Home stretch. Wreckage right, buzzards centre.", blocked: ["right", "center"], meters: 170 },
    { call: "They swarm the left and centre for the last push.", blocked: ["left", "center"], meters: 175, canister: "right" },
    { call: "Both shoulders go under. The centre holds.", blocked: ["left", "right"], meters: 180 },
    { call: "The last rig cuts the centre. Either shoulder is open road.", blocked: ["center"], meters: 190 },
  ],
];

export const PLAN_FUEL_MAX = 100;
export const PLAN_FUEL_PER_BEAT = 9;
export const PLAN_FUEL_BOOST = 22;
export const PLAN_FUEL_CANISTER = 26;
export const PLAN_HULL_MAX = 3;
/** A boosted beat covers more road — the same trade the live boost makes. */
export const PLAN_BOOST_BONUS = 0.6;
