"use client";

// The readable half of Translate. A logogram in this game is never a random
// squiggle: it is a radical (which family of meaning it belongs to) plus a
// countable number of strokes (which word inside that family). Both are drawn
// large enough to read, both are named in the accessible label, and both are
// listed in the key the player keeps open beside the message. Deduction is
// therefore possible from the first mark — no memorising, no brute force.

/** The four radicals. A logogram carries exactly one. */
export type Family = "kin" | "cycle" | "exchange" | "craft";

export type FamilyInfo = Readonly<{
  label: string;
  /** How the radical is drawn, in words — the aria label and the key both use
   * this, so a screen reader gets the same evidence the eye does. */
  radical: string;
  /** What the family means, so the key teaches rather than just indexes. */
  sense: string;
}>;

export const FAMILIES: Readonly<Record<Family, FamilyInfo>> = {
  kin: { label: "kin", radical: "three dots on the upper arc", sense: "someone who speaks" },
  cycle: { label: "cycle", radical: "a closed inner ring", sense: "time and its turnings" },
  exchange: { label: "exchange", radical: "an open hook", sense: "giving, taking, asking" },
  craft: { label: "craft", radical: "a bar across the centre", sense: "a made thing" },
};

export type Word = Readonly<{
  id: string;
  label: string;
  family: Family;
  /** One, two, or three ticks below the ring. Unique within a family. */
  strokes: number;
}>;

/** Twelve words: four families of three, so family narrows and strokes decide. */
export const WORDS: readonly Word[] = [
  { id: "human", label: "human", family: "kin", strokes: 1 },
  { id: "louise", label: "Louise", family: "kin", strokes: 2 },
  { id: "heptapod", label: "heptapod", family: "kin", strokes: 3 },
  { id: "now", label: "now", family: "cycle", strokes: 1 },
  { id: "time", label: "time", family: "cycle", strokes: 2 },
  { id: "end", label: "end", family: "cycle", strokes: 3 },
  { id: "offer", label: "offer", family: "exchange", strokes: 1 },
  { id: "gift", label: "gift", family: "exchange", strokes: 2 },
  { id: "ask", label: "ask", family: "exchange", strokes: 3 },
  { id: "tool", label: "tool", family: "craft", strokes: 1 },
  { id: "weapon", label: "weapon", family: "craft", strokes: 2 },
  { id: "ship", label: "ship", family: "craft", strokes: 3 },
];

const BY_ID = new Map(WORDS.map((word) => [word.id, word]));

/** Every id below is a literal from WORDS, so this never misses. */
export function word(id: string): Word {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown logogram word: ${id}`);
  return found;
}

export type Message = Readonly<{
  /** The message, in order. No word repeats inside one message. */
  words: readonly string[];
  /** What the decoded sequence means, shown once it holds. */
  gloss: string;
  /** The readings on the table — always a superset of `words`, and always
   * seeded with same-family neighbours so strokes have to be counted. */
  candidates: readonly string[];
  /** Generous by design: the challenge is reading, not speed. */
  seconds: number;
}>;

export const MESSAGES: readonly Message[] = [
  {
    words: ["heptapod", "offer", "tool"],
    gloss: "The heptapods offer a tool.",
    candidates: ["human", "heptapod", "offer", "gift", "tool", "weapon"],
    seconds: 240,
  },
  {
    words: ["human", "ask", "heptapod", "now"],
    gloss: "The humans are asking the heptapods now.",
    candidates: ["human", "louise", "heptapod", "ask", "offer", "now", "time"],
    seconds: 240,
  },
  {
    words: ["heptapod", "gift", "human", "time"],
    gloss: "The heptapods give humanity time.",
    candidates: ["human", "louise", "heptapod", "offer", "gift", "now", "time", "ship"],
    seconds: 260,
  },
  {
    words: ["louise", "ask", "heptapod", "offer", "weapon"],
    gloss: "Louise asks whether the heptapods offer a weapon.",
    candidates: ["human", "louise", "heptapod", "ask", "gift", "offer", "time", "tool", "weapon"],
    seconds: 300,
  },
];

const COUNT = ["no", "one", "two", "three", "four"] as const;

/** "two" rather than "2": the note is read aloud as often as it is seen. */
export const countWord = (n: number) => COUNT[n] ?? String(n);

/**
 * Why a guess was wrong, in terms the player can act on. Never names the right
 * answer — it names the evidence that rules the wrong one out, so the next
 * guess is deduction rather than another shot in the dark.
 */
export function mismatchReason(guess: Word, actual: Word) {
  if (guess.family !== actual.family) {
    return `No — this mark carries ${FAMILIES[actual.family].radical}, the ${FAMILIES[actual.family].label} radical. "${guess.label}" is ${FAMILIES[guess.family].label}.`;
  }
  return `Right family, wrong count: this ring has ${countWord(actual.strokes)} strokes, and "${guess.label}" is written with ${countWord(guess.strokes)}.`;
}

// Geometry tuned so the two facts a player has to read — which radical, how
// many strokes — survive being drawn at 28px in the key. The ticks sit well
// clear of the ring and fan wide enough to count at a glance.
const TICK_SPREAD = 21;
const KIN_DOTS = [-125, -90, -55];

/**
 * One logogram. The ring is the word, the radical inside is its family, the
 * ticks below it are its stroke count. Decorative by itself — every button that
 * draws one carries the same facts in its accessible name.
 */
export function ArrivalGlyph({
  family,
  strokes,
  className = "h-10 w-10",
  drawn = false,
}: {
  family: Family;
  strokes: number;
  className?: string;
  drawn?: boolean;
}) {
  const ticks = Array.from(
    { length: strokes },
    (_, index) => 90 + (index - (strokes - 1) / 2) * TICK_SPREAD
  );
  return (
    <svg viewBox="0 0 52 52" aria-hidden className={`shrink-0 text-accent ${className}`}>
      <circle
        cx="26"
        cy="26"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeOpacity={drawn ? 0.95 : 0.7}
        className={drawn ? "arr-anim-draw" : undefined}
      />

      {family === "cycle" && (
        <circle
          cx="26"
          cy="26"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeOpacity="0.9"
        />
      )}
      {family === "kin" &&
        KIN_DOTS.map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return (
            <circle
              key={angle}
              cx={26 + Math.cos(radians) * 8}
              cy={26 + Math.sin(radians) * 8}
              r="1.9"
              fill="currentColor"
              fillOpacity="0.9"
            />
          );
        })}
      {family === "exchange" && (
        <>
          <path
            d="M18.5 23.3 A8 8 0 0 1 33.5 23.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeOpacity="0.9"
          />
          <line
            x1="33.5"
            y1="23.3"
            x2="37"
            y2="28"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeOpacity="0.9"
          />
        </>
      )}
      {family === "craft" && (
        <line
          x1="15"
          y1="26"
          x2="37"
          y2="26"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.9"
        />
      )}

      {ticks.map((angle) => {
        const radians = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={26 + Math.cos(radians) * 16.5}
            y1={26 + Math.sin(radians) * 16.5}
            x2={26 + Math.cos(radians) * 25}
            y2={26 + Math.sin(radians) * 25}
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.95"
          />
        );
      })}
    </svg>
  );
}

/** The evidence a mark shows, in words — reused by aria labels and notes. */
export const describeMark = (family: Family, strokes: number) =>
  `${FAMILIES[family].label} radical, ${countWord(strokes)} strokes`;

/**
 * The key the player reads from: only the words in play, grouped by radical,
 * each beside the glyph it is actually drawn as. This is the hinting system's
 * foundation — the spendable hint narrows, the key explains.
 */
export function ArrivalLexiconKey({ candidates }: { candidates: readonly string[] }) {
  const groups = (Object.keys(FAMILIES) as Family[])
    .map((family) => ({
      family,
      words: candidates.map(word).filter((entry) => entry.family === family),
    }))
    .filter((group) => group.words.length > 0);

  return (
    <div className="grid gap-3 border border-accent/20 bg-ink/50 p-3 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.family} className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-accent/80">
            {FAMILIES[group.family].label} — {FAMILIES[group.family].radical}
          </p>
          <p className="text-[10px] normal-case leading-snug text-white/45">
            {FAMILIES[group.family].sense}
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {group.words
              .slice()
              .sort((a, b) => a.strokes - b.strokes)
              .map((entry) => (
                <li key={entry.id} className="flex items-center gap-1.5">
                  <ArrivalGlyph
                    family={entry.family}
                    strokes={entry.strokes}
                    className="h-9 w-9"
                  />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-white/70">
                    {entry.label}
                    <span className="ml-1 text-white/40">·{entry.strokes}</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
