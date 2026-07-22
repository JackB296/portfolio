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

// Extended pitch set to play the authentic melody of "As Time Goes By"
// Keys mapped to: a, s, d, f, g, h, j
const KEYS = [
  { id: "D", label: "D", freq: 293.66, hint: "a" },
  { id: "E", label: "E", freq: 329.63, hint: "s" },
  { id: "F", label: "F", freq: 349.23, hint: "d" },
  { id: "G", label: "G", freq: 392.00, hint: "f" },
  { id: "A", label: "A", freq: 440.00, hint: "g" },
  { id: "Bb", label: "B♭", freq: 466.16, hint: "h" },
  { id: "C", label: "C", freq: 523.25, hint: "j" },
] as const;
type KeyId = (typeof KEYS)[number]["id"];

// "You must re-mem-ber this, a kiss is just a kiss, a sigh is just a sigh"
const SEQUENCE: readonly KeyId[] = [
  "A", "Bb", "A", "G", "A", "F",  // You must re-mem-ber this
  "A", "Bb", "A", "G", "A", "E",  // A kiss is just a kiss
  "A", "Bb", "A", "G", "A", "D",  // A sigh is just a sigh
  "E", "F", "G", "A", "Bb", "C", "D", "C", // The fun-da-men-tal things ap-ply
  "D", "E", "F"                   // As time goes by
];

// Stable render list for the lane
const NOTE_SLOTS = SEQUENCE.map((key, seqIndex) => ({ seqIndex, key }));

// Sam plays the phrase three times, picking up the tempo each verse.
const VERSES = [1, 1.2, 1.45] as const;
const NOTE_GAP_MS = 650;
const FALL_MS = 2000;
const HIT_WINDOW_MS = 320;
const PERFECT_WINDOW_MS = 120;
const SCORE_ID = "casablanca-piano";

type Phase = "playing" | "break" | "done";
type FallingNote = {
  seqIndex: number;
  key: KeyId;
  spawn: number;
  struck: boolean;
  missed: boolean;
};
type Judgment = { id: number; text: "perfect" | "good" | "missed" | "early" };
type Burst = { id: number; lane: number; perfect: boolean };

const gapFor = (v: number) => NOTE_GAP_MS / VERSES[v];
const fallFor = (v: number) => FALL_MS / VERSES[v];

function Keyboard() {
  const [phase, setPhase] = useState<Phase>("playing");
  const [verse, setVerse] = useState(0);
  const [hits, setHits] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flash, setFlash] = useState<KeyId | null>(null);
  const [nextIndex, setNextIndex] = useState(0); // reduced-motion step pointer
  const reducedMotion = useReducedMotion();
  const audio = useCasablancaAudio();

  const laneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const notesRef = useRef<FallingNote[]>([]);
  const hitsRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const perfectsRef = useRef(0);
  const verseRef = useRef(0);
  const phaseRef = useRef<Phase>("playing");
  const idRef = useRef(0);

  const tone = useCallback(
    (freq: number, soft = false) => {
      audio.play({ freq, type: "triangle", duration: 0.55, gain: soft ? 0.05 : 0.13 });
    },
    [audio]
  );

  const finish = useCallback(() => {
    phaseRef.current = "done";
    setPhase("done");
    recordSimulationScore(SCORE_ID, scoreRef.current);
  }, []);

  const startVerse = useCallback((v: number) => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    verseRef.current = v;
    setVerse(v);
    setNextIndex(0);
    setFlash(null);
    setJudgment(null);
    phaseRef.current = "playing";
    setPhase("playing");
    notesRef.current = SEQUENCE.map((key, seqIndex) => ({
      seqIndex,
      key,
      spawn: seqIndex * gapFor(v),
      struck: false,
      missed: false,
    }));
    // Reset lane elements
    const lane = laneRef.current;
    if (lane) {
      for (const el of lane.querySelectorAll<HTMLElement>("[data-note]")) {
        el.style.opacity = "0";
        el.style.top = "0%";
        el.style.boxShadow = "none";
      }
    }
    startRef.current = performance.now();
  }, []);

  const restart = useCallback(() => {
    hitsRef.current = 0;
    scoreRef.current = 0;
    comboRef.current = 0;
    perfectsRef.current = 0;
    setHits(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setPerfects(0);
    setBursts([]);
    startVerse(0);
  }, [startVerse]);

  useEffect(() => {
    restart();
  }, [restart]);

  useEffect(() => {
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const verseDone = useCallback(() => {
    if (verseRef.current + 1 >= VERSES.length) {
      finish();
      return;
    }
    phaseRef.current = "break";
    setPhase("break");
    audio.play({ freq: 392, duration: 0.25, gain: 0.08 });
    audio.play({ freq: 523.25, duration: 0.35, gain: 0.08, delay: 0.12 });
  }, [audio, finish]);

  useEffect(() => {
    if (reducedMotion || phase !== "playing") return;
    const lane = laneRef.current;
    if (!lane) return;

    const fall = fallFor(verse);
    const step = () => {
      if (!document.hidden) {
        const elapsed = performance.now() - startRef.current;
        let live = 0;
        for (const note of notesRef.current) {
          const age = elapsed - note.spawn;
          const el = lane.querySelector<HTMLElement>(`[data-note="${note.seqIndex}"]`);
          if (age < 0) {
            if (el) el.style.opacity = "0";
            live += 1;
            continue;
          }
          const fraction = age / fall;
          if (el) {
            el.style.opacity = note.struck ? "0" : "1";
            el.style.top = `${Math.min(100, fraction * 100).toFixed(1)}%`;
            const inWindow =
              !note.struck && age >= fall - HIT_WINDOW_MS && age <= fall + HIT_WINDOW_MS;
            el.style.boxShadow = inWindow ? "0 0 10px 2px rgb(var(--accent-rgb) / 0.5)" : "none";
          }
          if (!note.struck && age > fall + HIT_WINDOW_MS && !note.missed) {
            note.missed = true;
            comboRef.current = 0;
            setCombo(0);
            idRef.current += 1;
            setJudgment({ id: idRef.current, text: "missed" });
          }
          if (!note.struck && age <= fall + HIT_WINDOW_MS) live += 1;
        }
        if (live === 0) {
          verseDone();
          return;
        }
      }
      rafRef.current = window.requestAnimationFrame(step);
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, phase, verse, verseDone]);

  const registerHit = useCallback((key: KeyId, perfect: boolean) => {
    hitsRef.current += 1;
    setHits(hitsRef.current);
    const comboBefore = comboRef.current;
    comboRef.current = comboBefore + 1;
    setCombo(comboRef.current);
    setBestCombo((b) => Math.max(b, comboRef.current));
    scoreRef.current += (perfect ? 200 : 100) + comboBefore * 10;
    setScore(scoreRef.current);
    if (perfect) {
      perfectsRef.current += 1;
      setPerfects(perfectsRef.current);
    }
    idRef.current += 1;
    setJudgment({ id: idRef.current, text: perfect ? "perfect" : "good" });
    setFlash(key);
    window.setTimeout(() => setFlash((current) => (current === key ? null : current)), 140);
    const lane = KEYS.findIndex((k) => k.id === key);
    setBursts((current) => [...current, { id: idRef.current, lane, perfect }]);
    const burstId = idRef.current;
    window.setTimeout(
      () => setBursts((current) => current.filter((b) => b.id !== burstId)),
      460
    );
  }, []);

  const strike = useCallback(
    (key: KeyId, freq: number) => {
      if (phaseRef.current !== "playing") return;

      if (reducedMotion) {
        tone(freq);
        const expected = SEQUENCE[nextIndex];
        if (key === expected) {
          registerHit(key, true);
          const advanced = nextIndex + 1;
          setNextIndex(advanced);
          if (advanced >= SEQUENCE.length) verseDone();
        }
        return;
      }

      const fall = fallFor(verseRef.current);
      const elapsed = performance.now() - startRef.current;
      const candidate = notesRef.current.find((note) => {
        if (note.struck || note.key !== key) return false;
        const age = elapsed - note.spawn;
        return age >= fall - HIT_WINDOW_MS && age <= fall + HIT_WINDOW_MS;
      });
      if (candidate) {
        candidate.struck = true;
        tone(freq);
        const offset = Math.abs(elapsed - candidate.spawn - fall);
        registerHit(key, offset <= PERFECT_WINDOW_MS);
      } else {
        tone(freq, true);
        comboRef.current = 0;
        setCombo(0);
        idRef.current += 1;
        setJudgment({ id: idRef.current, text: "early" });
      }
    },
    [nextIndex, reducedMotion, registerHit, tone, verseDone]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const match = KEYS.find((k) => k.hint === event.key.toLowerCase());
      if (match) strike(match.id, match.freq);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [strike]);

  const status = useMemo(() => {
    if (phase === "done")
      return `Sam plays it through — ${score} points, best combo ${bestCombo}, ${perfects} perfect.`;
    if (phase === "break") return `Verse ${verse + 1} cleared. Sam picks up the tempo.`;
    if (reducedMotion)
      return `Verse ${verse + 1} of ${VERSES.length} — play the lit key: note ${Math.min(nextIndex + 1, SEQUENCE.length)} of ${SEQUENCE.length}.`;
    return `Verse ${verse + 1} of ${VERSES.length} — strike each key as its note reaches the line.`;
  }, [phase, score, bestCombo, perfects, verse, reducedMotion, nextIndex]);

  return (
    <div
      data-sim-state={phase}
      data-piano-hits={hits}
      data-piano-score={score}
      data-piano-verse={verse + 1}
      className="flex flex-col gap-3"
    >
      <CasablancaKeyframes />

      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/45">
        <span>
          Verse {verse + 1} / {VERSES.length}
        </span>
        <span key={score} className="casa-anim-pop text-accent">
          {score} pts
        </span>
        <span>{combo > 1 ? `combo ×${combo}` : "—"}</span>
      </div>

      <div className="h-1 w-full bg-white/10" aria-hidden>
        <div
          className="h-full bg-accent/80 transition-all duration-200"
          style={{ width: `${Math.min(combo, 10) * 10}%` }}
        />
      </div>

      <div className="relative h-44 overflow-hidden border border-accent/25 bg-ink/60 sm:h-60">
        <div aria-hidden className="absolute inset-0 grid grid-cols-7">
          {KEYS.map((key) => (
            <div key={key.id} className="border-r border-white/5 last:border-r-0" />
          ))}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-6 h-px bg-accent/60" />
        {judgment && (
          <span
            key={judgment.id}
            aria-hidden
            className="casa-anim-rise absolute bottom-8 right-3 text-[10px] uppercase tracking-[0.2em] text-accent"
          >
            {judgment.text}
          </span>
        )}
        {bursts.map((burst) => (
          <span
            key={burst.id}
            aria-hidden
            className={`casa-anim-burst absolute bottom-4 h-8 w-8 rounded-full border ${
              burst.perfect ? "border-accent" : "border-accent/50"
            }`}
            style={{ left: `${((burst.lane + 0.5) / KEYS.length) * 100}%` }}
          />
        ))}
        {reducedMotion ? (
          <div aria-hidden className="flex h-full flex-wrap content-center justify-center gap-1.5 p-2">
            {SEQUENCE.map((key, i) => (
              <span
                key={i}
                className={`grid h-7 w-7 place-items-center border text-[10px] ${
                  i === nextIndex
                    ? "border-accent bg-accent/20 text-accent"
                    : i < nextIndex
                      ? "border-accent/20 text-white/30"
                      : "border-white/10 text-white/50"
                }`}
              >
                {key}
              </span>
            ))}
          </div>
        ) : (
          <div ref={laneRef} aria-hidden className="absolute inset-0">
            {NOTE_SLOTS.map((note) => (
              <div
                key={note.seqIndex}
                data-note={note.seqIndex}
                className="absolute grid h-6 w-6 -translate-x-1/2 place-items-center border border-accent/40 bg-ink/80 text-[10px] text-accent"
                style={{
                  left: `${((KEYS.findIndex((k) => k.id === note.key) + 0.5) / KEYS.length) * 100}%`,
                  top: "0%",
                  opacity: 0,
                }}
              >
                {note.key}
              </div>
            ))}
          </div>
        )}
        {phase !== "playing" && (
          <div
            aria-hidden
            className="casa-anim-rise absolute inset-0 grid place-items-center bg-ink/80 p-4 text-center"
          >
            {phase === "break" ? (
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                <p className="text-sm text-accent">Verse {verse + 1} cleared</p>
                <p className="mt-1">Tempo rises to ×{VERSES[verse + 1]}</p>
              </div>
            ) : (
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                <p className="text-sm text-accent">{score} points</p>
                <p className="mt-1">
                  {hits} notes · best combo {bestCombo} · {perfects} perfect
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1" style={{ touchAction: "manipulation" }}>
        {KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            onClick={() => strike(key.id, key.freq)}
            disabled={phase !== "playing"}
            aria-label={`Play ${key.label}`}
            className={`border py-3 text-[11px] uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-40 sm:py-4 ${
              flash === key.id
                ? "border-accent bg-accent/25 text-accent"
                : "border-accent/30 text-white/70 hover:bg-accent/10"
            }`}
          >
            {key.label}
            <span className="mt-0.5 block text-[8px] normal-case text-white/35">{key.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/55">
          {status}
        </p>
        <span className="flex gap-2">
          {phase === "break" && (
            <button
              type="button"
              onClick={() => startVerse(verse + 1)}
              className="shrink-0 border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Next verse
            </button>
          )}
          {phase === "done" && (
            <button
              type="button"
              onClick={restart}
              className="shrink-0 border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Play it again
            </button>
          )}
          <CasablancaMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
        </span>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function CasablancaPiano({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="casablanca-piano-title"
      gameId="casablanca-piano"
      eyebrow="Rick's café"
      title="Play it, Sam"
      startLabel="Sit at the piano"
      stage
      howToPlay={{
        objective: "Play the classic 'As Time Goes By' melody across three verses as the tempo climbs.",
        controls: [
          { keys: "a s d f g h j", does: "strike D, E, F, G, A, B♭, and C as notes reach the line" },
          { keys: "click", does: "play the on-screen piano keys" },
          { keys: "Next verse", does: "start the next, faster verse after a break" },
        ],
        tip: "Land a note dead on the line for a perfect and build your combo multiplier. Reduced motion swaps the falling lane for a step-through — strike the lit note in order, at your own pace.",
      }}
      reference={{
        quote: "Play it, Sam. Play 'As Time Goes By.'",
        scene: "Casablanca (1942) · Ilsa asks Sam for the song Rick banned",
      }}
      onClose={onClose}
    >
      <Keyboard />
    </SimulationShell>
  );
}
