/**
 * Layout and tuning for "Up and down".
 *
 * The shaft is a stack of floors, and each floor is a corridor you walk along.
 * Vertical travel happens at the stairwell on that floor — and the stairwells
 * do not line up, so reaching a thing three floors below is a route, not a
 * held arrow key. Once you are under the surface you can swim straight up or
 * down anywhere, which is the bargain the flood offers: shortcuts, paid for in
 * breath.
 *
 * Layouts are fixed rather than random. The descent is meant to be a route you
 * learn and then run better, and a fixed board is also what makes the spec
 * deterministic.
 */

import { KEEPSAKES, type KeepsakeKind } from "@/components/film-experience/simulations/ParasiteStairsArt";

/** 0 is the semi-basement, FLOORS - 1 is the landing you carry things back to. */
export const FLOORS = 9;
export const LANDING = FLOORS - 1;
export const VISIBLE_FLOORS = 5.4;

/** How much load one person can take up the stairs at once. */
export const CAPACITY = 6;

/** Floors per second on the stairs, and corridor-widths per second walking. */
export const CLIMB_SPEED = 3.1;
export const WALK_SPEED = 0.72;
/** Everything is heavier and slower once you are in the water. */
export const SWIM_FACTOR = 0.74;
/** A full load costs this fraction of your speed. */
export const LOAD_DRAG = 0.55;

/** Seconds you can hold under before the water wins, in milliseconds. */
export const MAX_BREATH = 5200;
export const BREATH_REFILL = 2.4;

/** How close you must be to grab a keepsake, or to set foot on a stairwell. */
export const REACH_X = 0.075;
export const REACH_FLOOR = 0.42;
export const STAIR_X_TOLERANCE = 0.08;
/** Anything at or above this counts as standing on the landing. */
export const BANK_FLOOR = LANDING - 0.3;

/** One deliberate move in the reduced-motion mode: seconds of world time. */
export const STEP_SECONDS = 0.5;
export const STEP_FLOORS = 1;
export const STEP_X = 0.13;

/** Things taken from under the surface are worth more — that is the whole dive. */
export const SUBMERGED_BONUS = 1.5;

/**
 * Where the stairwell sits on each floor. Index f connects floor f to f + 1,
 * so the zigzag forces a walk across the corridor between every climb.
 */
export const STAIR_X: readonly number[] = [0.24, 0.74, 0.3, 0.68, 0.22, 0.78, 0.36, 0.64];

export const stairXBetween = (lower: number) =>
  STAIR_X[Math.max(0, Math.min(STAIR_X.length - 1, lower))];

export type StairsItem = Readonly<{
  kind: KeepsakeKind;
  floor: number;
  /** 0-1 across the corridor. */
  x: number;
}>;

export type StairsLevel = Readonly<{
  label: string;
  /** Floors per second the flood climbs. */
  rise: number;
  /** Where the water already is when the descent begins. */
  waterStart: number;
  /** Points that have to reach the landing for the descent to count. */
  target: number;
  items: readonly StairsItem[];
}>;

export const LEVELS: readonly StairsLevel[] = [
  {
    label: "the study",
    rise: 0.4,
    // A floor is already gone when you start — diving is not optional.
    waterStart: 1.0,
    target: 180,
    items: [
      { kind: "photo", floor: 6, x: 0.26 },
      { kind: "watch", floor: 5, x: 0.72 },
      { kind: "letter", floor: 3, x: 0.3 },
      { kind: "radio", floor: 2, x: 0.7 },
      { kind: "tin", floor: 1, x: 0.44 },
      { kind: "book", floor: 0, x: 0.24 },
    ],
  },
  {
    label: "the stairwell",
    rise: 0.48,
    waterStart: 1.8,
    target: 320,
    items: [
      { kind: "watch", floor: 7, x: 0.78 },
      { kind: "photo", floor: 6, x: 0.22 },
      { kind: "book", floor: 5, x: 0.5 },
      { kind: "letter", floor: 4, x: 0.74 },
      { kind: "radio", floor: 3, x: 0.26 },
      { kind: "tin", floor: 2, x: 0.66 },
      { kind: "stone", floor: 1, x: 0.38 },
    ],
  },
  {
    label: "the semi-basement",
    rise: 0.55,
    waterStart: 2.6,
    target: 420,
    items: [
      { kind: "letter", floor: 7, x: 0.24 },
      { kind: "photo", floor: 6, x: 0.7 },
      { kind: "watch", floor: 5, x: 0.34 },
      { kind: "book", floor: 4, x: 0.66 },
      { kind: "radio", floor: 3, x: 0.28 },
      { kind: "tin", floor: 2, x: 0.72 },
      { kind: "stone", floor: 0, x: 0.5 },
    ],
  },
];

/** Points for one keepsake, with the dive premium applied where it was earned. */
export const itemValue = (kind: KeepsakeKind, level: number, submerged: boolean) =>
  Math.round(
    KEEPSAKES[kind].value * (1 + level * 0.2) * (submerged ? SUBMERGED_BONUS : 1)
  );
