"use client";

// Phrase pool and tuning for "Decode the rain".
//
// COPYRIGHT NOTE — read before adding a line. This is deliberately NOT a
// corpus of film dialogue. Every entry is either a short allusive fragment
// (a handful of words, the kind of phrase that carries no copyright) or
// original Matrix-flavoured text written for this site. Do not paste scene
// transcripts, long quotes, or monologues in here.

export type DecodePhrase = Readonly<{
  /** The text the player types. Lowercase, ASCII, spaces and commas only. */
  text: string;
  /** Stable voice id — /public/audio/sim-voice/<id>.mp3, missing is fine. */
  voiceId: string;
}>;

/** "wake up, jack" → "wake-up-jack" */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const phrase = (text: string): DecodePhrase => ({
  text,
  voiceId: `matrix-decode-${slug(text)}`,
});

/**
 * The five trial phrases, shortest first, in fixed order so the trial is
 * learnable and testable. "wake up, jack" MUST stay round one — the spec
 * types it deterministically.
 */
export const TRIAL_PHRASES: readonly DecodePhrase[] = [
  phrase("wake up, jack"),
  phrase("there is no spoon"),
  phrase("the matrix has you"),
  phrase("follow the white rabbit"),
  phrase("no one can be told what the matrix is"),
];

/**
 * Freeplay draws from the trial five plus original lines written here. Short
 * on purpose: a freeplay round should land in a few seconds so the graph fills
 * with samples rather than one long crawl.
 */
export const FREEPLAY_PHRASES: readonly DecodePhrase[] = [
  ...TRIAL_PHRASES,
  phrase("the rain remembers your name"),
  phrase("green light, falling code"),
  phrase("operator, i need an exit"),
  phrase("residual self image"),
  phrase("trace running, six seconds"),
  phrase("unplug and breathe"),
  phrase("hard line, thirty seconds"),
  phrase("you were never the one"),
  phrase("code falls, meaning stays"),
  phrase("phone booth, empty street"),
  phrase("deja vu in the hallway"),
  phrase("the construct is loading"),
  phrase("bend, do not break"),
];

/** Every voice id this game can ask for, for preloading and for the ledger. */
export const DECODE_VOICE_IDS: readonly string[] = FREEPLAY_PHRASES.map(
  (entry) => entry.voiceId
);

export const GLYPHS = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒ0123456789";

/** Per-character time budget per trial round; a flat grace protects short ones. */
export const PER_CHAR_MS = [850, 520, 430, 350, 300] as const;
export const GRACE_MS = 4_000;

export const roundBudget = (round: number) =>
  GRACE_MS + TRIAL_PHRASES[round].text.length * PER_CHAR_MS[round];

export function scramble(text: string) {
  return text
    .split("")
    .map((ch) => (ch === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
    .join("");
}

export const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/** Fisher-Yates over a copy: freeplay never repeats a phrase inside a cycle. */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
