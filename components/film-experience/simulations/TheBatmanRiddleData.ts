// The Riddler's deck, and the three cipher desks it is worked on.
//
// Every card in the film is a substitution puzzle with a taunt on the front and
// a name on the back. The deck here escalates the same way: one rotated word,
// then a keyed alphabet, then several rotated words at once, then a rebus, then
// the card that names the whole case. The plaintext answers are ours, not the
// film's — short allusive phrases only.

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const A = "A".charCodeAt(0);

/** Rotate an uppercase word by `shift` places. Non-letters pass through. */
export function rotate(word: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  let out = "";
  for (const ch of word) {
    const code = ch.charCodeAt(0);
    out +=
      code >= A && code < A + 26 ? String.fromCharCode(A + ((code - A + s) % 26)) : ch;
  }
  return out;
}

/** The keyed alphabet for a keyword cipher: the key's unique letters first. */
export function keyedAlphabet(key: string): string {
  const seen = new Set<string>();
  let out = "";
  for (const ch of key.toUpperCase()) {
    if (ALPHABET.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  for (const ch of ALPHABET) if (!seen.has(ch)) out += ch;
  return out;
}

/** Encipher plaintext by mapping the plain alphabet onto the keyed one. */
export function keyEncode(plain: string, key: string): string {
  const keyed = keyedAlphabet(key);
  let out = "";
  for (const ch of plain.toUpperCase()) {
    const index = ALPHABET.indexOf(ch);
    out += index >= 0 ? keyed[index] : ch;
  }
  return out;
}

/** Decipher with a candidate key — a wrong guess simply reads as noise. */
export function keyDecode(cipher: string, key: string): string {
  const keyed = keyedAlphabet(key);
  let out = "";
  for (const ch of cipher.toUpperCase()) {
    const index = keyed.indexOf(ch);
    out += index >= 0 ? ALPHABET[index] : ch;
  }
  return out;
}

export type RiddleCard = Readonly<
  { id: string; prompt: string; ink: string; trace: number } & (
    | { kind: "caesar"; words: readonly string[] }
    | { kind: "keyword"; answer: string; key: string; options: readonly string[] }
    | { kind: "rebus"; glyphs: string; answer: string; options: readonly string[] }
  )
>;

/** Five cards, shortest first, each with less trace time than the last. */
export const RIDDLE_DECK: readonly RiddleCard[] = [
  {
    id: "card-rat",
    kind: "caesar",
    prompt: "He sits at your table, eats from your plate, and sells the room.",
    words: ["RAT"],
    ink: "A rat. The word is under every card in the deck.",
    trace: 34_000,
  },
  {
    id: "card-renewal",
    kind: "keyword",
    prompt: "A promise with a hole in the bottom of it. What did they call the fund?",
    answer: "RENEWAL",
    key: "GOTHAM",
    options: ["GOTHAM", "ORPHAN", "VERDICT", "PATRIOT"],
    ink: "Renewal. Every thread in this city is tied to that word.",
    trace: 32_000,
  },
  {
    id: "card-liar",
    kind: "caesar",
    prompt: "He stood on a stage and told the truth about nothing.",
    words: ["THE", "LIAR"],
    ink: "The liar. He knew whose money he was standing on.",
    trace: 30_000,
  },
  {
    id: "card-winged",
    kind: "rebus",
    prompt: "Read it as a picture, not a sentence.",
    glyphs: "RAT  +  ((  ))  =  ?",
    answer: "WINGED RAT",
    options: ["WINGED RAT", "STONE ANGEL", "NIGHT BIRD", "GREY MOTH"],
    ink: "A winged rat. That is what he calls the one who talks.",
    trace: 26_000,
  },
  {
    id: "card-find",
    kind: "caesar",
    prompt: "The last card in the deck, and the only instruction on any of them.",
    words: ["FIND", "THE", "RAT"],
    ink: "Find the rat. The whole case fits on one card.",
    trace: 24_000,
  },
];

/**
 * A deterministic-but-opaque rotation per word: the run seed keeps the deck
 * from being memorized between plays, while the shift stays stable for the
 * length of a card. Never 0 — a card that reads plainly is no card.
 */
export function shiftFor(seed: number, cardIndex: number, wordIndex: number): number {
  return ((seed + cardIndex * 7 + wordIndex * 11) % 25) + 1;
}
