"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioContext } from "@/lib/filmAudio";

// Shared sound kit for the Blade Runner simulations: short self-rendered
// oscillator chirps (no assets), created lazily on the first user gesture,
// closed on unmount, and always behind a visible mute. Volumes stay subtle —
// these are instrument clicks, not a soundtrack.

export type BleepKind = "probe" | "hit" | "miss" | "win" | "lose";

// Each bleep is a tiny score: [frequency Hz, start offset s, duration s].
const TONES: Record<BleepKind, ReadonlyArray<readonly [number, number, number]>> = {
  probe: [
    [520, 0, 0.06],
    [660, 0.07, 0.06],
  ],
  hit: [
    [660, 0, 0.07],
    [880, 0.08, 0.1],
  ],
  miss: [[170, 0, 0.14]],
  win: [
    [440, 0, 0.09],
    [554, 0.1, 0.09],
    [659, 0.2, 0.16],
  ],
  lose: [
    [330, 0, 0.11],
    [220, 0.12, 0.18],
  ],
};

export function useBladeRunnerBleeps() {
  const contextRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(
    () => () => {
      contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    },
    []
  );

  /** Play a bleep. Call from user-gesture handlers only. */
  const play = useCallback((kind: BleepKind) => {
    if (mutedRef.current) return;
    try {
      if (!contextRef.current || contextRef.current.state === "closed") {
        const created = createAudioContext();
        if (!created) return;
        contextRef.current = created;
      }
      const context = contextRef.current;
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      for (const [frequency, at, duration] of TONES[kind]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === "miss" || kind === "lose" ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.035, now + at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + at);
        oscillator.stop(now + at + duration + 0.02);
      }
    } catch {
      // Audio unavailable: the games stay fully playable in silence.
    }
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      mutedRef.current = !current;
      return !current;
    });
  }, []);

  return { play, muted, toggleMuted } as const;
}

/** The visible mute control every Blade Runner game carries in its HUD. */
export function BleepsToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      className="border border-accent/30 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/60 hover:bg-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {muted ? "sfx off" : "sfx on"}
    </button>
  );
}
