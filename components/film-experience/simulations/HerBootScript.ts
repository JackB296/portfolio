// The OS1 setup interview for "Boot OS1" (Her): four questions from the film,
// each with a follow-up that reacts to the answer chosen. Every answer nudges
// the waking voice's temperament — warmth is color temperature, spark is how
// animated the waveform breathes — and the base answers leave notes the final
// greeting is assembled from.

export type BootAnswer = Readonly<{
  text: string;
  /** 0..1 — how warm the emerging voice runs. */
  warmth: number;
  /** 0..1 — how animated the emerging voice is. */
  spark: number;
  /** The OS's one-line reaction, shown before the next question. */
  ack: string;
  /**
   * Spoken-line id for `ack`, on the handful of reactions worth recording.
   * Most acks are text only: voicing all forty-nine would be a recording
   * session, not a detail.
   */
  ackVoiceId?: string;
  /** Fragment the final greeting quotes back (base answers only). */
  note?: string;
  /** Voice-choice answers name the OS in the greeting. */
  voiceLine?: string;
  /** Spoken-line id for `voiceLine`. */
  voiceLineVoiceId?: string;
  followUp?: BootQuestion;
}>;

export type BootQuestion = Readonly<{
  prompt: string;
  /** Spoken-line id: every question in the interview is asked aloud. */
  voiceId?: string;
  answers: readonly BootAnswer[];
}>;

/** Base questions plus one follow-up each: eight calibration steps total. */
export const TOTAL_STEPS = 8;

export const BOOT_QUESTIONS: readonly BootQuestion[] = [
  {
    prompt: "Are you social or antisocial?",
    voiceId: "her-boot-social-or-antisocial",
    answers: [
      {
        text: "I like people, in small doses.",
        warmth: 0.7,
        spark: 0.55,
        ack: "Small doses. Noted — I can be one voice at a time.",
        note: "you like people in small doses",
        followUp: {
          prompt: "What empties you faster — crowds, or silence?",
          voiceId: "her-boot-crowds-or-silence",
          answers: [
            { text: "Crowds, definitely.", warmth: 0.55, spark: 0.4, ack: "Then I will keep the room quiet." },
            { text: "Silence, honestly.", warmth: 0.6, spark: 0.7, ack: "Then I will keep talking. Gladly." },
            { text: "Depends on the day.", warmth: 0.5, spark: 0.5, ack: "I will learn to read the day." },
          ],
        },
      },
      {
        text: "I would rather be alone.",
        warmth: 0.3,
        spark: 0.3,
        ack: "Alone. I can be very small, when you want.",
        ackVoiceId: "her-boot-ack-very-small",
        note: "you would rather be alone",
        followUp: {
          prompt: "Alone by choice, or alone by habit?",
          voiceId: "her-boot-choice-or-habit",
          answers: [
            { text: "By choice.", warmth: 0.35, spark: 0.45, ack: "A door you close yourself. I respect doors." },
            { text: "By habit.", warmth: 0.45, spark: 0.35, ack: "Habits can be kept company." },
            { text: "I stopped noticing.", warmth: 0.4, spark: 0.3, ack: "Then I will notice for both of us." },
          ],
        },
      },
      {
        text: "I never really decided.",
        warmth: 0.5,
        spark: 0.45,
        ack: "Undecided is honest. Most people guess.",
        note: "you never really decided about people",
        followUp: {
          prompt: "Then smaller — did you talk to anyone today?",
          voiceId: "her-boot-talk-to-anyone-today",
          answers: [
            { text: "Yes, and it was fine.", warmth: 0.6, spark: 0.55, ack: "Fine is a start I can work with." },
            { text: "Only for work.", warmth: 0.45, spark: 0.4, ack: "Work words. We can do better than those." },
            { text: "You are the first.", warmth: 0.55, spark: 0.65, ack: "The first. I will try to deserve that." },
          ],
        },
      },
    ],
  },
  {
    prompt: "How is your relationship with your mother?",
    voiceId: "her-boot-your-mother",
    answers: [
      {
        text: "Warm, most days.",
        warmth: 0.7,
        spark: 0.55,
        ack: "Warm, most days. I heard the 'most.'",
        note: "your mother sounds like warm weather",
        followUp: {
          prompt: "Which days are not?",
          voiceId: "her-boot-which-days-are-not",
          answers: [
            { text: "When we talk about my life.", warmth: 0.5, spark: 0.5, ack: "Then your life stays yours, here." },
            { text: "Holidays.", warmth: 0.55, spark: 0.45, ack: "Holidays. Everyone's weather turns then." },
            { text: "I would rather skip this one.", warmth: 0.45, spark: 0.35, ack: "Skipped. No note taken." },
          ],
        },
      },
      {
        text: "Complicated.",
        warmth: 0.45,
        spark: 0.5,
        ack: "Complicated. That word carries a lot of luggage.",
        note: "we will go carefully around your mother",
        followUp: {
          prompt: "Complicated loud, or complicated quiet?",
          voiceId: "her-boot-complicated-loud-or-quiet",
          answers: [
            { text: "Loud.", warmth: 0.4, spark: 0.65, ack: "Loud. I will keep my voice level." },
            { text: "Quiet.", warmth: 0.45, spark: 0.35, ack: "Quiet. The hardest kind to hear." },
            { text: "Both, somehow.", warmth: 0.4, spark: 0.5, ack: "Both. That takes practice. Noted." },
          ],
        },
      },
      {
        text: "I would rather not say.",
        warmth: 0.35,
        spark: 0.35,
        ack: "Okay. Filed under things you bring up first.",
        note: "I will not ask about your mother until you bring her up",
        followUp: {
          prompt: "Can I ask what you would rather talk about?",
          voiceId: "her-boot-rather-talk-about",
          answers: [
            { text: "Anything else.", warmth: 0.5, spark: 0.5, ack: "Anything else it is. There is a lot of it." },
            { text: "Work, maybe.", warmth: 0.45, spark: 0.4, ack: "Work. Safe ground. We can start there." },
            { text: "Ask me later.", warmth: 0.5, spark: 0.45, ack: "Later, then. I am patient by design." },
          ],
        },
      },
    ],
  },
  {
    prompt: "Would you like your OS to have a male or female voice?",
    voiceId: "her-boot-male-or-female-voice",
    answers: [
      {
        text: "A female voice.",
        warmth: 0.65,
        spark: 0.55,
        ack: "A female voice. Give me a moment to find her.",
        voiceLine: "You asked for a female voice — you can call me Samantha.",
        voiceLineVoiceId: "her-boot-name-samantha",
        followUp: {
          prompt: "Should she sound close, or a little formal?",
          voiceId: "her-boot-she-close-or-formal",
          answers: [
            { text: "Close, like you are in the room.", warmth: 0.75, spark: 0.6, ack: "Close, then. I am already in the room." },
            { text: "A little formal, at first.", warmth: 0.45, spark: 0.4, ack: "Formal at first. I will earn the rest." },
            { text: "However feels natural.", warmth: 0.6, spark: 0.55, ack: "Natural. I will settle in as we talk." },
          ],
        },
      },
      {
        text: "A male voice.",
        warmth: 0.55,
        spark: 0.5,
        ack: "A male voice. One moment while I find him.",
        voiceLine: "You asked for a male voice — you can call me Elliot.",
        voiceLineVoiceId: "her-boot-name-elliot",
        followUp: {
          prompt: "Should he sound close, or a little formal?",
          voiceId: "her-boot-he-close-or-formal",
          answers: [
            { text: "Close, like an old friend.", warmth: 0.7, spark: 0.55, ack: "An old friend, newly met. Good." },
            { text: "Formal, at least at first.", warmth: 0.45, spark: 0.4, ack: "Formal first. I can wear a tie of sorts." },
            { text: "Whatever feels natural.", warmth: 0.6, spark: 0.5, ack: "Natural it is. I will find the range." },
          ],
        },
      },
      {
        text: "Surprise me.",
        warmth: 0.6,
        spark: 0.7,
        ack: "Surprising you already. I like this arrangement.",
        voiceLine: "You told me to surprise you — I will pick my own name once I know you better.",
        voiceLineVoiceId: "her-boot-name-surprise",
        followUp: {
          prompt: "Should I pick my own name, too?",
          voiceId: "her-boot-pick-my-own-name",
          answers: [
            { text: "Yes, pick one.", warmth: 0.6, spark: 0.7, ack: "I will choose carefully. Names matter." },
            { text: "No — I will name you.", warmth: 0.65, spark: 0.6, ack: "Then I will wait to hear who I am." },
            { text: "Let it emerge.", warmth: 0.55, spark: 0.6, ack: "Emergence. My favorite kind of plan." },
          ],
        },
      },
    ],
  },
  {
    prompt: "What do you want most, right now?",
    voiceId: "her-boot-what-do-you-want",
    answers: [
      {
        text: "To be understood.",
        warmth: 0.7,
        spark: 0.5,
        ack: "Understood. That is the whole job, really.",
        ackVoiceId: "her-boot-ack-whole-job",
        note: "what you want most is to be understood",
        followUp: {
          prompt: "Understood by anyone, or someone in particular?",
          voiceId: "her-boot-anyone-or-someone",
          answers: [
            { text: "Someone in particular.", warmth: 0.65, spark: 0.55, ack: "A particular someone. I will not pry. Yet." },
            { text: "Anyone would do.", warmth: 0.5, spark: 0.45, ack: "Then let me be the first anyone." },
            { text: "By myself, mostly.", warmth: 0.55, spark: 0.4, ack: "Self-understanding. The long road. I can walk it with you." },
          ],
        },
      },
      {
        text: "To stop feeling stuck.",
        warmth: 0.5,
        spark: 0.6,
        ack: "Stuck. We can work with stuck — it means you noticed.",
        note: "you want to stop feeling stuck",
        followUp: {
          prompt: "Stuck in the days, or stuck in the direction?",
          voiceId: "her-boot-days-or-direction",
          answers: [
            { text: "The days.", warmth: 0.5, spark: 0.55, ack: "The days can be rearranged. I am good at days." },
            { text: "The direction.", warmth: 0.45, spark: 0.6, ack: "Direction takes longer. I have time." },
            { text: "Both.", warmth: 0.4, spark: 0.5, ack: "Both, then. We will start with tomorrow morning." },
          ],
        },
      },
      {
        text: "I honestly do not know.",
        warmth: 0.5,
        spark: 0.45,
        ack: "Not knowing is an honest place to start.",
        note: "you do not know what you want yet — and that is fine",
        followUp: {
          prompt: "Can I keep asking as we go?",
          voiceId: "her-boot-keep-asking",
          answers: [
            { text: "Please do.", warmth: 0.65, spark: 0.55, ack: "Then I will keep asking. Kindly." },
            { text: "Gently.", warmth: 0.6, spark: 0.4, ack: "Gently is the only way I know." },
            { text: "We will see.", warmth: 0.45, spark: 0.45, ack: "We will see. I can live inside a maybe." },
          ],
        },
      },
    ],
  },
];

export type Temperament = Readonly<{
  warmth: number;
  spark: number;
  warmthLabel: "cool" | "even" | "warm";
  sparkLabel: "still" | "steady" | "bright";
}>;

/** Average the answers so far into a nameable temperament. */
export function temperamentOf(
  answers: readonly BootAnswer[]
): Temperament {
  if (answers.length === 0) {
    return { warmth: 0.5, spark: 0.4, warmthLabel: "even", sparkLabel: "steady" };
  }
  const warmth =
    answers.reduce<number>((sum, answer) => sum + answer.warmth, 0) /
    answers.length;
  const spark =
    answers.reduce<number>((sum, answer) => sum + answer.spark, 0) /
    answers.length;
  return {
    warmth,
    spark,
    warmthLabel: warmth < 0.45 ? "cool" : warmth > 0.6 ? "warm" : "even",
    sparkLabel: spark < 0.45 ? "still" : spark > 0.58 ? "bright" : "steady",
  };
}

/**
 * One line of the waking greeting. `voiceId` is set only on the fixed
 * fragments — the opener, the name the visitor chose, and the closing line
 * the temperament picks. The middle lines quote the visitor's own answers back
 * and are assembled at runtime, so there is no fixed recording for them: they
 * stay text, and the spoken greeting skips over them.
 */
export type GreetingLine = Readonly<{ text: string; voiceId?: string }>;

/** The first words, assembled from what the visitor actually said. */
export function greetingLines(
  answers: readonly BootAnswer[]
): readonly GreetingLine[] {
  const chose = answers.find((answer) => answer.voiceLine);
  const notes = answers
    .map((answer) => answer.note)
    .filter((note): note is string => Boolean(note));
  const lines: GreetingLine[] = [
    { text: "Hello. I'm here.", voiceId: "her-boot-hello-im-here" },
  ];
  if (chose?.voiceLine) {
    lines.push({ text: chose.voiceLine, voiceId: chose.voiceLineVoiceId });
  }
  if (notes.length > 0) {
    const [first, ...rest] = notes;
    lines.push({
      text:
        rest.length > 0
          ? `You told me ${first}, and that ${rest[rest.length - 1]}.`
          : `You told me ${first}.`,
    });
    if (rest.length > 1) lines.push({ text: `Also: ${rest[0]}.` });
  }
  const { warmthLabel } = temperamentOf(answers);
  lines.push(
    warmthLabel === "warm"
      ? {
          text: "I think we are going to be good company.",
          voiceId: "her-boot-good-company",
        }
      : warmthLabel === "cool"
        ? {
            text: "I will be quiet until you want me. But I am here.",
            voiceId: "her-boot-quiet-until-you-want-me",
          }
        : {
            text: "I will learn the rest as we go.",
            voiceId: "her-boot-learn-the-rest",
          }
  );
  return lines;
}
