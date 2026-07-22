"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext, playTone, type ToneSpec } from "@/lib/filmAudio";

/**
 * Shared plumbing for the four The Batman games: one lazily created
 * AudioContext per game (opened on the first user gesture, closed on unmount),
 * a visible mute contract, a sustained voice for the rain bed and the trace
 * hum, and the CSS keyframes every game's feedback leans on. All tones are
 * self-rendered oscillators — never film audio.
 *
 * The palette of cues is deliberately low and wet: this film is a detective
 * picture shot in the rain, so the affirmatives are muted fifths rather than
 * bright arpeggios, and failure drops rather than buzzes.
 */

const MASTER_GAIN = 0.05;

export type BatmanAudio = Readonly<{
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Create (or resume) the context. Call from a real user-gesture handler. */
  unlock: () => void;
  tone: (spec: ToneSpec) => void;
  /** Dry tick — a dial nudge, a beam step, a pin going in. */
  tick: (step?: number) => void;
  /** A word, mark, or thread locking into place. */
  lock: () => void;
  /** Affirmative low fifth — a correct read. */
  ok: () => void;
  /** Dull thunk — a wrong link, a bad tag, a mis-timed step. */
  wrong: () => void;
  /** Rising figure — a card, scene, or stage cleared. */
  clear: () => void;
  /** Descending pair — the run ends badly. */
  fail: () => void;
  /** Three-note figure — the whole game finished. */
  win: () => void;
  /** Airy sweep — a searchlight passing, a beam swinging. */
  sweep: () => void;
  /** Start a sustained bed (rain hiss, trace hum). */
  startDrone: (freq: number, type?: OscillatorType) => void;
  setDroneFreq: (freq: number) => void;
  stopDrone: () => void;
}>;

/**
 * The audio kit. Identity is stable across renders so effects that depend on
 * it don't churn; only `muted` flips it.
 */
export function useBatmanAudio(): BatmanAudio {
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
    playTone(ctx, master, spec, { defaultType: "triangle", attack: 0.01, stopTail: 0.03 });
  }, []);

  const startDrone = useCallback((freq: number, type: OscillatorType = "sawtooth") => {
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
  }, []);

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

  return useMemo<BatmanAudio>(
    () => ({
      muted,
      setMuted,
      unlock,
      tone,
      tick: (step = 0) => {
        const base = 300 + Math.min(Math.max(step, 0), 24) * 9;
        tone({ freq: base, type: "square", duration: 0.035, gain: 0.3 });
      },
      lock: () => {
        tone({ freq: 196, duration: 0.07, gain: 0.6 });
        tone({ freq: 294, duration: 0.16, gain: 0.55, delay: 0.06 });
      },
      ok: () => {
        tone({ freq: 220, duration: 0.1, gain: 0.65 });
        tone({ freq: 330, duration: 0.18, gain: 0.6, delay: 0.08 });
      },
      wrong: () => tone({ freq: 150, slideTo: 62, type: "sawtooth", duration: 0.24, gain: 0.6 }),
      clear: () => {
        tone({ freq: 262, duration: 0.1, gain: 0.7 });
        tone({ freq: 349, duration: 0.1, gain: 0.7, delay: 0.09 });
        tone({ freq: 523.25, duration: 0.2, gain: 0.65, delay: 0.18 });
      },
      fail: () => {
        tone({ freq: 175, slideTo: 87, type: "sawtooth", duration: 0.34, gain: 0.65 });
        tone({ freq: 131, slideTo: 65, type: "sawtooth", duration: 0.44, gain: 0.55, delay: 0.12 });
      },
      win: () => {
        tone({ freq: 196, duration: 0.14, gain: 0.85 });
        tone({ freq: 294, duration: 0.14, gain: 0.85, delay: 0.13 });
        tone({ freq: 392, duration: 0.4, gain: 0.8, delay: 0.26 });
      },
      sweep: () => tone({ freq: 900, slideTo: 240, type: "sine", duration: 0.3, gain: 0.28 }),
      startDrone,
      setDroneFreq,
      stopDrone,
    }),
    [muted, unlock, tone, startDrone, setDroneFreq, stopDrone]
  );
}

// The canvas sizer now lives in a shared hook; re-exported here so the The
// Batman games keep importing it from their own barrel.
export { useCanvasAutoSize } from "@/lib/useCanvasSize";

/** The visible mute every audible The Batman game carries. */
export function BatmanMuteButton({
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

/** Small square control used for pause/restart/hint across the four games. */
export function BatmanChip({
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
      className={`bat-press border px-2 py-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        bright
          ? "border-accent/60 text-accent-bright hover:bg-accent/15"
          : "border-accent/30 hover:bg-accent/10"
      }`}
    >
      {children}
    </button>
  );
}

/** The five-glyph readout (▮ filled / ▯ empty) for a 0–100 percentage. */
export function batmanMeterGlyphs(pct: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(pct / 20)));
  return `${"▮".repeat(filled)}${"▯".repeat(5 - filled)}`;
}

/**
 * Imperatively repaint a BatmanMeter's bar, percentage, and glyph readout from
 * a 0–100 value, off the React path — the games drive their meters from the
 * canvas loop rather than by re-rendering. Pairs with a <BatmanMeter> whose
 * barRef/textRef/glyphRef are passed here.
 */
export function paintBatmanMeter(
  barRef: React.RefObject<HTMLDivElement>,
  textRef: React.RefObject<HTMLSpanElement>,
  glyphRef: React.RefObject<HTMLSpanElement>,
  pct: number
) {
  const clamped = Math.max(0, Math.min(100, pct));
  if (barRef.current) barRef.current.style.width = `${clamped.toFixed(1)}%`;
  if (textRef.current) textRef.current.textContent = `${Math.round(clamped)}%`;
  if (glyphRef.current) glyphRef.current.textContent = batmanMeterGlyphs(clamped);
}

/**
 * A meter that never relies on color alone: a filled bar plus a five-glyph
 * readout, so trace pressure, battery, alert, and certainty all stay legible
 * to anyone who cannot separate the accent from the ink.
 */
export function BatmanMeter({
  label,
  value,
  max = 100,
  barRef,
  textRef,
  glyphRef,
}: {
  label: string;
  value: number;
  max?: number;
  barRef?: React.Ref<HTMLDivElement>;
  textRef?: React.Ref<HTMLSpanElement>;
  glyphRef?: React.Ref<HTMLSpanElement>;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <span className="relative inline-block h-1.5 w-14 bg-white/10 align-middle">
        <span
          ref={barRef as React.Ref<HTMLDivElement>}
          className="absolute inset-y-0 left-0 bg-accent/80"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span ref={textRef} className="tabular-nums text-accent">
        {Math.round(pct)}%
      </span>
      <span ref={glyphRef} aria-hidden className="text-accent/70">
        {batmanMeterGlyphs(pct)}
      </span>
    </span>
  );
}

/**
 * Feedback keyframes shared by the The Batman games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games stay fully playable.
 */
export function BatmanKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes bat-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes bat-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes bat-float { 0% { opacity: 0; transform: translateY(10px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
  @keyframes bat-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes bat-flash { 0% { opacity: 0.7; } 100% { opacity: 0; } }
  @keyframes bat-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes bat-ink { 0% { clip-path: inset(0 100% 0 0); opacity: 0.35; } 60% { opacity: 1; } 100% { clip-path: inset(0 0 0 0); opacity: 1; } }
  @keyframes bat-card-in { from { opacity: 0; transform: translateY(14px) rotate(-1.5deg); } to { opacity: 1; transform: translateY(0) rotate(0deg); } }
  @keyframes bat-jolt { 0% { transform: translate(0,0); } 25% { transform: translate(-3px, 2px); } 50% { transform: translate(3px, -2px); } 75% { transform: translate(-2px, -1px); } 100% { transform: translate(0,0); } }
  .bat-pop { display: inline-block; animation: bat-pop 220ms ease-out; }
  .bat-shake { animation: bat-shake 320ms ease-in-out; }
  .bat-float { animation: bat-float 1300ms ease-out forwards; }
  .bat-rise { animation: bat-rise 240ms ease-out both; }
  .bat-flash { animation: bat-flash 380ms ease-out forwards; }
  .bat-throb { animation: bat-throb 900ms ease-in-out infinite; }
  .bat-ink { animation: bat-ink 520ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  .bat-card-in { animation: bat-card-in 320ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  .bat-jolt { animation: bat-jolt 260ms ease-in-out; }
  .bat-press:active { transform: scale(0.96); }
}
`}</style>
  );
}
