"use client";

import { createAudioContext, playTone } from "@/lib/filmAudio";

/**
 * Self-rendered audio cues for the Matrix trials. House rules: oscillator
 * voices only (no recorded assets), one AudioContext per game instance,
 * subtle master volume, torn down on unmount via dispose(). The context is
 * only created inside real user-gesture handlers (unlock); cues fired outside
 * a gesture play only if the context already runs, and every consumer shows a
 * visible mute control.
 */

const MASTER_GAIN = 0.05;

export type MatrixSimAudio = {
  /** Create (or resume) the context. Call from a user-gesture handler. */
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  /** Rising keystroke blip; `step` nudges the pitch upward with the combo. */
  blip: (step: number) => void;
  /** Dull thunk for a rejected keystroke. */
  error: () => void;
  /** Short ascending arpeggio for a cleared round or volley. */
  clear: () => void;
  /** Descending pair for a failed run. */
  fail: () => void;
  /** Three-note fanfare for finishing the whole trial. */
  win: () => void;
  /** Airy sweep when the dodge window opens. */
  whoosh: () => void;
  dispose: () => void;
};

export function createMatrixSimAudio(): MatrixSimAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  const unlock = () => {
    if (context) {
      if (context.state === "suspended") void context.resume();
      return;
    }
    context = createAudioContext();
    if (!context) return;
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(context.destination);
  };

  /** One enveloped oscillator: frequency glides `from → to` over `duration`. */
  const voice = (
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    peak = 1,
    delay = 0
  ) => {
    if (!context || !master || muted || context.state !== "running") return;
    playTone(
      context,
      master,
      { type, freq: from, slideTo: to, duration, gain: peak, delay },
      { attack: 0.012, stopTail: 0.02 }
    );
  };

  return {
    unlock,
    setMuted: (next) => {
      muted = next;
      if (master) master.gain.value = next ? 0 : MASTER_GAIN;
    },
    blip: (step) => {
      const base = 560 + Math.min(Math.max(step, 0), 30) * 18;
      voice("square", base, base * 1.18, 0.055, 0.5);
    },
    error: () => voice("sawtooth", 180, 70, 0.16, 0.7),
    clear: () => {
      voice("triangle", 440, 440, 0.09, 0.8);
      voice("triangle", 587, 587, 0.09, 0.8, 0.07);
      voice("triangle", 784, 784, 0.14, 0.8, 0.14);
    },
    fail: () => {
      voice("sawtooth", 220, 110, 0.28, 0.7);
      voice("sawtooth", 165, 82, 0.34, 0.6, 0.1);
    },
    win: () => {
      voice("triangle", 523, 523, 0.12, 0.9);
      voice("triangle", 659, 659, 0.12, 0.9, 0.1);
      voice("triangle", 1046, 1046, 0.3, 0.9, 0.2);
    },
    whoosh: () => voice("sine", 900, 140, 0.32, 0.45),
    dispose: () => {
      if (context && context.state !== "closed") void context.close();
      context = null;
      master = null;
    },
  };
}
