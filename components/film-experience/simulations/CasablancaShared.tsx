"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext } from "@/lib/filmAudio";

// Shared plumbing for the four Casablanca games: one lazily created
// AudioContext per game (opened on the first user gesture, closed on unmount),
// a visible-mute contract, a sustained "drone" voice for the runway engine
// hold, and the CSS keyframes the games' feedback animations lean on. All
// tones are self-rendered oscillators — never film audio.

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain; kept subtle by default. */
  gain?: number;
  /** Optional frequency glide target for whooshes. */
  slideTo?: number;
  /** Seconds from now, for tiny arpeggios. */
  delay?: number;
}>;

export function useCasablancaAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  // A live mute silences the sustained drone immediately, not just new tones.
  useEffect(() => {
    mutedRef.current = muted;
    const drone = droneRef.current;
    const ctx = contextRef.current;
    if (drone && ctx) {
      drone.gain.gain.setTargetAtTime(muted ? 0.0001 : 0.045, ctx.currentTime, 0.05);
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
      const duration = spec.duration ?? 0.35;
      const peak = spec.gain ?? 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "triangle";
      osc.frequency.setValueAtTime(spec.freq, now);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, now + duration);
      // A short plucked envelope so overlapping tones never smear or clip.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    },
    [ensureContext]
  );

  /** Start the sustained engine drone (runway hold). No-op if running. */
  const startDrone = useCallback(
    (freq: number) => {
      const ctx = ensureContext();
      if (!ctx || droneRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(mutedRef.current ? 0.0001 : 0.045, ctx.currentTime, 0.08);
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
    drone.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  }, []);

  const stopDrone = useCallback(() => {
    const ctx = contextRef.current;
    const drone = droneRef.current;
    droneRef.current = null;
    if (!ctx || !drone) return;
    const now = ctx.currentTime;
    drone.gain.gain.setTargetAtTime(0.0001, now, 0.05);
    drone.osc.stop(now + 0.3);
  }, []);

  // Close the context on unmount so no audio graph outlives the dialog.
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

  // A stable identity so callbacks and effects that lean on the audio kit
  // don't churn on every render.
  return useMemo(
    () => ({ muted, setMuted, play, startDrone, setDroneFreq, stopDrone }),
    [muted, play, startDrone, setDroneFreq, stopDrone]
  );
}

/** The visible mute every audible Casablanca game must carry. */
export function CasablancaMuteButton({
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
      className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {muted ? "sound off" : "sound on"}
    </button>
  );
}

/**
 * Feedback keyframes shared by the Casablanca games. Everything lives behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games remain fully playable.
 */
export function CasablancaKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes casa-paper-in {
    from { transform: translateX(55%) rotate(2.5deg); opacity: 0; }
    to { transform: translateX(0) rotate(0deg); opacity: 1; }
  }
  @keyframes casa-stamp-in {
    0% { transform: scale(2.1) rotate(-14deg); opacity: 0; }
    60% { transform: scale(0.94) rotate(-8deg); opacity: 1; }
    100% { transform: scale(1) rotate(-8deg); opacity: 1; }
  }
  @keyframes casa-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(2px); }
  }
  @keyframes casa-pop {
    0% { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  @keyframes casa-rise {
    from { transform: translateY(6px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes casa-burst {
    0% { transform: translate(-50%, 50%) scale(0.4); opacity: 0.9; }
    100% { transform: translate(-50%, 50%) scale(2); opacity: 0; }
  }
  .casa-anim-paper { animation: casa-paper-in 260ms ease-out both; }
  .casa-anim-stamp { animation: casa-stamp-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
  .casa-anim-shake { animation: casa-shake 320ms ease-in-out; }
  .casa-anim-pop { display: inline-block; animation: casa-pop 240ms ease-out; }
  .casa-anim-rise { animation: casa-rise 240ms ease-out both; }
  .casa-anim-burst { animation: casa-burst 420ms ease-out both; }
}
`}</style>
  );
}
