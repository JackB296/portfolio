"use client";

/**
 * The shape of the last good day: what has to be kept up, when each thing
 * lands on the pile, and how the day is rated once it ends. Kept beside the
 * game rather than inside it so the pacing can be read (and tuned) on its own.
 */

export type TaskId = "sauce" | "guns" | "drop" | "sky";

/** How a task is serviced — each one asks for a different kind of attention. */
export type TaskKind = "tap" | "hold" | "sequence" | "timing";

export type TaskDef = Readonly<{
  id: TaskId;
  label: string;
  /** Verb on the control. */
  action: string;
  /** Digit hotkey. */
  hotkey: string;
  kind: TaskKind;
  /** Fraction of the meter filled per second at zero paranoia. */
  rate: number;
  /** Seconds into the day this task joins the pile. */
  unlockAt: number;
  /** One line of onboarding, shown the first time the task appears. */
  hint: string;
}>;

export const TASKS: readonly TaskDef[] = [
  {
    id: "sauce",
    label: "The sauce",
    action: "Stir",
    hotkey: "1",
    kind: "tap",
    rate: 0.1,
    unlockAt: 0,
    hint: "Three stirs takes it off the burn. Tap it, don't hold it.",
  },
  {
    id: "guns",
    label: "The guns",
    action: "Wrap",
    hotkey: "2",
    kind: "hold",
    rate: 0.076,
    unlockAt: 7,
    hint: "Hold to wrap. Let go early and you only get part of it done.",
  },
  {
    id: "drop",
    label: "The drop",
    action: "Pack",
    hotkey: "3",
    kind: "sequence",
    rate: 0.062,
    unlockAt: 20,
    hint: "Pack it, wait for it to be ready, then send it. Two moves, not one.",
  },
  {
    id: "sky",
    label: "The sky",
    action: "Scan",
    hotkey: "4",
    kind: "timing",
    rate: 0.082,
    unlockAt: 36,
    hint: "Scan, then call it when the sweep crosses the thing you keep seeing.",
  },
];

export type DayBlock = Readonly<{ at: number; label: string }>;

/** Named stretches of the day, for the block banner and the summary. */
export const BLOCKS: readonly DayBlock[] = [
  { at: 0, label: "Morning · the sauce goes on" },
  { at: 7, label: "Late morning · the guns have to move" },
  { at: 20, label: "Afternoon · the drop is set for tonight" },
  { at: 36, label: "Evening · that helicopter again" },
  { at: 72, label: "Dusk · everybody is watching now" },
] as const;

/** The day runs this long; making it to the end is the win. */
export const DAY_SECONDS = 96;

export const DANGER = 0.84; // a meter above this is a near miss
export const PARANOIA_PUSH = 1.75; // how hard full paranoia speeds every clock

/**
 * Paranoia climbs on a curve, not a ramp: the first half of the day is almost
 * calm and the last stretch is where it runs away from you.
 */
export function paranoiaAt(elapsed: number) {
  const t = Math.min(1, elapsed / DAY_SECONDS);
  return Math.min(1, t * t * 0.85 + t * 0.2);
}

export function blockAt(elapsed: number) {
  let current = BLOCKS[0];
  for (const block of BLOCKS) if (elapsed >= block.at) current = block;
  return current;
}

export type DaySummary = Readonly<{
  grade: string;
  note: string;
}>;

/** What the day comes to. Survived time first, composure second. */
export function rateDay(
  survived: number,
  madeIt: boolean,
  bestStreak: number,
  nearMisses: number
): DaySummary {
  if (madeIt && nearMisses === 0)
    return { grade: "A+", note: "Sauce on, guns moved, drop made, and nobody looked up. Perfect day." };
  if (madeIt)
    return { grade: "A", note: "You made it to the end of the day. Rattled, but you made it." };
  const fraction = survived / DAY_SECONDS;
  if (fraction >= 0.75)
    return { grade: "B", note: "Almost the whole day. One thing too many at the wrong minute." };
  if (fraction >= 0.5)
    return { grade: "C", note: "Half a day. The helicopter was always going to win that one." };
  if (bestStreak >= 6)
    return { grade: "D", note: "Composed while it lasted, which was not long." };
  return { grade: "D", note: "It came apart early. Too many clocks, not enough hands." };
}

/** Points banked for a day: time on the clock, steadiness, and finishing it. */
export function dayScore(
  survived: number,
  serviced: number,
  bestStreak: number,
  madeIt: boolean
) {
  return Math.max(
    1,
    Math.round(survived * 8 + serviced * 6 + bestStreak * 15 + (madeIt ? 400 : 0))
  );
}
