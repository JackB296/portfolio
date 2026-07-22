"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createAudioContext } from "@/lib/filmAudio";

// Shared plumbing for the four Arrival games. Everything here is film-agnostic
// machinery — one AudioContext per game opened on the first user gesture and
// closed on unmount, a visible mute, the feedback keyframes, and a canvas that
// keeps its backing store in step with its CSS box. All tones are self-rendered
// oscillators; never film audio.

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain; deliberately quiet — Arrival is a hushed film. */
  gain?: number;
  /** Optional glide target, for the fog swells. */
  slideTo?: number;
  /** Seconds from now, so a caller can voice a small chord. */
  delay?: number;
}>;

const DRONE_GAIN = 0.035;

/**
 * A tiny synth voice shared by the Arrival games: plucked tones for discrete
 * events, one sustained drone for the shell hum. The context is created lazily
 * (so it is always born inside a user gesture) and closed on unmount.
 */
export function useArrivalAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  // Muting has to silence the sustained drone immediately, not just new tones.
  useEffect(() => {
    mutedRef.current = muted;
    const drone = droneRef.current;
    const ctx = contextRef.current;
    if (drone && ctx) {
      drone.gain.gain.setTargetAtTime(muted ? 0.0001 : DRONE_GAIN, ctx.currentTime, 0.06);
    }
  }, [muted]);

  const ensureContext = useCallback((): AudioContext | null => {
    let ctx = contextRef.current;
    if (!ctx) {
      ctx = createAudioContext();
      if (!ctx) return null;
      contextRef.current = ctx;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }, []);

  const play = useCallback(
    (spec: ToneSpec) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.4;
      const peak = spec.gain ?? 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "sine";
      osc.frequency.setValueAtTime(spec.freq, now);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, now + duration);
      // A soft swell instead of a click: Arrival's palette has no hard attacks.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    },
    [ensureContext]
  );

  /** Start the sustained shell hum. No-op when one is already running. */
  const startDrone = useCallback(
    (freq: number) => {
      const ctx = ensureContext();
      if (!ctx || droneRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(mutedRef.current ? 0.0001 : DRONE_GAIN, ctx.currentTime, 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      droneRef.current = { osc, gain };
    },
    [ensureContext]
  );

  const setDroneFreq = useCallback((freq: number) => {
    const ctx = contextRef.current;
    const drone = droneRef.current;
    if (!ctx || !drone) return;
    drone.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
  }, []);

  const stopDrone = useCallback(() => {
    const ctx = contextRef.current;
    const drone = droneRef.current;
    droneRef.current = null;
    if (!ctx || !drone) return;
    const now = ctx.currentTime;
    drone.gain.gain.setTargetAtTime(0.0001, now, 0.08);
    drone.osc.stop(now + 0.4);
  }, []);

  // Nothing may outlive the dialog: stop the drone and close the context.
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
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return useMemo(
    () => ({ muted, setMuted, play, startDrone, setDroneFreq, stopDrone }),
    [muted, play, startDrone, setDroneFreq, stopDrone]
  );
}

/** The shared control styling, so four games stay one family. */
export const ARRIVAL_BUTTON =
  "border border-accent/35 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40";

/** The visible mute every audible Arrival game carries. */
export function ArrivalMuteButton({
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
      className={ARRIVAL_BUTTON}
    >
      {muted ? "sound off" : "sound on"}
    </button>
  );
}

/**
 * Feedback keyframes shared by the Arrival games. Every rule sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets the state
 * change without the movement — never a broken or blank frame.
 */
export function ArrivalKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes arr-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes arr-rise { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes arr-float { 0% { opacity: 0; transform: translateY(10px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
  @keyframes arr-shake { 0%, 100% { transform: translateX(0); } 22% { transform: translateX(-5px); } 46% { transform: translateX(4px); } 70% { transform: translateX(-3px); } 88% { transform: translateX(2px); } }
  @keyframes arr-bloom { 0% { transform: scale(0.55); opacity: 0.85; } 100% { transform: scale(1.9); opacity: 0; } }
  @keyframes arr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes arr-mirror { 0% { opacity: 0.25; } 40% { opacity: 1; } 100% { opacity: 0.25; } }
  @keyframes arr-draw { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }
  .arr-anim-pop { display: inline-block; animation: arr-pop 240ms ease-out; }
  .arr-anim-rise { animation: arr-rise 260ms ease-out both; }
  .arr-anim-float { animation: arr-float 1500ms ease-out forwards; }
  .arr-anim-shake { animation: arr-shake 340ms ease-in-out; }
  .arr-anim-bloom { animation: arr-bloom 900ms ease-out forwards; }
  .arr-anim-pulse { animation: arr-pulse 900ms ease-in-out infinite; }
  .arr-anim-mirror { animation: arr-mirror 1100ms ease-in-out; }
  .arr-anim-draw { stroke-dasharray: 120; animation: arr-draw 640ms ease-out both; }
}
`}</style>
  );
}

/**
 * "rgb(r, g, b)" → "rgba(r, g, b, a)".
 *
 * The canvases need dozens of accent tints per frame, and `accentAlpha` reads
 * a CSS custom property through `getComputedStyle` on every call — which
 * forces a style recalculation. Sampling the palette once per effect and
 * tinting it here keeps a frame's cost in the canvas rather than in layout.
 */
export const withAlpha = (rgb: string, alpha: number) =>
  rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

// The canvas sizers now live in a shared hook; re-exported here so the Arrival
// games keep importing them from their own barrel.
export { useCanvasSize, type CanvasSize } from "@/lib/useCanvasSize";
