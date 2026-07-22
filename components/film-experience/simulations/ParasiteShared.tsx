"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext, playTone } from "@/lib/filmAudio";

/**
 * Shared plumbing for the four Parasite games: one lazily created AudioContext
 * per game (opened on the first user gesture, closed on unmount), a visible
 * mute contract, a sustained voice for the flood/hold drones, and the CSS
 * keyframes every game's feedback leans on. All tones are self-rendered
 * oscillators — never film audio.
 */

const MASTER_GAIN = 0.055;

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain relative to master; kept subtle. */
  gain?: number;
  /** Optional glide target. */
  slideTo?: number;
  /** Seconds from now, for tiny arpeggios. */
  delay?: number;
}>;

export type ParasiteAudio = Readonly<{
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Create (or resume) the context. Call from a real user-gesture handler. */
  unlock: () => void;
  tone: (spec: ToneSpec) => void;
  /** Soft rising tick; `step` nudges pitch with a streak. */
  blip: (step?: number) => void;
  /** Affirmative two-note nod — a placement lands, a symbol reads true. */
  ok: () => void;
  /** Dull thunk — a wrong choice, a rejected symbol. */
  wrong: () => void;
  /** Ascending arpeggio — a stage, room, or level cleared. */
  clear: () => void;
  /** Descending pair — the run ends badly. */
  fail: () => void;
  /** Three-note figure — the whole game finished. */
  win: () => void;
  /** Wet plink for water and drips. */
  drip: () => void;
  /** Start a sustained bed (flood rumble, signal carrier). */
  startDrone: (freq: number, type?: OscillatorType) => void;
  setDroneFreq: (freq: number) => void;
  stopDrone: () => void;
}>;

/**
 * The audio kit. Identity is stable across renders so effects that depend on
 * it don't churn; only `muted` flips it.
 */
export function useParasiteAudio(): ParasiteAudio {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
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
    playTone(ctx, master, spec, { attack: 0.012 });
  }, []);

  const startDrone = useCallback(
    (freq: number, type: OscillatorType = "sawtooth") => {
      const ctx = contextRef.current;
      const master = masterRef.current;
      if (!ctx || !master || droneRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.28, ctx.currentTime, 0.12);
      osc.connect(gain).connect(master);
      osc.start();
      droneRef.current = { osc, gain };
    },
    []
  );

  const setDroneFreq = useCallback((freq: number) => {
    const ctx = contextRef.current;
    const drone = droneRef.current;
    if (!ctx || !drone) return;
    drone.osc.frequency.setTargetAtTime(Math.max(1, freq), ctx.currentTime, 0.08);
  }, []);

  const stopDrone = useCallback(() => {
    const ctx = contextRef.current;
    const drone = droneRef.current;
    droneRef.current = null;
    if (!ctx || !drone) return;
    drone.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
    try {
      drone.osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Already stopped.
    }
  }, []);

  // Nothing in the audio graph outlives the dialog.
  useEffect(() => {
    return () => {
      const drone = droneRef.current;
      droneRef.current = null;
      try {
        drone?.osc.stop();
      } catch {
        // Already stopped.
      }
      const ctx = contextRef.current;
      contextRef.current = null;
      masterRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return useMemo<ParasiteAudio>(
    () => ({
      muted,
      setMuted,
      unlock,
      tone,
      blip: (step = 0) => {
        const base = 460 + Math.min(Math.max(step, 0), 24) * 16;
        tone({ freq: base, slideTo: base * 1.14, type: "square", duration: 0.05, gain: 0.45 });
      },
      ok: () => {
        tone({ freq: 523.25, duration: 0.09, gain: 0.7 });
        tone({ freq: 784, duration: 0.14, gain: 0.7, delay: 0.07 });
      },
      wrong: () => tone({ freq: 165, slideTo: 74, type: "sawtooth", duration: 0.2, gain: 0.6 }),
      clear: () => {
        tone({ freq: 440, duration: 0.09, gain: 0.75 });
        tone({ freq: 587.33, duration: 0.09, gain: 0.75, delay: 0.08 });
        tone({ freq: 880, duration: 0.16, gain: 0.75, delay: 0.16 });
      },
      fail: () => {
        tone({ freq: 196, slideTo: 98, type: "sawtooth", duration: 0.3, gain: 0.65 });
        tone({ freq: 147, slideTo: 73, type: "sawtooth", duration: 0.38, gain: 0.55, delay: 0.11 });
      },
      win: () => {
        tone({ freq: 523.25, duration: 0.12, gain: 0.85 });
        tone({ freq: 659.25, duration: 0.12, gain: 0.85, delay: 0.11 });
        tone({ freq: 1046.5, duration: 0.32, gain: 0.85, delay: 0.22 });
      },
      drip: () => tone({ freq: 1180, slideTo: 520, type: "sine", duration: 0.11, gain: 0.4 }),
      startDrone,
      setDroneFreq,
      stopDrone,
    }),
    [muted, unlock, tone, startDrone, setDroneFreq, stopDrone]
  );
}

/** The visible mute every audible Parasite game carries. */
export function ParasiteMuteButton({
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

/** Small square control used for pause/restart/etc. across the four games. */
export function ParasiteChip({
  onClick,
  children,
  label,
  innerRef,
  bright = false,
  disabled = false,
}: {
  onClick: () => void;
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
      aria-label={label}
      disabled={disabled}
      className={`border px-2 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        bright
          ? "border-accent/60 text-accent-bright hover:bg-accent/15"
          : "border-accent/30 hover:bg-accent/10"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Feedback keyframes shared by the Parasite games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games stay fully playable.
 */
export function ParasiteKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes para-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes para-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes para-float { 0% { opacity: 0; transform: translateY(10px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
  @keyframes para-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes para-flash { 0% { opacity: 0.65; } 100% { opacity: 0; } }
  @keyframes para-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes para-sweep { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .para-pop { display: inline-block; animation: para-pop 220ms ease-out; }
  .para-shake { animation: para-shake 320ms ease-in-out; }
  .para-float { animation: para-float 1300ms ease-out forwards; }
  .para-rise { animation: para-rise 240ms ease-out both; }
  .para-flash { animation: para-flash 380ms ease-out forwards; }
  .para-throb { animation: para-throb 800ms ease-in-out infinite; }
  .para-sweep { transform-origin: left center; animation: para-sweep 420ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  .para-press:active { transform: scale(0.96); }
}
`}</style>
  );
}
