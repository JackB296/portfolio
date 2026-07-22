"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext, playTone, type ToneSpec } from "@/lib/filmAudio";

/**
 * Shared plumbing for the four WALL·E games: one lazily created AudioContext
 * per game (opened on the first user gesture, closed on unmount), a visible
 * mute contract, a sustained voice for servo/thruster beds, and the CSS
 * keyframes the games' feedback leans on.
 *
 * Every tone is a self-rendered oscillator. WALL·E's own voice is a sampled
 * performance and is not ours to use; these are servo chirps and compactor
 * thunks built from square and sawtooth waves.
 */

const MASTER_GAIN = 0.05;

export type WallEAudio = Readonly<{
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Create (or resume) the context. Call from a real user-gesture handler. */
  unlock: () => void;
  tone: (spec: ToneSpec) => void;
  /** Servo chirp; `step` nudges pitch with a streak. */
  chirp: (step?: number) => void;
  /** Affirmative two-note nod — a clean sort, a clean cube. */
  ok: () => void;
  /** Dull reject — a wrong bin, a bounced object. */
  wrong: () => void;
  /** Hydraulic thunk — the ram lands. */
  thunk: () => void;
  /** Extinguisher hiss — a puff of thrust. */
  hiss: () => void;
  /** Ascending arpeggio — a shift, round, wave, or movement cleared. */
  clear: () => void;
  /** Descending pair — the run ends badly. */
  fail: () => void;
  /** Four-note figure — the whole game finished. */
  win: () => void;
  /** Start a sustained bed (belt hum, thruster wash). */
  startDrone: (freq: number, type?: OscillatorType) => void;
  setDroneFreq: (freq: number) => void;
  stopDrone: () => void;
}>;

/**
 * The audio kit. Identity is stable across renders so effects that depend on
 * it don't churn; only `muted` flips it.
 */
export function useWallEAudio(): WallEAudio {
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
    playTone(ctx, master, spec, { defaultType: "square", attack: 0.01, stopTail: 0.03 });
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
      gain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.14);
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
    drone.osc.frequency.setTargetAtTime(Math.max(1, freq), ctx.currentTime, 0.09);
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

  return useMemo<WallEAudio>(
    () => ({
      muted,
      setMuted,
      unlock,
      tone,
      chirp: (step = 0) => {
        const base = 520 + Math.min(Math.max(step, 0), 20) * 22;
        tone({ freq: base, slideTo: base * 1.22, type: "square", duration: 0.05, gain: 0.45 });
      },
      ok: () => {
        tone({ freq: 587.33, duration: 0.07, gain: 0.6 });
        tone({ freq: 880, duration: 0.12, gain: 0.6, delay: 0.06 });
      },
      wrong: () => tone({ freq: 180, slideTo: 82, type: "sawtooth", duration: 0.19, gain: 0.55 }),
      thunk: () => {
        tone({ freq: 120, slideTo: 46, type: "square", duration: 0.14, gain: 0.7 });
        tone({ freq: 62, slideTo: 40, type: "sawtooth", duration: 0.2, gain: 0.45, delay: 0.02 });
      },
      hiss: () =>
        tone({ freq: 2400, slideTo: 900, type: "triangle", duration: 0.09, gain: 0.28 }),
      clear: () => {
        tone({ freq: 440, duration: 0.08, gain: 0.7 });
        tone({ freq: 659.25, duration: 0.08, gain: 0.7, delay: 0.07 });
        tone({ freq: 880, duration: 0.16, gain: 0.7, delay: 0.15 });
      },
      fail: () => {
        tone({ freq: 220, slideTo: 98, type: "sawtooth", duration: 0.28, gain: 0.6 });
        tone({ freq: 147, slideTo: 66, type: "sawtooth", duration: 0.36, gain: 0.5, delay: 0.1 });
      },
      win: () => {
        tone({ freq: 523.25, duration: 0.1, gain: 0.8 });
        tone({ freq: 659.25, duration: 0.1, gain: 0.8, delay: 0.1 });
        tone({ freq: 783.99, duration: 0.1, gain: 0.8, delay: 0.2 });
        tone({ freq: 1046.5, duration: 0.3, gain: 0.8, delay: 0.3 });
      },
      startDrone,
      setDroneFreq,
      stopDrone,
    }),
    [muted, unlock, tone, startDrone, setDroneFreq, stopDrone]
  );
}

/** The visible mute every audible WALL·E game carries. */
export function WallEMuteButton({
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

/** Small control used for pause/restart/bins across the four games. */
export function WallEChip({
  onClick,
  children,
  label,
  innerRef,
  bright = false,
  disabled = false,
  pressed,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
  innerRef?: React.Ref<HTMLButtonElement>;
  bright?: boolean;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={`walle-press border px-2 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
 * A HUD readout that pops when its value changes. Reduced motion gets the new
 * number without the scale bounce.
 */
export function WallEReadout({
  label,
  value,
  reducedMotion,
}: {
  label: string;
  value: string | number;
  reducedMotion: boolean;
}) {
  return (
    <span>
      {label}{" "}
      <span
        key={String(value)}
        className={reducedMotion ? "text-accent" : "walle-pop text-accent"}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * Feedback keyframes shared by the WALL·E games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games stay fully playable.
 */
export function WallEKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes walle-pop { 0% { transform: scale(1.45); } 100% { transform: scale(1); } }
  @keyframes walle-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes walle-float { 0% { opacity: 0; transform: translateY(12px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateY(-28px); } }
  @keyframes walle-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes walle-flash { 0% { opacity: 0.7; } 100% { opacity: 0; } }
  @keyframes walle-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes walle-bloom { 0% { opacity: 0; transform: scale(0.4); } 45% { opacity: 1; } 100% { opacity: 0; transform: scale(2.4); } }
  @keyframes walle-sweep { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .walle-pop { display: inline-block; animation: walle-pop 220ms ease-out; }
  .walle-shake { animation: walle-shake 320ms ease-in-out; }
  .walle-float { animation: walle-float 1200ms ease-out forwards; }
  .walle-rise { animation: walle-rise 240ms ease-out both; }
  .walle-flash { animation: walle-flash 380ms ease-out forwards; }
  .walle-throb { animation: walle-throb 900ms ease-in-out infinite; }
  .walle-bloom { animation: walle-bloom 1100ms ease-out forwards; }
  .walle-sweep { transform-origin: left center; animation: walle-sweep 420ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  .walle-press:active { transform: scale(0.96); }
}
`}</style>
  );
}
