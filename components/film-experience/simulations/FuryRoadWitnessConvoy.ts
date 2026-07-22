/**
 * The convoy both halves of "witness me" leap across: the vehicle table the
 * live run sweeps, the scripted calls the reduced-motion half plays, and the
 * one scoring rule they share.
 *
 * A leap is always two decisions — chrome first, then the jump — because the
 * ritual is half the moment. The live half spends them as a hold-release and a
 * tap; the plan half spends them as two called beats. Both pay out the same.
 */

export const WITNESS_SCORE_ID = "fury-road-witness";

export const GRIP_MAX = 2;
/** Points a dead-centre leap is worth before chrome and streak multipliers. */
export const LEAP_BASE = 100;

// ---------------------------------------------------------------------------
// The live convoy.
// ---------------------------------------------------------------------------

export type Vehicle = Readonly<{
  label: string;
  /** Sweeps per second of the jumper's marker across the track. */
  sweep: number;
  /** Half-width of the gap, as a fraction of the track. */
  gapHalf: number;
  /** How far the wind drags the gap off centre, as a fraction of the track. */
  wind: number;
  /** Radians per second of the vehicle's sway, which breathes the gap width. */
  sway: number;
  /** Milliseconds of chrome-can hold that lands the perfect coat. */
  chromePeak: number;
}>;

export const VEHICLES: readonly Vehicle[] = [
  { label: "the pursuit car", sweep: 0.5, gapHalf: 0.16, wind: 0.05, sway: 1.1, chromePeak: 900 },
  { label: "the spiked buggy", sweep: 0.62, gapHalf: 0.13, wind: 0.09, sway: 1.5, chromePeak: 850 },
  { label: "the gun tub", sweep: 0.76, gapHalf: 0.11, wind: 0.13, sway: 1.9, chromePeak: 800 },
  { label: "the war rig itself", sweep: 0.92, gapHalf: 0.09, wind: 0.17, sway: 2.4, chromePeak: 750 },
];

/** Tolerance either side of the gap that counts as a slip rather than a fall. */
export const SLIP_BAND = 0.07;
/** How long a chrome hold may run before the can floods and auto-releases. */
export const CHROME_MAX_MS = 2200;

/** A chrome hold, scored as a multiplier on the leap that follows. */
export function chromeMultiplier(heldMs: number, peakMs: number) {
  if (heldMs >= CHROME_MAX_MS) return 0.5; // flooded — chrome everywhere but the face
  const offset = Math.abs(heldMs - peakMs) / peakMs;
  if (offset <= 0.18) return 2;
  if (offset <= 0.45) return 1.4;
  return 0.7;
}

/** A short word for how the coat came out, so the state reads without color. */
export function chromeNote(multiplier: number) {
  if (multiplier >= 2) return "shiny and chrome";
  if (multiplier >= 1.4) return "a good coat";
  if (multiplier >= 0.7) return "a thin coat";
  return "flooded";
}

/** Points for one leap: accuracy, the coat, and the streak behind it. */
export function leapScore(accuracy: number, chrome: number, streak: number) {
  return Math.max(1, Math.round(LEAP_BASE * accuracy * chrome * (1 + streak * 0.15)));
}

/** The whole run, banked. */
export function witnessRunScore(points: number, vehiclesCrossed: number) {
  return Math.max(1, Math.round(points * (1 + vehiclesCrossed * 0.1)));
}

/** The line the run earns, so the ending is never just a number. */
export function witnessRating(vehiclesCrossed: number, bestStreak: number) {
  if (vehiclesCrossed >= VEHICLES.length)
    return { grade: "Historic", note: "The whole convoy crossed. They will remember it." };
  if (vehiclesCrossed >= 3)
    return { grade: "Witnessed", note: "Far enough up the convoy that somebody saw it." };
  if (bestStreak >= 2)
    return { grade: "Chrome", note: "A clean chain, cut short. The next one goes further." };
  return { grade: "Mediocre", note: "Off the pole and under the wheels. Chrome up and go again." };
}

// ---------------------------------------------------------------------------
// The reduced-motion half: the same convoy, called one beat at a time.
// ---------------------------------------------------------------------------

export type CallOption = Readonly<{
  label: string;
  /** What the call bought, in plain words. */
  outcome: string;
  /** Multiplier on the leap this beat feeds, or on the leap itself. */
  factor: number;
  /** Grip spent on this call. A run has GRIP_MAX to give before it falls. */
  grip: number;
}>;

export type CallBeat = Readonly<{
  kind: "chrome" | "leap";
  /** The conditions, stated before the call is made. */
  cue: string;
  options: readonly CallOption[];
}>;

/**
 * Four vehicles, three called beats each: chrome the face, then read the gap
 * twice. Every option states what it buys, so the plan is read-then-decide.
 * The best call is not always first — the caller rotates the list per beat.
 */
export const WITNESS_CALLS: readonly (readonly CallBeat[])[] = [
  [
    {
      kind: "chrome",
      cue: "The can is full and the convoy is steady. How much chrome goes on?",
      options: [
        { label: "A full coat, mouth and all", outcome: "Shiny and chrome. The nerve holds.", factor: 2, grip: 0 },
        { label: "A quick spray and go", outcome: "A thin coat — enough to jump on, not enough to be sure.", factor: 1, grip: 0 },
        { label: "Empty the can", outcome: "Flooded. Chrome in the eyes, and a beat wasted wiping it.", factor: 0.5, grip: 1 },
      ],
    },
    {
      kind: "leap",
      cue: "The pursuit car runs level and wide. The gap is holding open.",
      options: [
        { label: "Go now, straight across", outcome: "Dead centre of the gap. Clean.", factor: 1, grip: 0 },
        { label: "Wait for it to widen further", outcome: "It never does — the crossing is rushed at the edge.", factor: 0.5, grip: 1 },
        { label: "Push off the pole hard", outcome: "Overshot the mark, but a hand catches the rail.", factor: 0.7, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "A gust crosses the convoy and drags the gap to the left.",
      options: [
        { label: "Lead left, into the drift", outcome: "The wind carries the jump right into the gap.", factor: 1, grip: 0 },
        { label: "Aim where the gap was", outcome: "The gap has already moved. A boot lands on the edge.", factor: 0.4, grip: 1 },
        { label: "Ride the gust out first", outcome: "Safe, but the moment passed — a shorter jump than it should be.", factor: 0.6, grip: 0 },
      ],
    },
  ],
  [
    {
      kind: "chrome",
      cue: "Half a can left, and the buggy is bucking on the ruts.",
      options: [
        { label: "Coat the mouth, save the rest", outcome: "A good coat, and something in reserve.", factor: 1.6, grip: 0 },
        { label: "Nothing — go on nerve alone", outcome: "No chrome, no ceremony. The nerve wavers.", factor: 0.6, grip: 0 },
        { label: "Everything that is left", outcome: "Flooded again. The can is dead weight now.", factor: 0.5, grip: 1 },
      ],
    },
    {
      kind: "leap",
      cue: "The buggy's spikes rake the gap every time it hits a rut.",
      options: [
        { label: "Go the instant the spikes drop", outcome: "Straight through behind the rake. Nothing touched.", factor: 1, grip: 0 },
        { label: "Go over the top of them", outcome: "High and slow — the landing is short and hard.", factor: 0.6, grip: 1 },
        { label: "Wait for a smooth stretch", outcome: "There is none. The jump goes late.", factor: 0.5, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "The buggy drifts wide, then snaps back. The gap breathes.",
      options: [
        { label: "Go on the snap back", outcome: "The gap closes onto the landing. Perfectly timed.", factor: 1, grip: 0 },
        { label: "Go on the drift out", outcome: "The gap is widening away — the jump falls short.", factor: 0.4, grip: 1 },
        { label: "Split the difference", outcome: "Halfway is nowhere, but a rail is a rail.", factor: 0.7, grip: 0 },
      ],
    },
  ],
  [
    {
      kind: "chrome",
      cue: "The can spits. The gun tub is throwing dust straight back at you.",
      options: [
        { label: "Shield it and coat clean", outcome: "A good coat despite the dust.", factor: 1.6, grip: 0 },
        { label: "Spray into the dust", outcome: "Half of it blows away. A thin coat.", factor: 0.8, grip: 0 },
        { label: "Throw the can and go", outcome: "No chrome at all — but the hands are free.", factor: 0.7, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "The tub's gunner swings the barrel across the gap on every pass.",
      options: [
        { label: "Go under the barrel's swing", outcome: "Low and fast, straight beneath it.", factor: 1, grip: 0 },
        { label: "Go as it swings toward you", outcome: "The barrel catches a shoulder mid-air.", factor: 0.3, grip: 1 },
        { label: "Wait a full swing, then go", outcome: "Correct, but the convoy has pulled ahead a length.", factor: 0.7, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "Crosswind, hard and steady, and the tub is running fast.",
      options: [
        { label: "Lead into the wind and commit", outcome: "The line holds all the way across.", factor: 1, grip: 0 },
        { label: "Jump flat and hope", outcome: "The wind takes the jump sideways onto the edge.", factor: 0.4, grip: 1 },
        { label: "Crouch and go short", outcome: "Short but safe — a hand on the running board.", factor: 0.6, grip: 0 },
      ],
    },
  ],
  [
    {
      kind: "chrome",
      cue: "One last mouthful of chrome, and the rig is right there.",
      options: [
        { label: "The full ritual, one last time", outcome: "Shiny and chrome. Everything on this jump.", factor: 2, grip: 0 },
        { label: "Skip it, the rig will not wait", outcome: "No coat. The jump is all nerve now.", factor: 0.7, grip: 0 },
        { label: "Half a coat, hedge it", outcome: "A thin coat and a half-committed jump.", factor: 1, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "The rig's tanker sways wide. The gap opens and shuts like a jaw.",
      options: [
        { label: "Go at the top of the sway", outcome: "The gap is at its widest. Straight through.", factor: 1, grip: 0 },
        { label: "Go at the bottom", outcome: "The jaw shuts on the jump. A boot catches the plate.", factor: 0.3, grip: 1 },
        { label: "Ride one more sway first", outcome: "The rig pulls away a length. The jump goes long.", factor: 0.6, grip: 0 },
      ],
    },
    {
      kind: "leap",
      cue: "Last gap. Dust everywhere, and nothing to hold but the rail.",
      options: [
        { label: "Witness me — go", outcome: "Across. Both hands on the rail of the war rig.", factor: 1, grip: 0 },
        { label: "Check the landing first", outcome: "The dust never clears. The jump goes blind and late.", factor: 0.5, grip: 1 },
        { label: "Go off the pole's rebound", outcome: "The rebound throws the jump long, but it lands.", factor: 0.8, grip: 0 },
      ],
    },
  ],
];
