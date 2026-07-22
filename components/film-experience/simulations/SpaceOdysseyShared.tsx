"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext } from "@/lib/filmAudio";

// Shared plumbing for the four 2001 games. Two of them speak (the bone toss
// and the docking waltz); the pod bay standoff and the memory-core disconnect
// are deliberately silent — HAL's degradation reads as ON-SCREEN text, never a
// voice. Every tone here is a self-rendered oscillator: one AudioContext per
// game instance, opened lazily inside a user gesture, closed on unmount, and
// always paired with a visible mute.

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain; kept deliberately quiet. */
  gain?: number;
  /** Optional glide target, for whooshes and falls. */
  slideTo?: number;
  /** Seconds from now, for small arpeggios and chords. */
  delay?: number;
}>;

export type OdysseyAudio = Readonly<{
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Create or resume the context. Safe to call from any gesture handler. */
  unlock: () => void;
  play: (spec: ToneSpec) => void;
}>;

export function useOdysseyAudio(): OdysseyAudio {
  const contextRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
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

  const unlock = useCallback(() => {
    ensureContext();
  }, [ensureContext]);

  const play = useCallback(
    (spec: ToneSpec) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== "running") return;
      const at = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.3;
      const peak = spec.gain ?? 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "sine";
      osc.frequency.setValueAtTime(Math.max(1, spec.freq), at);
      if (spec.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.slideTo), at + duration);
      }
      // A plucked envelope: overlapping waltz voices never smear or clip.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + duration + 0.05);
    },
    [ensureContext]
  );

  // No audio graph outlives the dialog.
  useEffect(() => {
    return () => {
      const ctx = contextRef.current;
      contextRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return useMemo(() => ({ muted, setMuted, unlock, play }), [muted, unlock, play]);
}

/** The visible mute every audible 2001 game carries. */
export function OdysseyMuteButton({
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
      {muted ? "sound off" : "sound on"}
    </button>
  );
}

/**
 * Feedback keyframes shared by the 2001 games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so a reduced-motion visitor gets
 * instant state changes rather than movement — never a broken blank.
 */
export function OdysseyKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes so-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes so-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes so-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 45% { transform: translateX(5px); } 70% { transform: translateX(-3px); } }
  @keyframes so-float { 0% { opacity: 0; transform: translate(-50%, 6px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -30px); } }
  @keyframes so-flash { from { opacity: 0.85; } to { opacity: 0; } }
  /* The core lifts out of the housing and the socket stays behind, dark and
     empty. Ending at opacity 0 would leave a hole in the bay instead. */
  @keyframes so-eject { 0% { opacity: 1; transform: translateY(0) scale(1); } 45% { opacity: 0.2; transform: translateY(-18px) scale(0.78); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes so-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.38; } }
  .so-rise { animation: so-rise 260ms ease-out both; }
  .so-pop { display: inline-block; animation: so-pop 240ms ease-out; }
  .so-shake { animation: so-shake 340ms ease-in-out; }
  .so-float { animation: so-float 1100ms ease-out forwards; }
  .so-flash { animation: so-flash 320ms ease-out forwards; }
  .so-eject { animation: so-eject 420ms ease-out; }
  .so-throb { animation: so-throb 780ms ease-in-out infinite; }
}
`}</style>
  );
}

/** Shared HUD chrome class for the small square control buttons. */
export const ODYSSEY_BUTTON =
  "border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:hover:bg-transparent";
