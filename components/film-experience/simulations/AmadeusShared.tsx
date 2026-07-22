"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext } from "@/lib/filmAudio";

/**
 * Shared plumbing for the three Amadeus games: one lazily created AudioContext
 * per game (opened on the first user gesture, closed on unmount), a visible
 * mute contract, and the CSS keyframes the games' feedback leans on.
 *
 * Every pitch here is rendered by a Web Audio oscillator from note names —
 * never film audio, never a sampled recording. The phrases the games play are
 * ORIGINAL lines written in the late-classical idiom (the idiom itself is not
 * anyone's property; Mozart's own compositions are public domain besides).
 */

const MASTER_GAIN = 0.06;

/** Equal-tempered pitch from a scientific note name: "A4", "F#5", "Bb3". */
const SEMITONES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function noteFreq(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim());
  if (!match) return 440;
  const [, letter, accidental, octave] = match;
  const semitone =
    SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  // A4 = 440 Hz sits at MIDI 69.
  const midi = (Number(octave) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

type ToneSpec = Readonly<{
  /** Hz, or a scientific note name resolved through `noteFreq`. */
  freq: number | string;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain relative to master; kept subtle. */
  gain?: number;
  /** Seconds from now — lets a game lay out a whole phrase in one call. */
  delay?: number;
  /** Fraction of the duration spent on the attack. Strings want a slower one. */
  attack?: number;
}>;

export type AmadeusAudio = Readonly<{
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Create (or resume) the context. Call from a real user-gesture handler. */
  unlock: () => void;
  tone: (spec: ToneSpec) => void;
  /** Lay out a run of notes back to back; returns the phrase length in seconds. */
  phrase: (
    notes: readonly Readonly<{ note: string | null; beats: number; gain?: number }>[],
    options?: Readonly<{ beat?: number; type?: OscillatorType; gain?: number; delay?: number }>
  ) => number;
  /** Pen-on-paper tick — a mark inspected, a note picked up. */
  scratch: () => void;
  /** Dry affirmative pair — the call was right. */
  ok: () => void;
  /** Dull thunk — a wrong call, a cut that fails. */
  wrong: () => void;
  /** Rising figure — a page read, a passage survived. */
  clear: () => void;
  /** Falling pair — the candle dies, the players scatter. */
  fail: () => void;
  /** A small original cadence — the whole game finished. */
  win: () => void;
}>;

/**
 * The audio kit. Identity is stable across renders so effects that lean on it
 * don't churn; only `muted` flips it.
 */
export function useAmadeusAudio(): AmadeusAudio {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
    const master = masterRef.current;
    const ctx = contextRef.current;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0.0001 : MASTER_GAIN, ctx.currentTime, 0.04);
    }
  }, [muted]);

  const unlock = useCallback(() => {
    const existing = contextRef.current;
    if (existing) {
      if (existing.state === "suspended") void existing.resume();
      return;
    }
    const ctx = createAudioContext();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = mutedRef.current ? 0.0001 : MASTER_GAIN;
    master.connect(ctx.destination);
    contextRef.current = ctx;
    masterRef.current = master;
  }, []);

  const tone = useCallback((spec: ToneSpec) => {
    const ctx = contextRef.current;
    const master = masterRef.current;
    // Cues fired outside a gesture play only if the context already runs.
    if (!ctx || !master || mutedRef.current || ctx.state !== "running") return;
    const at = ctx.currentTime + (spec.delay ?? 0);
    const duration = Math.max(0.03, spec.duration ?? 0.24);
    const peak = spec.gain ?? 0.8;
    const hz = typeof spec.freq === "string" ? noteFreq(spec.freq) : spec.freq;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type ?? "triangle";
    osc.frequency.setValueAtTime(Math.max(1, hz), at);
    const attack = Math.min(0.12, duration * (spec.attack ?? 0.06));
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.03);
  }, []);

  const phrase = useCallback<AmadeusAudio["phrase"]>(
    (notes, options) => {
      const beat = options?.beat ?? 0.34;
      let cursor = options?.delay ?? 0;
      for (const step of notes) {
        const length = step.beats * beat;
        if (step.note) {
          tone({
            freq: step.note,
            type: options?.type ?? "triangle",
            duration: Math.max(0.06, length * 0.92),
            gain: (step.gain ?? 1) * (options?.gain ?? 0.7),
            delay: cursor,
            attack: 0.12,
          });
        }
        cursor += length;
      }
      return cursor - (options?.delay ?? 0);
    },
    [tone]
  );

  // Nothing in the audio graph outlives the dialog.
  useEffect(() => {
    return () => {
      const ctx = contextRef.current;
      contextRef.current = null;
      masterRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return useMemo<AmadeusAudio>(
    () => ({
      muted,
      setMuted,
      unlock,
      tone,
      phrase,
      scratch: () =>
        tone({ freq: 2100, type: "square", duration: 0.035, gain: 0.16, attack: 0.02 }),
      ok: () => {
        tone({ freq: "D5", duration: 0.09, gain: 0.6 });
        tone({ freq: "A5", duration: 0.16, gain: 0.5, delay: 0.075 });
      },
      wrong: () => {
        tone({ freq: "G2", type: "sawtooth", duration: 0.22, gain: 0.5 });
        tone({ freq: "Ab2", type: "sawtooth", duration: 0.26, gain: 0.35, delay: 0.03 });
      },
      clear: () => {
        tone({ freq: "D5", duration: 0.1, gain: 0.6 });
        tone({ freq: "F#5", duration: 0.1, gain: 0.6, delay: 0.09 });
        tone({ freq: "A5", duration: 0.22, gain: 0.6, delay: 0.18 });
      },
      fail: () => {
        tone({ freq: "D4", type: "sawtooth", duration: 0.3, gain: 0.45 });
        tone({ freq: "Bb3", type: "sawtooth", duration: 0.42, gain: 0.4, delay: 0.12 });
      },
      win: () => {
        // An original four-note cadence in D — plain, and entirely ours.
        tone({ freq: "A4", duration: 0.14, gain: 0.6 });
        tone({ freq: "B4", duration: 0.14, gain: 0.6, delay: 0.13 });
        tone({ freq: "A4", duration: 0.14, gain: 0.6, delay: 0.26 });
        tone({ freq: "D5", duration: 0.4, gain: 0.7, delay: 0.39 });
        tone({ freq: "F#4", duration: 0.4, gain: 0.4, delay: 0.39 });
        tone({ freq: "D4", duration: 0.46, gain: 0.4, delay: 0.39 });
      },
    }),
    [muted, phrase, tone, unlock]
  );
}

/** The visible mute every audible Amadeus game carries. */
export function AmadeusMuteButton({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      className="border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {muted ? "unmute" : "mute"}
    </button>
  );
}

/** Small square control used for pause/restart/replay across the three games. */
export function AmadeusChip({
  onClick,
  onPointerDown,
  children,
  label,
  innerRef,
  bright = false,
  disabled = false,
}: {
  onClick: () => void;
  onPointerDown?: () => void;
  children: React.ReactNode;
  label?: string;
  innerRef?: React.Ref<HTMLButtonElement>;
  bright?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={label}
      disabled={disabled}
      className={`border px-2 py-1 uppercase tracking-[0.12em] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        bright
          ? "border-accent/60 text-accent-bright hover:bg-accent/15"
          : "border-accent/30 hover:bg-accent/10"
      }`}
    >
      {children}
    </button>
  );
}

/** A labelled meter: bar plus value, driven imperatively by the games. */
export function AmadeusMeter({
  label,
  barRef,
  valueRef,
  initial = "100%",
  tone: barTone = "accent",
}: {
  label: string;
  barRef?: React.Ref<HTMLDivElement>;
  valueRef?: React.Ref<HTMLSpanElement>;
  initial?: string;
  tone?: "accent" | "dim";
}) {
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between text-[9px] uppercase tracking-[0.16em] text-white/45">
        <span>{label}</span>
        <span ref={valueRef} className="text-accent">
          {initial}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-white/10" aria-hidden>
        <div
          ref={barRef}
          className={`h-full ${barTone === "accent" ? "bg-accent/80" : "bg-accent/40"}`}
          style={{ width: initial }}
        />
      </div>
    </div>
  );
}

/**
 * Feedback keyframes shared by the Amadeus games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games stay fully playable.
 */
export function AmadeusKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes amad-pop { 0% { transform: scale(1.45); } 100% { transform: scale(1); } }
  @keyframes amad-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes amad-float { 0% { opacity: 0; transform: translateY(8px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
  @keyframes amad-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes amad-page { from { opacity: 0; transform: translateX(26px) rotate(1.2deg); } to { opacity: 1; transform: translateX(0) rotate(0deg); } }
  @keyframes amad-stamp { 0% { opacity: 0; transform: scale(1.9); } 60% { opacity: 1; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes amad-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  .amad-pop { display: inline-block; animation: amad-pop 220ms ease-out; }
  /* Entrances deliberately carry NO fill-mode: the element's resting state is
     already the visible one, so if an animation is deferred or dropped the
     content still reads. A "both"-filled entrance that never starts leaves the
     win screen invisible, which is exactly the failure this avoids. */
  .amad-rise { animation: amad-rise 240ms ease-out; }
  .amad-float { animation: amad-float 1200ms ease-out forwards; }
  .amad-shake { animation: amad-shake 320ms ease-in-out; }
  .amad-page { animation: amad-page 280ms cubic-bezier(0.2, 0.8, 0.3, 1); }
  .amad-stamp { animation: amad-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
  .amad-throb { animation: amad-throb 900ms ease-in-out infinite; }
  .amad-press:active { transform: scale(0.96); }
}
`}</style>
  );
}
