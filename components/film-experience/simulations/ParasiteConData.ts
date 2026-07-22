/**
 * The script behind "The con": four posts in the Park house, the order that
 * makes each one possible, the cover story that has to hold, and the
 * cross-question the Parks ask once the family is deep enough inside.
 *
 * Everything a player needs is written down here. The ordering puzzle is meant
 * to be solved from the dossiers alone — who each person is, what the house
 * will believe they are, what they carry through the door, what has to be true
 * before they can walk in, and what having them inside makes possible next.
 * No knowledge of the film is assumed anywhere in this file.
 *
 * Kept apart from the component so the staging logic stays readable and the
 * writing can be edited without touching state machinery.
 */

export type ConChoice = Readonly<{
  text: string;
  right?: true;
  /** Shown after the fact — why this line would have sunk the story. */
  tell: string;
}>;

export type ConStep = Readonly<{
  name: string;
  /** Where they sit in the family doing the con. */
  family: string;
  /** The post itself: "the English tutor". */
  role: string;
  /** The identity the house is meant to believe. */
  passesAs: string;
  /** The concrete asset carried through the door — a skill, a forgery, a name. */
  carries: string;
  /** What has to be true of the house before this one can walk in at all. */
  wayIn: string;
  /** What having them inside makes possible for whoever comes next. */
  unlocks: string;
  /** Why placing them out of turn fails — the exact missing fact. */
  blocked: string;
  /** Why this hire has to come now — the brief before the who-choice. */
  brief: string;
  /** Narration once the post is filled. */
  door: string;
  /** Which room on the house map lights up. */
  room: "study" | "artRoom" | "garage" | "kitchen";
  coverPrompt: string;
  covers: readonly ConChoice[];
  /** Later posts get cross-questioned; the first two do not. */
  question?: Readonly<{ prompt: string; options: readonly ConChoice[] }>;
}>;

export const CON_STEPS: readonly ConStep[] = [
  {
    name: "Ki-woo",
    family: "the son",
    role: "the English tutor",
    passesAs: "a university student covering for a friend",
    carries:
      "a referral from the tutor the family already employs — the one credential this house never phones to check",
    wayIn:
      "needs nothing inside the house. He is the only one with a recommendation that comes from outside it.",
    unlocks:
      "a tutor works in the house every week and talks to the mother alone, so he can put forward a specialist for her younger child.",
    blocked:
      "He is the only one who can go first, so he is never the wrong pick — but he is also the only one who never needs anybody inside.",
    brief:
      "Nobody is inside yet, so the first name has to be vouched for from outside the house. Read the dossiers: only one of them has a recommendation that does not depend on someone already working here.",
    door: "The friend's referral is handed over, and the door opens on somebody else's word.",
    room: "study",
    coverPrompt: "Mrs. Park asks who sent you.",
    covers: [
      {
        text: "I'm standing in for your son's tutor while he's abroad",
        right: true,
        tell: "A name the house already trusts is the one credential nobody thinks to verify.",
      },
      {
        text: "An agency placed me; references enclosed",
        tell: "Agencies get phoned. The first call ends the con before it starts.",
      },
      {
        text: "I tutor two boys on your street already",
        tell: "Every family on this hill knows the others. She would ask them tonight.",
      },
    ],
  },
  {
    name: "Ki-jung",
    family: "the daughter",
    role: "the art therapist",
    passesAs: "“Jessica”, an art therapist trained overseas",
    carries:
      "a forged certificate good enough to read as a foreign qualification, plus a read on exactly what the mother is anxious about",
    wayIn:
      "needs someone already working inside to recommend her by name. A stranger cannot recommend herself for a post nobody has advertised.",
    unlocks:
      "the mother insists on having the therapist driven home after every session, which puts her alone in the car with the family's chauffeur.",
    blocked:
      "Nobody inside the house can put her name forward yet. Her way in is a recommendation from staff who already work here, and there is no such person on the payroll.",
    brief:
      "One voice is inside now. Use it: pick the person whose way in is a recommendation from staff, and who can be sold as a specialist the mother already worries she needs.",
    door: "A specialist gets named to an anxious mother — a stranger with a foreign qualification, never a sister.",
    room: "artRoom",
    coverPrompt: "She wants to know where this therapist trained.",
    covers: [
      {
        text: "Illinois. Only child. No family here.",
        right: true,
        tell: "Far away, unverifiable, and no relative attached to any name in this house.",
      },
      {
        text: "Your tutor's older sister, same department",
        tell: "One shared surname and both hires collapse on the same afternoon.",
      },
      {
        text: "A studio downtown, ten years teaching",
        tell: "A local studio is one phone call and a lie that answers back.",
      },
    ],
  },
  {
    name: "Ki-taek",
    family: "the father",
    role: "the chauffeur",
    passesAs: "a career driver from an invitation-only service",
    carries:
      "decades behind a wheel and an employment history vague enough that nothing about it can be looked up",
    wayIn:
      "needs the driver's seat to be empty. The post is already filled, and only someone who sits in that car regularly is close enough to cost the current driver his job.",
    unlocks:
      "a chauffeur drives the whole family all day, which is enough contact to carry a story about the last remaining member of staff — and a replacement's name.",
    blocked:
      "The seat he wants is still occupied. Nobody inside the house rides in that car often enough to empty it, so there is no vacancy for him to fill.",
    brief:
      "Two posts held. The next post is not vacant — somebody already has it. Check which of the people inside is close enough to the person holding it.",
    door: "The seat comes open first, and only then does a name get passed quietly up.",
    room: "garage",
    coverPrompt: "Mr. Park asks how the recommendation reached him.",
    covers: [
      {
        text: "A service that only staffs VIP households",
        right: true,
        tell: "Invented, exclusive, and impossible to look up — exactly what he wants to hear.",
      },
      {
        text: "Your art therapist mentioned me",
        tell: "Naming her out loud ties two supposed strangers together in one sentence.",
      },
      {
        text: "I drove for a family in this district",
        tell: "This district is small. He knows the family. He will ask.",
      },
    ],
    question: {
      prompt: "So you know the therapist?",
      options: [
        {
          text: "I've never met her.",
          right: true,
          tell: "Strangers who never met cannot be caught disagreeing about anything.",
        },
        {
          text: "She spoke very highly of you.",
          tell: "That invents a conversation that never happened — and he can ask her about it.",
        },
        {
          text: "We've worked the same houses.",
          tell: "Two invented résumés that now have to match each other.",
        },
      ],
    },
  },
  {
    name: "Chung-sook",
    family: "the mother",
    role: "the housekeeper",
    passesAs: "a housekeeper sent by the same service that supplied the driver",
    carries:
      "a cook's hands, and a lie the house has already swallowed once and will therefore swallow again",
    wayIn:
      "needs the last post emptied, and that post belongs to staff who live in the house. Only somebody with all-day contact and a car waiting outside can move her out of it.",
    unlocks: "nothing further — this is the last post in the house.",
    blocked:
      "The housekeeper's post is still held by the woman who has worked here for years. Removing her takes all-day contact with the family and a car standing by, and nobody inside has both yet.",
    brief:
      "Three posts held. The last one is occupied by long-serving staff — it has to be emptied before it can be filled. Who inside has all-day contact and a car?",
    door: "The last post falls open on schedule, and the family's own service supplies the replacement.",
    room: "kitchen",
    coverPrompt: "Mrs. Park asks what makes this one different.",
    covers: [
      {
        text: "The same service that sent your driver",
        right: true,
        tell: "The lie now has a history in this house. It vouches for itself.",
      },
      {
        text: "Your last housekeeper put my name forward",
        tell: "The woman you just removed is the one person who must never be called.",
      },
      {
        text: "I cook for the family below the hill",
        tell: "Another neighbour, another reference that answers the phone honestly.",
      },
    ],
    question: {
      prompt: "Did you ever meet the last housekeeper?",
      options: [
        {
          text: "No. Only her file.",
          right: true,
          tell: "No contact, no story to keep straight.",
        },
        {
          text: "She left for her health, I heard.",
          tell: "You know why she left. Only somebody involved would.",
        },
        {
          text: "She trained me herself.",
          tell: "You have just placed yourself in this house before you arrived in it.",
        },
      ],
    },
  },
];

/** Displayed out of order — reading the sequence back off the dossiers is the puzzle. */
export const CON_DISPLAY_ORDER = [1, 2, 0, 3] as const;
