// The day's ghost-writing slate for "Compose a letter" (Her). Three
// commissions, each wanting a different register: 1 is reserved, 2 is tender,
// 3 is unguarded. Sincerity is closeness to the commission's register — the
// anniversary wants everything, the apology curdles if it performs. Data and
// scoring live here so the component stays a surface.

export type Register = 1 | 2 | 3;

export type PhrasingOption = Readonly<{ text: string; register: Register }>;

export type LetterSlot = Readonly<{
  lead: string;
  options: readonly [PhrasingOption, PhrasingOption, PhrasingOption];
}>;

export type Commission = Readonly<{
  id: string;
  client: string;
  brief: string;
  target: Register;
  guardedNote: string;
  performedNote: string;
  slots: readonly LetterSlot[];
}>;

export const REGISTER_LABELS: Readonly<Record<Register, string>> = {
  1: "reserved",
  2: "tender",
  3: "unguarded",
};

export const SEAL_THRESHOLD = 70;

export const COMMISSIONS: readonly Commission[] = [
  {
    id: "anniversary",
    client: "Roberto → Maria · their fiftieth anniversary",
    brief: "He wants her to hear the whole heart. Nothing held back.",
    target: 3,
    guardedNote:
      "Maria will read this like a receipt. Fifty years — open the door all the way.",
    performedNote:
      "Somehow it still reads careful. Let it be embarrassing; she has earned that.",
    slots: [
      {
        lead: "Maria, my Maria,",
        options: [
          { text: "another year has gone by for us.", register: 1 },
          { text: "fifty years, and your name still feels new.", register: 2 },
          {
            text: "fifty years, and I still lose my place when you laugh.",
            register: 3,
          },
        ],
      },
      {
        lead: "I keep thinking of",
        options: [
          { text: "the wedding, which went well.", register: 1 },
          { text: "the yellow kitchen, and you singing off-key.", register: 2 },
          {
            text: "dancing at two a.m., both of us terrible at it.",
            register: 3,
          },
        ],
      },
      {
        lead: "What I know now is",
        options: [
          { text: "that marriage takes work.", register: 1 },
          { text: "that home was never the house.", register: 2 },
          {
            text: "that every version of my life without you goes dark.",
            register: 3,
          },
        ],
      },
      {
        lead: "Yours,",
        options: [
          { text: "as ever. — 612", register: 1 },
          { text: "still, and gladly. — 612", register: 2 },
          { text: "for the next fifty, starting tonight. — 612", register: 3 },
        ],
      },
    ],
  },
  {
    id: "apology",
    client: "Clara → her sister Rosa · after the argument",
    brief: "She wants to say sorry without performing it. Too much reads as theater.",
    target: 2,
    guardedNote:
      "Rosa will hear a memo, not a sister. Warm it up — carefully.",
    performedNote:
      "Rosa will know it is not Clara. Ease off the violins; sorry is quiet.",
    slots: [
      {
        lead: "Rosa,",
        options: [
          { text: "this letter is overdue.", register: 1 },
          { text: "I have started this letter four times.", register: 2 },
          { text: "my heart has been in pieces since Tuesday.", register: 3 },
        ],
      },
      {
        lead: "About what I said —",
        options: [
          { text: "we both said things.", register: 1 },
          { text: "I said it to win, and I am not proud of that.", register: 2 },
          { text: "I will never, ever forgive myself.", register: 3 },
        ],
      },
      {
        lead: "What I want is",
        options: [
          { text: "to move past this.", register: 1 },
          { text: "one slow coffee, and I will mostly listen.", register: 2 },
          { text: "to swear on everything that I am reborn.", register: 3 },
        ],
      },
      {
        lead: "Your sister,",
        options: [
          { text: "regardless. — 612", register: 1 },
          { text: "the stubborn one, still yours. — 612", register: 2 },
          { text: "who loves you more than air itself. — 612", register: 3 },
        ],
      },
    ],
  },
  {
    id: "distance",
    client: "David → Amelia · nine time zones apart",
    brief: "Steady, warm, certain. Grand gestures only make the distance louder.",
    target: 2,
    guardedNote:
      "Amelia gets enough weather reports. Give her something to keep.",
    performedNote:
      "All this ache will make her worry. Steady hands — the distance is temporary.",
    slots: [
      {
        lead: "Amelia,",
        options: [
          { text: "I hope the new city is treating you well.", register: 1 },
          {
            text: "your morning is my midnight, and I kind of love that.",
            register: 2,
          },
          { text: "every second apart is an ocean of ache.", register: 3 },
        ],
      },
      {
        lead: "Today I",
        options: [
          { text: "was busy, but fine.", register: 1 },
          {
            text: "saved three small things to tell you — remind me about the dog.",
            register: 2,
          },
          { text: "could not eat or think for missing you.", register: 3 },
        ],
      },
      {
        lead: "Until December,",
        options: [
          { text: "we will manage.", register: 1 },
          { text: "I am keeping your side of the winter warm.", register: 2 },
          { text: "I will count every one of the two million seconds.", register: 3 },
        ],
      },
      {
        lead: "Sending this",
        options: [
          { text: "with my regards. — 612", register: 1 },
          { text: "with the porch light on. — 612", register: 2 },
          { text: "with all the love in the spinning world. — 612", register: 3 },
        ],
      },
    ],
  },
];

export type LetterDrift = "guarded" | "true" | "performed";

export type LetterReading = Readonly<{
  sincerity: number;
  drift: LetterDrift;
  resonant: boolean;
  whiplash: boolean;
}>;

/** One beat's contribution to sincerity: closeness to the target register. */
function beatScore(register: number, target: number): number {
  const distance = Math.abs(register - target);
  return distance === 0 ? 25 : distance === 1 ? 12 : 0;
}

/**
 * Score a fully chosen letter against its commission. Each beat earns by
 * closeness to the target register; an opener and signoff in the same register
 * ring true for a bonus; jumping two registers between adjacent beats is
 * tonal whiplash. Drift names which way the letter leans overall.
 */
export function readLetter(
  commission: Commission,
  picks: readonly number[]
): LetterReading {
  const registers = picks.map(
    (pick, index) => commission.slots[index].options[pick].register
  );
  let score = 0;
  for (const register of registers) {
    score += beatScore(register, commission.target);
  }
  const resonant = registers[0] === registers[registers.length - 1];
  if (resonant) score += 8;
  let whiplash = false;
  for (let i = 1; i < registers.length; i++) {
    if (Math.abs(registers[i] - registers[i - 1]) === 2) {
      score -= 6;
      whiplash = true;
    }
  }
  const sincerity = Math.max(0, Math.min(100, score));
  const average =
    registers.reduce<number>((sum, register) => sum + register, 0) /
    registers.length;
  const drift: LetterDrift =
    average < commission.target - 0.4
      ? "guarded"
      : average > commission.target + 0.4
        ? "performed"
        : "true";
  return { sincerity, drift, resonant, whiplash };
}

/** Running sincerity while the letter is still being chosen. */
export function partialSincerity(
  commission: Commission,
  picks: readonly (number | null)[]
): number {
  const chosen = picks
    .map((pick, index) =>
      pick === null ? null : ([index, pick] as const)
    )
    .filter((entry): entry is readonly [number, number] => entry !== null);
  let score = 0;
  for (const [slot, pick] of chosen) {
    score += beatScore(
      commission.slots[slot].options[pick].register,
      commission.target
    );
  }
  return Math.min(100, score);
}

/** Average register of the beats chosen so far, or null before any pick. */
export function currentLean(
  commission: Commission,
  picks: readonly (number | null)[]
): number | null {
  const registers = picks
    .map((pick, index) =>
      pick === null ? null : commission.slots[index].options[pick].register
    )
    .filter((register): register is Register => register !== null);
  if (registers.length === 0) return null;
  return (
    registers.reduce<number>((sum, register) => sum + register, 0) /
    registers.length
  );
}

/** Hearts out of five for a sealed letter. */
export function heartsFor(sincerity: number): number {
  if (sincerity >= 95) return 5;
  if (sincerity >= 82) return 4;
  return 3;
}
