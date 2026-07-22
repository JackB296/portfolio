// Data for "The tourist" — the whole week is authored and deterministic so the
// trial stays learnable (and testable); nothing here is random. Seven support
// groups, each with its own room mood, sign-in sheet, name-tag options, and —
// on some nights — a probing question that forces a composure check. Marla's
// claims (blood parasites, bowel cancer, melanoma) drive the negotiation.

export const SCORE_ID = "fight-club-tourist";
export const COMPOSURE_START = 10;
export const BOWEL_INDEX = 3;

export type ProbeDef = Readonly<{
  question: string;
  /** Full oscillation period of the breath needle, ms. Shorter = harder. */
  periodMs: number;
  /** Half-width of the still band in needle units (needle runs -1..1). */
  zone: number;
}>;

export type NightDef = Readonly<{
  group: string;
  tell: string;
  /** Marla has already claimed this room; it has to end up hers. */
  marla: boolean;
  mood: string;
  chairs: number;
  /** How badly the room's fluorescent misbehaves, 0..1. */
  flicker: number;
  /** Names already on tonight's sign-in sheet — wearing one draws eyes. */
  sheet: readonly string[];
  /** Name-tag options: one guaranteed-fresh name, one sheet collision, and
   * one bait that an optimal player has already worn earlier in the week. */
  aliases: readonly string[];
  probe?: ProbeDef;
  /** Nights after Marla arrives: she is in the room, and lines get harder. */
  postMarla: boolean;
}>;

export const NIGHTS: readonly NightDef[] = [
  {
    group: "Remaining Men Together",
    tell: "We're still men. Just... remaining.",
    marla: false,
    mood: "basement fluorescents",
    chairs: 8,
    flicker: 0.35,
    sheet: ["Bob", "Paul"],
    aliases: ["Cornelius", "Bob", "Rupert"],
    postMarla: false,
  },
  {
    group: "Blood parasites",
    tell: "The parasites and I have made our peace.",
    marla: true,
    mood: "church annex",
    chairs: 7,
    flicker: 0.15,
    sheet: ["Chloe", "Glen"],
    aliases: ["Glen", "Travis", "Cornelius"],
    probe: { question: "Haven't I seen you somewhere else?", periodMs: 2600, zone: 0.34 },
    postMarla: false,
  },
  {
    group: "Tuberculosis",
    tell: "It's the cough at night that gives me away.",
    marla: false,
    mood: "hospital green",
    chairs: 9,
    flicker: 0.25,
    sheet: ["Lenny", "Sam"],
    aliases: ["Barry", "Lenny", "Rupert"],
    postMarla: false,
  },
  {
    group: "Ascending bowel cancer",
    tell: "I want bowel cancer.",
    marla: true,
    mood: "folding chairs, bad coffee",
    chairs: 8,
    flicker: 0.2,
    sheet: ["Marla", "Walter"],
    aliases: ["Walter", "Herman", "Travis"],
    probe: { question: "Which ward did they put you in?", periodMs: 2400, zone: 0.34 },
    postMarla: false,
  },
  {
    group: "Brain parasites",
    tell: "The scan lit up like a switchboard.",
    marla: false,
    mood: "strip-light hum",
    chairs: 6,
    flicker: 0.5,
    sheet: ["Chloe", "Denise"],
    aliases: ["Milo", "Denise", "Barry"],
    probe: { question: "You look well for brain parasites.", periodMs: 2000, zone: 0.28 },
    postMarla: true,
  },
  {
    group: "Melanoma",
    tell: "It started as a freckle I ignored.",
    marla: true,
    mood: "late room, low lamps",
    chairs: 7,
    flicker: 0.3,
    sheet: ["Glen", "Astrid"],
    aliases: ["Astrid", "Vance", "Herman"],
    probe: { question: "Where exactly was the freckle?", periodMs: 1800, zone: 0.28 },
    postMarla: true,
  },
  {
    group: "Sickle cell",
    tell: "Some nights the pain just hums along.",
    marla: false,
    mood: "last room of the week",
    chairs: 10,
    flicker: 0.6,
    sheet: ["Paul", "Vern"],
    aliases: ["Vern", "Otto", "Milo"],
    probe: { question: "Weren't you at melanoma last night?", periodMs: 1600, zone: 0.26 },
    postMarla: true,
  },
] as const;

// Options per night: the fitting cover plus lines borrowed from other rooms,
// with the right one seated at a fixed-but-varying slot. Post-Marla nights get
// an extra decoy — she is watching, and the room is harder to read.
export const LINE_OPTIONS: readonly (readonly string[])[] = NIGHTS.map((night, index) => {
  const offsets = night.postMarla ? [1, 3, 5] : [1, 3];
  const decoys = offsets.map((offset) => NIGHTS[(index + offset) % NIGHTS.length].tell);
  const options = [...decoys];
  options.splice(index % (decoys.length + 1), 0, night.tell);
  return options;
});

// Reduced-motion breath check: the needle steps through these fixed positions
// (one per "Breathe" press) instead of oscillating — deliberate, playable, and
// deterministic. Index 0 starts well outside every night's still band.
export const BREATH_STEPS = [0.85, 0.55, 0.3, 0.1, -0.15, -0.45, -0.75] as const;

export const MARLA_BEATS = [
  "She walks in mid-meeting. Sunglasses indoors. Smoking.",
  "She isn't dying either. Another tourist, working your circuit.",
  "Two fakers in one room — one of you flinches first.",
] as const;

export const MARLA_CHOICES = [
  { label: "Stare her down", log: "She stares back. Neither of you blinks. Understood." },
  { label: "Study the pamphlet", log: "You read the same line nine times. She smirks. Understood." },
] as const;

// Her side of the negotiation, keyed by room index. Only the bowel-cancer line
// is a quote; it stays inside the short-line allowance.
export const PUSHBACK: Readonly<Record<number, string>> = {
  1: "She leans over: the parasites are spoken for.",
  3: "“I want bowel cancer.”",
  5: "She taps the sheet: the freckle is hers.",
};

/** A room collides when you kept one she claimed, or handed her one she never
 * asked for. Either way the week doesn't settle. */
export function collisionAt(assignment: readonly ("mine" | "hers")[], index: number): boolean {
  return (assignment[index] === "mine") === NIGHTS[index].marla;
}

export function ratingFor(score: number): string {
  if (score >= 150) return "Faker of the year. Nobody slept better.";
  if (score >= 110) return "Convincing. The hugs were real, anyway.";
  if (score >= 70) return "You passed, barely. A tourist's tourist.";
  return "They let you stay out of pity.";
}
