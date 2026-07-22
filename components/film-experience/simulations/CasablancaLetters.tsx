"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  CasablancaKeyframes,
  CasablancaMuteButton,
  useCasablancaAudio,
} from "@/components/film-experience/simulations/CasablancaShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { useReducedMotion } from "@/lib/useReducedMotion";

// The prefecture desk, three shifts deep. Every genuine document matches the
// values on file; a forgery alters exactly one visible field. Early shifts only
// fake the countersignature; later shifts fake the issuing office and the date
// too, and the gendarme's patience gets shorter. Three misjudged papers and
// the desk is closed.
const SEAL = "LAISSEZ-PASSER · GÉNÉRAL WEYGAND";
const OFFICE = "PRÉFECTURE · CASABLANCA";
const DATE = "2 DÉC 1941";
const SCORE_ID = "casablanca-letters";
const MAX_SUSPICION = 3;
const LOCK_MS = 320;

type Phase = "running" | "paused" | "summary" | "done" | "failed";
type Field = "seal" | "office" | "date";
type Paper = Readonly<{
  bearer: string;
  seal: string;
  office: string;
  date: string;
  genuine: boolean;
}>;
type Shift = Readonly<{ name: string; brief: string; roundMs: number; deck: readonly Paper[] }>;
type Verdict = Readonly<{ action: "stamp" | "reject"; correct: boolean }> | null;

const genuine = (bearer: string): Paper => ({
  bearer,
  seal: SEAL,
  office: OFFICE,
  date: DATE,
  genuine: true,
});

const forged = (bearer: string, tell: Field, value: string): Paper => {
  const base = { bearer, seal: SEAL, office: OFFICE, date: DATE, genuine: false };
  if (tell === "seal") return { ...base, seal: value };
  if (tell === "office") return { ...base, office: value };
  return { ...base, date: value };
};

// Fixed decks so every shift is learnable and the spec deterministic. The
// first paper is always genuine (the smoke test stamps it blind).
const SHIFTS: readonly Shift[] = [
  {
    name: "First shift",
    brief: "Forgers slip on the countersignature. Compare it to the file.",
    roundMs: 26_000,
    deck: [
      genuine("Ugarte, G."),
      forged("Laszlo, V.", "seal", "LAISSEZ-PASSER · GÉNÉRAL WEYGARD"),
      genuine("Lund, I."),
      forged("Ferrari, S.", "seal", "LAISSEZ-PASER · GÉNÉRAL WEYGAND"),
    ],
  },
  {
    name: "Second shift",
    brief: "The seals are copied cleanly now — check the issuing office too.",
    roundMs: 24_000,
    deck: [
      forged("Brandel, J.", "office", "PRÉFECTURE · MARSEILLE"),
      genuine("Brandel, A."),
      forged("Strasser, H.", "seal", "LAISSEZ-PASSER · GÉNÉRAL WEYAND"),
      genuine("Renault, L."),
      genuine("Sascha, A."),
    ],
  },
  {
    name: "Night shift",
    brief: "Anything can be wrong now — seal, office, or the date itself.",
    roundMs: 22_000,
    deck: [
      genuine("Berger, N."),
      forged("Yvonne, M.", "date", "2 DEC 1941"),
      forged("Heinze, K.", "seal", "LAISSEZ-PASSER · GENERAL WEYGAND"),
      genuine("Carl, W."),
      forged("Annina, B.", "office", "PRÉFECTURE · CASBLANCA"),
      genuine("Jan, B."),
    ],
  },
];
const TOTAL_PAPERS = SHIFTS.reduce((sum, shift) => sum + shift.deck.length, 0);

function TransitDesk() {
  const [phase, setPhase] = useState<Phase>("running");
  const [shiftIndex, setShiftIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [suspicion, setSuspicion] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [failReason, setFailReason] = useState<"time" | "suspicion">("time");
  const [shiftStats, setShiftStats] = useState({ cleared: 0, errors: 0, bonus: 0 });
  const [shake, setShake] = useState(0);
  const reducedMotion = useReducedMotion();
  const audio = useCasablancaAudio();

  const meterRef = useRef<HTMLDivElement>(null);
  const warnRef = useRef<HTMLParagraphElement>(null);
  // The gendarme deadline lives in refs so the rAF loop never re-renders
  // React; a wrong stamp shoves the deadline forward, a hidden tab pauses it.
  const deadlineRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const remainingRef = useRef(0);
  const lockRef = useRef(0);
  const scoreRef = useRef(0);
  const shiftErrorsRef = useRef(0);
  const shiftClearedRef = useRef(0);

  const clearLock = () => {
    if (lockRef.current) window.clearTimeout(lockRef.current);
    lockRef.current = 0;
  };

  const start = useCallback(() => {
    clearLock();
    scoreRef.current = 0;
    shiftErrorsRef.current = 0;
    shiftClearedRef.current = 0;
    setShiftIndex(0);
    setIndex(0);
    setCleared(0);
    setScore(0);
    setStreak(0);
    setSuspicion(0);
    setVerdict(null);
    setShiftStats({ cleared: 0, errors: 0, bonus: 0 });
    setPhase("running");
    deadlineRef.current = performance.now() + SHIFTS[0].roundMs;
  }, []);

  useEffect(() => {
    start();
    return clearLock;
  }, [start]);

  // The patience meter: one rAF loop while sorting. Reduced motion removes the
  // clock entirely — the deck is sorted at leisure and only suspicion (three
  // misjudged papers) can close the desk. A deliberate playable alternative.
  useEffect(() => {
    if (phase !== "running" || reducedMotion) return;
    let frame = 0;
    const tick = () => {
      const remaining = deadlineRef.current - performance.now();
      const roundMs = SHIFTS[shiftIndex].roundMs;
      const fraction = Math.min(1, Math.max(0, 1 - remaining / roundMs));
      if (meterRef.current) meterRef.current.style.width = `${(fraction * 100).toFixed(2)}%`;
      if (warnRef.current) warnRef.current.classList.toggle("hidden", fraction < 0.72);
      if (remaining <= 0 && hiddenAtRef.current === null && !lockRef.current) {
        setFailReason("time");
        setPhase("failed");
        if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, reducedMotion, shiftIndex]);

  // A hidden tab pauses the patience meter instead of counting against it.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
      } else if (hiddenAtRef.current !== null) {
        deadlineRef.current += performance.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const shift = SHIFTS[shiftIndex];
  const paper = shift.deck[index];

  // After the stamp lands, either the next paper slides in, the shift closes
  // out with a time bonus, or the whole run resolves.
  const advance = useCallback(() => {
    if (index + 1 < shift.deck.length) {
      setIndex(index + 1);
      return;
    }
    const remaining = Math.max(0, deadlineRef.current - performance.now());
    const bonus = reducedMotion ? 60 : Math.round(remaining / 1000) * 20;
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setShiftStats({
      cleared: shiftClearedRef.current,
      errors: shiftErrorsRef.current,
      bonus,
    });
    if (shiftIndex + 1 < SHIFTS.length) {
      setPhase("summary");
      audio.play({ freq: 392, duration: 0.3, gain: 0.08 });
      audio.play({ freq: 523.25, duration: 0.35, gain: 0.08, delay: 0.12 });
      return;
    }
    setPhase("done");
    audio.play({ freq: 392, duration: 0.3, gain: 0.09 });
    audio.play({ freq: 523.25, duration: 0.3, gain: 0.09, delay: 0.12 });
    audio.play({ freq: 659.25, duration: 0.45, gain: 0.09, delay: 0.24 });
    recordSimulationScore(SCORE_ID, scoreRef.current);
  }, [audio, index, reducedMotion, shift.deck.length, shiftIndex]);

  const beginShift = useCallback(() => {
    shiftErrorsRef.current = 0;
    shiftClearedRef.current = 0;
    setShiftIndex(shiftIndex + 1);
    setIndex(0);
    setStreak(0);
    setPhase("running");
    deadlineRef.current = performance.now() + SHIFTS[shiftIndex + 1].roundMs;
  }, [shiftIndex]);

  const decide = useCallback(
    (stamped: boolean) => {
      if (phase !== "running" || lockRef.current) return;
      const correct = stamped === paper.genuine;
      setVerdict({ action: stamped ? "stamp" : "reject", correct });

      if (correct) {
        // The stamp thunk (or the drier rejection scratch).
        audio.play(
          stamped
            ? { freq: 98, type: "square", duration: 0.14, gain: 0.09 }
            : { freq: 196, type: "square", duration: 0.1, gain: 0.06 }
        );
        scoreRef.current += 100 + Math.min(streak, 4) * 25;
        setScore(scoreRef.current);
        setStreak(streak + 1);
        setCleared(cleared + 1);
        shiftClearedRef.current += 1;
      } else {
        // A misjudged paper: the gendarme notices, patience shortens.
        audio.play({ freq: 82, type: "square", duration: 0.28, gain: 0.07 });
        setStreak(0);
        setShake((n) => n + 1);
        shiftErrorsRef.current += 1;
        const nextSuspicion = suspicion + 1;
        setSuspicion(nextSuspicion);
        if (!reducedMotion) deadlineRef.current -= shift.roundMs * 0.2;
        if (nextSuspicion >= MAX_SUSPICION) {
          lockRef.current = window.setTimeout(() => {
            lockRef.current = 0;
            setVerdict(null);
            setFailReason("suspicion");
            setPhase("failed");
            if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
          }, LOCK_MS);
          return;
        }
      }

      lockRef.current = window.setTimeout(() => {
        lockRef.current = 0;
        setVerdict(null);
        advance();
      }, LOCK_MS);
    },
    [advance, audio, cleared, paper, phase, reducedMotion, shift.roundMs, streak, suspicion]
  );

  const pause = useCallback(() => {
    if (phase !== "running" || lockRef.current) return;
    remainingRef.current = deadlineRef.current - performance.now();
    setPhase("paused");
  }, [phase]);

  const resume = useCallback(() => {
    deadlineRef.current = performance.now() + remainingRef.current;
    setPhase("running");
  }, []);

  const status = useMemo(() => {
    if (phase === "failed") return "Round up the usual suspects. The desk is closed.";
    if (phase === "done")
      return `All papers in order — ${cleared} of ${TOTAL_PAPERS} cleared, ${score} points. Vaya con Dios.`;
    if (phase === "summary")
      return `${shift.name} complete — ${shiftStats.cleared} cleared, time bonus ${shiftStats.bonus}.`;
    if (phase === "paused") return "The desk is paused. The gendarme waits.";
    return `${shift.name} · paper ${index + 1} of ${shift.deck.length}. Stamp genuine, reject forged.`;
  }, [phase, cleared, score, shift, shiftStats, index]);

  const running = phase === "running";
  const locked = verdict !== null;

  return (
    <div
      data-sim-state={phase}
      data-letters-cleared={cleared}
      data-letters-suspicion={suspicion}
      data-letters-score={score}
      className="flex flex-col gap-3"
    >
      <CasablancaKeyframes />

      {!reducedMotion && (
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 bg-white/10" aria-hidden>
            <div ref={meterRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
          </div>
          <p
            ref={warnRef}
            aria-hidden
            className="hidden shrink-0 text-[9px] uppercase tracking-[0.18em] text-accent"
          >
            The gendarme stirs
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        {/* The paper under the lamp. */}
        <div
          key={`shake-${shake}`}
          className={`relative min-h-[190px] overflow-hidden border border-accent/25 bg-ink/60 p-4 ${
            shake > 0 ? "casa-anim-shake" : ""
          }`}
        >
          {running || phase === "paused" ? (
            <div key={`${shiftIndex}-${index}`} className="casa-anim-paper">
              <dl aria-hidden className="flex flex-col gap-2 text-[11px] leading-relaxed">
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-[0.14em] text-white/40">Bearer</dt>
                  <dd className="text-white/85">{paper.bearer}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="uppercase tracking-[0.14em] text-white/40">Countersignature</dt>
                  <dd className="font-mono tracking-[0.08em] text-accent">{paper.seal}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-[0.14em] text-white/40">Issuing office</dt>
                  <dd className="font-mono text-white/75">{paper.office}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-[0.14em] text-white/40">Dated</dt>
                  <dd className="font-mono text-white/75">{paper.date}</dd>
                </div>
              </dl>
              {verdict && (
                <span
                  aria-hidden
                  className={`casa-anim-stamp absolute right-4 top-1/2 -translate-y-1/2 border-4 border-double px-3 py-1.5 text-sm font-bold uppercase tracking-[0.2em] ${
                    verdict.correct ? "border-accent/80 text-accent" : "border-white/50 text-white/80"
                  }`}
                  style={{ transform: "rotate(-8deg)" }}
                >
                  {verdict.action === "stamp" ? "Cleared" : "Refusé"}
                  <span className="block text-center text-[9px] tracking-[0.14em]">
                    {verdict.correct ? "✓ in order" : "✗ misjudged"}
                  </span>
                </span>
              )}
              {phase === "paused" && (
                <div
                  aria-hidden
                  className="absolute inset-0 grid place-items-center bg-ink/80 text-[11px] uppercase tracking-[0.2em] text-white/70"
                >
                  Paused
                </div>
              )}
            </div>
          ) : phase === "summary" ? (
            <div className="casa-anim-rise flex h-full min-h-[160px] flex-col justify-center gap-1.5 text-[11px] text-white/75">
              <p className="text-sm uppercase tracking-[0.16em] text-accent">{shift.name} closed</p>
              <p>{shiftStats.cleared} papers handled cleanly</p>
              <p>{shiftStats.errors} misjudged · suspicion {suspicion} of {MAX_SUSPICION}</p>
              <p>Time bonus +{shiftStats.bonus}</p>
              <p className="mt-1 text-white/45">{SHIFTS[shiftIndex + 1]?.brief}</p>
            </div>
          ) : (
            <p
              aria-hidden
              className="casa-anim-rise grid h-full min-h-[160px] place-items-center text-center text-sm text-white/70"
            >
              {phase === "done"
                ? `Letters of transit — all signed. ${score} points.`
                : failReason === "suspicion"
                  ? "Detained at the desk — the gendarme saw enough."
                  : "Detained at the desk — the gendarme's patience ran out."}
            </p>
          )}
        </div>

        {/* The desk blotter: score, suspicion, and the values on file. */}
        <div className="flex flex-col gap-2.5 border border-accent/15 bg-ink/40 p-3 text-[10px] uppercase tracking-[0.12em]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Score</span>
            <span key={score} className="casa-anim-pop text-sm tracking-[0.08em] text-accent">
              {score}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Shift</span>
            <span className="text-white/75">
              {shiftIndex + 1} / {SHIFTS.length}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Streak</span>
            <span className="text-white/75">{streak > 0 ? `×${streak}` : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Suspicion</span>
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: MAX_SUSPICION }, (_, i) => (
                <span
                  key={i}
                  className={`grid h-4 w-4 place-items-center border text-[10px] ${
                    i < suspicion
                      ? "casa-anim-pop border-accent bg-accent/20 text-accent"
                      : "border-white/15 text-white/30"
                  }`}
                >
                  {i < suspicion ? "!" : "·"}
                </span>
              ))}
            </span>
          </div>
          <div className="mt-1 border-t border-white/10 pt-2 normal-case tracking-normal">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/40">On file</p>
            <p className="mt-1 font-mono text-[10px] text-white/60">{SEAL}</p>
            <p className="font-mono text-[10px] text-white/60">{OFFICE}</p>
            <p className="font-mono text-[10px] text-white/60">{DATE}</p>
          </div>
          <p className="normal-case tracking-normal text-[10px] leading-relaxed text-white/40">
            {shift.brief}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {running ? (
          <>
            <button
              type="button"
              onClick={() => decide(true)}
              disabled={locked}
              className="border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-40"
            >
              Stamp
            </button>
            <button
              type="button"
              onClick={() => decide(false)}
              disabled={locked}
              className="border border-accent/30 px-4 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-40"
            >
              Reject
            </button>
            {!reducedMotion && (
              <button
                type="button"
                onClick={pause}
                disabled={locked}
                className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Pause
              </button>
            )}
          </>
        ) : phase === "paused" ? (
          <button
            type="button"
            onClick={resume}
            className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Resume the shift
          </button>
        ) : phase === "summary" ? (
          <button
            type="button"
            onClick={beginShift}
            className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Begin the next shift
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Reopen the desk
          </button>
        )}
        <CasablancaMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
      </div>

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function CasablancaLetters({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="casablanca-letters-title"
      gameId="casablanca-letters"
      eyebrow="Prefecture desk"
      title="Letters of transit"
      startLabel="Open the desk"
      stage
      howToPlay={{
        objective:
          "Sort all fifteen papers across three shifts — stamp the genuine, reject the forged.",
        controls: [
          { keys: "Stamp", does: "clear a paper whose three fields match the values on file" },
          { keys: "Reject", does: "refuse a paper with any altered field" },
          { keys: "Pause", does: "freeze the gendarme's patience while you read" },
          { keys: "Begin", does: "open the next shift from the summary card" },
        ],
        tip: "Three misjudged papers close the desk, and each wrong call also shortens the gendarme's patience. Reduced motion drops the clock and the pause control — only suspicion can end the run there.",
      }}
      reference={{
        quote: "Round up the usual suspects.",
        scene: "Casablanca (1943) · refugees at Rick's café, the stolen transit letters",
      }}
      onClose={onClose}
    >
      <TransitDesk />
    </SimulationShell>
  );
}
