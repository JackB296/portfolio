"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import {
  COMMISSIONS,
  REGISTER_LABELS,
  SEAL_THRESHOLD,
  currentLean,
  heartsFor,
  partialSincerity,
  readLetter,
  type Commission,
  type LetterReading,
} from "@/components/film-experience/simulations/HerLetterCommissions";

// Ghost-writing a day's worth of other people's love, Theodore-style. Three
// commissions, each wanting a different register; the letter assembles itself
// in longhand as phrases are chosen, and the sincerity meter reads nuance —
// too guarded is cold, too much reads performed. Seal all three to clock out.
const SCORE_ID = "her-letter";

type Phase = "writing" | "returned" | "sealed" | "complete";

/** A letter line that eases in when its phrase is chosen. */
function InkLine({ lead, text }: { lead: string; text: string | null }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (text === null) {
      setSettled(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [text]);
  return (
    <p className="text-[13px] normal-case leading-relaxed text-white/85">
      <span className="text-white/50">{lead} </span>
      {text === null ? (
        <span aria-hidden className="text-white/25">…</span>
      ) : (
        <span
          key={text}
          className={`inline-block italic transition-all duration-300 ease-out motion-reduce:transition-none ${
            settled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {text}
        </span>
      )}
    </p>
  );
}

/** The tone gauge: where the letter leans against what the commission wants. */
function RegisterGauge({
  commission,
  lean,
}: {
  commission: Commission;
  lean: number | null;
}) {
  const position = (value: number) => `${((value - 1) / 2) * 100}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-1.5 w-full bg-white/10" aria-hidden>
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/45"
          style={{ left: position(commission.target) }}
        />
        {lean !== null && (
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-300 motion-reduce:transition-none"
            style={{ left: position(lean) }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] uppercase tracking-[0.14em] text-white/40">
        <span>reserved</span>
        <span>tender</span>
        <span>unguarded</span>
      </div>
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/45">
        This letter wants: {REGISTER_LABELS[commission.target]}
      </p>
    </div>
  );
}

/**
 * The writing desk. Mounted by the shell only after the visitor starts, so it
 * owns its picks from the first render. No timers — the pressure is tonal.
 */
function LetterDesk() {
  const [commissionIndex, setCommissionIndex] = useState(0);
  const [picks, setPicks] = useState<readonly (number | null)[]>(() =>
    COMMISSIONS[0].slots.map(() => null)
  );
  const [phase, setPhase] = useState<Phase>("writing");
  const [reading, setReading] = useState<LetterReading | null>(null);
  const [sealedScores, setSealedScores] = useState<readonly number[]>([]);
  const [voiceOff, setVoiceOff] = useState(() => isVoiceMuted());

  // She reads over your shoulder: a word as the day opens, and a verdict each
  // time a letter goes out or comes back. Nothing waits on the audio — an
  // absent recording is silent, and the desk behaves the same either way.
  // The recorded text:
  //
  //   her-letter-open     "Letter writer six-twelve. Three today — say them
  //                        like you mean them."
  //   her-letter-sealed   "That one's true. They'll believe every word of it."
  //   her-letter-returned "It came back. Something in it isn't yours yet —
  //                        say it again, closer."
  //   her-letter-complete "Three letters, boxed and gone to their strangers.
  //                        You're not just a letter writer, you know."
  useEffect(() => {
    void speak("her-letter-open", "her");
    return () => stopVoice();
  }, []);

  const commission = COMMISSIONS[commissionIndex];
  const allChosen = picks.every((pick) => pick !== null);
  const sincerity = useMemo(() => {
    if (phase === "complete") {
      return Math.round(
        sealedScores.reduce((sum, s) => sum + s, 0) / sealedScores.length
      );
    }
    if (reading && (phase === "sealed" || phase === "returned")) {
      return reading.sincerity;
    }
    return partialSincerity(commission, picks);
  }, [phase, reading, commission, picks, sealedScores]);
  const lean = useMemo(
    () => currentLean(commission, picks),
    [commission, picks]
  );
  const openerRegister = useMemo(() => {
    const pick = picks[0];
    return pick === null ? null : commission.slots[0].options[pick].register;
  }, [commission, picks]);

  const choose = useCallback(
    (slot: number, option: number) => {
      if (phase !== "writing") return;
      setPicks((current) => {
        const next = current.slice();
        next[slot] = option;
        return next;
      });
    },
    [phase]
  );

  const readBack = useCallback(() => {
    if (!allChosen || phase !== "writing") return;
    const verdict = readLetter(commission, picks as number[]);
    setReading(verdict);
    setPhase(verdict.sincerity >= SEAL_THRESHOLD ? "sealed" : "returned");
  }, [allChosen, phase, commission, picks]);

  const revise = useCallback(() => {
    setReading(null);
    setPhase("writing");
  }, []);

  const advance = useCallback(() => {
    if (!reading) return;
    const scores = [...sealedScores, reading.sincerity];
    setSealedScores(scores);
    if (commissionIndex + 1 >= COMMISSIONS.length) {
      setPhase("complete");
      recordSimulationScore(
        SCORE_ID,
        Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      );
      return;
    }
    const next = commissionIndex + 1;
    setCommissionIndex(next);
    setPicks(COMMISSIONS[next].slots.map(() => null));
    setReading(null);
    setPhase("writing");
  }, [reading, sealedScores, commissionIndex]);

  useEffect(() => {
    if (phase === "sealed") void speak("her-letter-sealed", "her");
    else if (phase === "returned") void speak("her-letter-returned", "her");
    else if (phase === "complete") void speak("her-letter-complete", "her");
  }, [phase]);

  const restart = useCallback(() => {
    stopVoice();
    setCommissionIndex(0);
    setPicks(COMMISSIONS[0].slots.map(() => null));
    setReading(null);
    setSealedScores([]);
    setPhase("writing");
  }, []);

  const returnedNote = useMemo(() => {
    if (!reading) return "";
    if (reading.drift === "guarded") return commission.guardedNote;
    if (reading.drift === "performed") return commission.performedNote;
    return "It keeps changing its mind — pick a register and stay in it.";
  }, [reading, commission]);

  const status = useMemo(() => {
    if (phase === "complete") {
      return `Day complete. Three letters sent — average sincerity ${sincerity}%.`;
    }
    if (phase === "sealed") {
      return `Sealed. Sincerity ${sincerity}%${reading?.resonant ? " — the closer rings true" : ""}.`;
    }
    if (phase === "returned") return `Returned, sincerity ${sincerity}%. Revise it.`;
    if (!allChosen) {
      return `Commission ${commissionIndex + 1} of ${COMMISSIONS.length} — choose each beat.`;
    }
    return "Every beat chosen. Read it back.";
  }, [phase, sincerity, reading, allChosen, commissionIndex]);

  const isDone = phase === "sealed" || phase === "complete";
  const lastCommission = commissionIndex === COMMISSIONS.length - 1;

  return (
    <div
      data-sim-state={phase}
      data-sincerity={sincerity}
      data-commission={commissionIndex + 1}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent">
            {commission.client}
          </p>
          <p className="mt-0.5 text-[11px] normal-case leading-relaxed text-white/55">
            {commission.brief}
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {COMMISSIONS.map((entry, index) => (
            <span
              key={entry.id}
              className={`h-1.5 w-6 ${
                index < sealedScores.length ||
                (index === commissionIndex && isDone)
                  ? "bg-accent"
                  : index === commissionIndex
                    ? "bg-accent/40"
                    : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>

      {phase === "complete" ? (
        <div className="flex flex-col gap-3 border border-accent/25 bg-ink/60 p-4">
          <p className="text-[13px] normal-case leading-relaxed text-accent">
            The handwritten letters are boxed and gone to their strangers. Best
            of the day: {Math.max(...sealedScores)}% sincere.
          </p>
          <ul className="flex flex-col gap-1">
            {COMMISSIONS.map((entry, index) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 text-[11px] normal-case text-white/65"
              >
                <span>{entry.client}</span>
                <span aria-label={`${heartsFor(sealedScores[index])} of 5 hearts`}>
                  {"♥".repeat(heartsFor(sealedScores[index]))}
                  <span className="text-white/25">
                    {"♥".repeat(5 - heartsFor(sealedScores[index]))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="max-h-72 space-y-3 overflow-y-auto border border-accent/25 bg-ink/60 p-3 sm:max-h-none">
            {commission.slots.map((slot, slotIndex) => {
              const chosen = picks[slotIndex];
              const isSignoff = slotIndex === commission.slots.length - 1;
              return (
                <fieldset key={slot.lead} className="flex flex-col gap-1.5">
                  <legend className="text-[11px] normal-case leading-relaxed text-white/70">
                    {slot.lead}
                  </legend>
                  <div className="flex flex-col gap-1">
                    {slot.options.map((option, optionIndex) => {
                      const active = chosen === optionIndex;
                      const ringsTrue =
                        isSignoff &&
                        openerRegister !== null &&
                        option.register === openerRegister;
                      return (
                        <div key={option.text} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => choose(slotIndex, optionIndex)}
                            disabled={phase !== "writing"}
                            aria-pressed={active}
                            className={`flex-1 border px-2 py-1.5 text-left text-[11px] normal-case leading-relaxed transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] disabled:opacity-60 motion-reduce:transition-none ${
                              active
                                ? "border-accent/60 bg-accent/10 text-accent"
                                : "border-accent/20 text-white/60 hover:bg-accent/10"
                            }`}
                          >
                            {option.text}
                          </button>
                          {ringsTrue && (
                            <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-accent/70">
                              rings true
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <div
              className={`relative flex-1 border bg-ink/60 p-4 font-serif transition-colors duration-300 motion-reduce:transition-none ${
                phase === "sealed"
                  ? "border-accent/60 shadow-[0_0_24px_-8px] shadow-accent/40"
                  : phase === "returned"
                    ? "border-white/30"
                    : "border-accent/25"
              }`}
            >
              <div className="flex flex-col gap-2.5">
                {commission.slots.map((slot, slotIndex) => {
                  const pick = picks[slotIndex];
                  return (
                    <InkLine
                      key={slot.lead}
                      lead={slot.lead}
                      text={pick === null ? null : slot.options[pick].text}
                    />
                  );
                })}
              </div>
              {phase === "sealed" && (
                <span className="absolute right-3 top-3 rotate-6 border border-accent/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-accent">
                  sealed
                </span>
              )}
              {phase === "returned" && (
                <span className="absolute right-3 top-3 -rotate-6 border border-white/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white/60">
                  returned
                </span>
              )}
            </div>

            <RegisterGauge commission={commission} lean={lean} />

            {phase === "returned" && (
              <p className="border border-white/15 bg-ink/60 p-2.5 text-[11px] normal-case leading-relaxed text-white/70">
                {returnedNote}
              </p>
            )}
            {phase === "sealed" && reading && (
              <p
                className="text-[11px] uppercase tracking-[0.14em] text-accent"
                aria-label={`Rated ${heartsFor(reading.sincerity)} of 5 hearts`}
              >
                {"♥".repeat(heartsFor(reading.sincerity))}
                <span className="text-white/25">
                  {"♥".repeat(5 - heartsFor(reading.sincerity))}
                </span>
                <span className="ml-2 text-white/55">client rating</span>
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className="h-1 w-full bg-white/10"
        aria-hidden
      >
        <div
          className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
            reading && phase === "returned" ? "bg-white/40" : "bg-accent/80"
          }`}
          style={{ width: `${sincerity}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/55">
          {status}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !voiceOff;
              setVoiceMuted(next);
              setVoiceOff(next);
            }}
            aria-pressed={!voiceOff}
            aria-label={
              voiceOff ? "Unmute the spoken lines" : "Mute the spoken lines"
            }
            className="shrink-0 border border-accent/20 px-2.5 py-1 text-white/60 hover:bg-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {voiceOff ? "voice off" : "voice on"}
          </button>
          {phase === "writing" && (
            <button
              type="button"
              onClick={readBack}
              disabled={!allChosen}
              className="shrink-0 border border-accent/30 px-2.5 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Read it back
            </button>
          )}
          {phase === "returned" && (
            <button
              type="button"
              onClick={revise}
              className="shrink-0 border border-accent/30 px-2.5 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Revise
            </button>
          )}
          {phase === "sealed" && (
            <button
              type="button"
              onClick={advance}
              className="shrink-0 border border-accent/40 px-2.5 py-1 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {lastCommission ? "Send the day's letters" : "Next commission"}
            </button>
          )}
          {phase === "complete" && (
            <button
              type="button"
              onClick={restart}
              className="shrink-0 border border-accent/30 px-2.5 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Write another round
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function HerComposeLetter({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="her-letter-title"
      gameId="her-letter"
      eyebrow="Dictation"
      title="Compose a letter"
      startLabel="Start dictating"
      stage
      howToPlay={{
        objective:
          "Ghost-write three commissioned love letters and get all three sealed.",
        controls: [
          { keys: "click", does: "pick one phrase for each beat of the letter" },
          { keys: "read it back", does: "hand the finished draft to the client" },
          { keys: "revise", does: "re-open a letter the client returned" },
          { keys: "next", does: "seal it and take the following commission" },
          { keys: "voice", does: "mute or unmute her spoken reaction to each letter" },
        ],
        tip: "Each commission wants a register — reserved, tender, or unguarded. The gauge shows where your phrases lean against that mark; drift too guarded or too performed and the letter comes back. Closing in the same register you opened in rings true and lifts the score.",
      }}
      reference={{
        quote: "Letter writer 612.",
        scene: "Her (2013) · Theodore dictating other people's love",
      }}
      onClose={onClose}
    >
      <LetterDesk />
    </SimulationShell>
  );
}
