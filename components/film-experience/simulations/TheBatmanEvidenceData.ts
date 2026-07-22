// The corkboard, as a deduction graph.
//
// Six clues are pinned at the start. Every true thread you run writes a line in
// the file and pulls two more clues out of it, so the board grows as you read
// it — which is what stringing a conspiracy actually feels like. The second
// tier closes on a single question: what is all of this actually about?

export type ClueNode = Readonly<{
  id: string;
  label: string;
  /** Tier 1 is pinned from the start; tier 2 is pulled up by a true thread. */
  tier: 1 | 2;
  x: number;
  y: number;
  /** The one-line card shown under the board when the node is selected. */
  card: string;
  /** What the exhibit physically is. Shown on hover, focus, or inspect. */
  found: string;
  /** Where it came from — provenance, so the label stops being a riddle. */
  where: string;
  /**
   * Why it might matter. Enough to reason a connection out of, never the
   * connection itself: it names the KIND of question the clue opens, and the
   * player still has to find the exhibit on the other side of it.
   */
  matters: string;
}>;

export type Thread = Readonly<{
  a: string;
  b: string;
  /** The line the file records once the thread is run. */
  note: string;
  /** Clues this thread pulls onto the board. */
  reveals: readonly string[];
}>;

// Three columns, and two interleaved sets of rows: the pinned tier sits on
// ROW, the tier a thread pulls up sits on MID_ROW between them, so a string
// running across the board never passes through the face of a card.
const COL = { left: 0.13, mid: 0.5, right: 0.87 } as const;
const ROW = [0.09, 0.31, 0.53, 0.75] as const;
const MID_ROW = [0.2, 0.42, 0.64, 0.86] as const;

export const CLUES: readonly ClueNode[] = [
  {
    id: "mayor",
    label: "THE MAYOR",
    tier: 1,
    x: COL.left,
    y: ROW[0],
    card: "Twenty years in office, and the first name on every disbursement.",
    found: "A campaign portrait of the sitting mayor, twenty years in office.",
    where: "Taken off the wall of his own re-election room the night he was killed.",
    matters: "No money leaves this city without his signature somewhere on it.",
  },
  {
    id: "renewal",
    label: "RENEWAL FUND",
    tier: 1,
    x: COL.right,
    y: ROW[0],
    card: "A billion promised to the city. Nobody can say where it landed.",
    found: "A charity ledger: one billion dollars pledged to rebuild Gotham.",
    where: "Three boxes requisitioned from City Hall accounting. Two of them empty.",
    matters: "What was pledged and what was paid out do not agree, and every payment was signed by somebody.",
  },
  {
    id: "falcone",
    label: "FALCONE",
    tier: 1,
    x: COL.left,
    y: ROW[1],
    card: "Untouched for two decades. Somebody was keeping him untouched.",
    found: "An arrest sheet: twenty years of charges, not one conviction.",
    where: "The drug unit's own records, pulled from the department archive.",
    matters: "A run that clean is not luck. It is a decision somebody renewed every year — and a decision leaves paperwork.",
  },
  {
    id: "informant",
    label: "THE INFORMANT",
    tier: 1,
    x: COL.right,
    y: ROW[1],
    card: "A name on a sealed file that the department never opened again.",
    found: "A sealed cooperation file. One redacted name, one date, nothing else.",
    where: "The evidence locker, filed under a case that was never brought to court.",
    matters: "Somebody gave the city testimony and was given something back for it. The file was closed before anyone could ask what.",
  },
  {
    id: "cards",
    label: "THE CARDS",
    tier: 1,
    x: COL.left,
    y: ROW[2],
    card: "One left at every scene, taped shut, addressed to the detective.",
    found: "Greeting cards, taped shut, each one addressed to the detective by name.",
    where: "One left on the body at every scene so far, in the order the killings happened.",
    matters: "They are addressed to a reader, which means the set is meant to be read together, and something about the set is consistent.",
  },
  {
    id: "ink",
    label: "GREEN INK",
    tier: 1,
    x: COL.right,
    y: ROW[2],
    card: "The same pen on all of them. Bought by the box, traceable to nowhere.",
    found: "A lettering sample in green ink, matched across every card recovered.",
    where: "Lab comparison. Common stock, bought by the box, traceable to nobody.",
    matters: "One pen, one hand, no supply trail. The writer wanted the cards linked to each other and to nothing else.",
  },
  {
    id: "rat",
    label: "THE RAT",
    tier: 2,
    x: COL.mid,
    y: MID_ROW[0],
    card: "The word under every card in the deck. Someone talked, and got paid.",
    found: "The word RAT, printed under the flap of every card in the deck.",
    where: "Only visible once the cards were opened and laid out side by side.",
    matters: "It is an accusation, and accusations are aimed at a person. Somebody talked, and somebody was paid for it.",
  },
  {
    id: "deal",
    label: "THE DEAL",
    tier: 2,
    x: COL.mid,
    y: MID_ROW[1],
    card: "Protection traded for testimony, signed by people still in office.",
    found: "A signed immunity agreement — protection traded for testimony.",
    where: "Stapled inside the sealed file. The countersignatures are still legible.",
    matters: "The people who signed it are still holding office, which makes the deal a live thing rather than history.",
  },
  {
    id: "alada",
    label: "EL RATA ALADA",
    tier: 2,
    x: COL.mid,
    y: MID_ROW[2],
    card: "Bad Spanish for a rat with wings. He wants you to say it out loud.",
    found: "Three words in green ink, left as a question with a blank under it.",
    where: "The most recent card. The Spanish is wrong on purpose.",
    matters: "It is a riddle whose answer is a name, and he expects the answer said out loud before the next body.",
  },
  {
    id: "wings",
    label: "A WINGED RAT",
    tier: 2,
    x: COL.mid,
    y: MID_ROW[3],
    card: "The thing that eats out of the city's hand and calls itself a bird.",
    found: "The literal translation, worked out at the board and written on a card.",
    where: "Your own hand. This one is a conclusion, not an exhibit.",
    matters: "It describes a creature that feeds off the city and passes for something respectable — a description, waiting for a person to fit it.",
  },
  {
    id: "orphanage",
    label: "THE ORPHANAGE",
    tier: 2,
    x: COL.left,
    y: ROW[3],
    card: "Funded for a year, then quietly defunded. The children stayed.",
    found: "Intake books from a children's home, funded for one year and then not.",
    where: "Boxed in the basement of the building, which is still standing and still full.",
    matters: "Money arrived, was recorded, and stopped without a vote. Somebody chose to turn it off, and somebody put it there first.",
  },
  {
    id: "wayne",
    label: "WAYNE MONEY",
    tier: 2,
    x: COL.right,
    y: ROW[3],
    card: "The seed of the fund, given in good faith by a man who then died.",
    found: "The founding gift: the seed capital the whole fund was built on.",
    where: "Wayne family accounts, dated the year Thomas Wayne was killed.",
    matters: "Given in good faith by a man who did not live to see where it went — so where it went was decided by other people.",
  },
];

export const THREADS: readonly Thread[] = [
  {
    a: "mayor",
    b: "renewal",
    note: "Every disbursement out of the fund carries the mayor's signature.",
    reveals: ["rat", "deal"],
  },
  {
    a: "falcone",
    b: "informant",
    note: "Falcone's twenty clean years were bought with somebody's testimony.",
    reveals: ["alada", "wings"],
  },
  {
    a: "cards",
    b: "ink",
    note: "One hand wrote all of them, and wanted that to be obvious.",
    reveals: ["orphanage", "wayne"],
  },
  {
    a: "rat",
    b: "deal",
    note: "The rat is the deal. Someone sold the city and kept the receipt.",
    reveals: [],
  },
  {
    a: "alada",
    b: "wings",
    note: "Same creature, two languages. The name is the accusation.",
    reveals: [],
  },
  {
    a: "orphanage",
    b: "wayne",
    note: "The orphanage was seeded with Wayne money, then starved of it.",
    reveals: [],
  },
];

export type Verdict = Readonly<{ text: string; right: boolean; why: string }>;

export const VERDICT_PROMPT = "Six threads run true. Name what they run through.";

export const VERDICTS: readonly Verdict[] = [
  {
    text: "Renewal was the laundry, and the rat kept the ledger.",
    right: true,
    why: "Every thread crosses the fund, and every thread crosses the informant. That is one crime, told twice.",
  },
  {
    text: "The Riddler wanted the city to notice him.",
    right: false,
    why: "That is his method, not the case. The cards point at something older than he is.",
  },
  {
    text: "Falcone ran the city and everyone else worked for him.",
    right: false,
    why: "Too small. Falcone was protected, which means somebody above him was doing the protecting.",
  },
  {
    text: "The orphanage funding was an accounting error.",
    right: false,
    why: "Errors do not leave a paper trail this careful. Somebody chose where that money went.",
  },
];

export const clueById = new Map(CLUES.map((clue) => [clue.id, clue]));

export const threadFor = (a: string, b: string) =>
  THREADS.find(
    (thread) =>
      (thread.a === a && thread.b === b) || (thread.a === b && thread.b === a)
  );
