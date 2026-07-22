"use client";

import { createAudioContext, playTone } from "@/lib/filmAudio";

/**
 * Self-rendered cues for the two Goodfellas games. House rules: oscillator
 * voices only (never film audio), one AudioContext per game instance created
 * inside a real user gesture, subtle master volume, a visible mute on every
 * consumer, and dispose() on unmount so no graph outlives the dialog.
 *
 * The Copa take needs a sustained voice (the steadicam glide hum that tracks
 * momentum); the helicopter day needs a second sustained voice (rotor wash
 * that swells with paranoia). Both live here so neither game hand-rolls one.
 */

const MASTER_GAIN = 0.05;

export type GoodfellasSimAudio = {
  /** Create (or resume) the context. Call from a user-gesture handler. */
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  /** Sustained glide hum; `level` (0-1) sets pitch and presence. */
  setGlide: (level: number) => void;
  /** Sustained rotor wash; `level` (0-1) sets rate and presence. */
  setRotor: (level: number) => void;
  /** Wall or waiter scrape — a dull knock. */
  scrape: () => void;
  /** Passing a hazard by a hair. */
  nearMiss: () => void;
  /** A door frame swinging past. */
  clack: () => void;
  /** A task serviced / a beat played correctly. */
  tick: (step: number) => void;
  /** A meter entering the danger band. */
  warn: () => void;
  /** The take cut, or the day coming apart. */
  fail: () => void;
  /** Arrival at the table, or the end of the day. */
  fanfare: () => void;
  dispose: () => void;
};

export function createGoodfellasSimAudio(): GoodfellasSimAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  // Sustained voices are lazily built and then held for the game's lifetime.
  let glide: { osc: OscillatorNode; gain: GainNode } | null = null;
  let rotor: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode } | null =
    null;

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
    setGlide: (level) => {
      if (!context || !master || context.state !== "running") return;
      const clamped = Math.min(1, Math.max(0, level));
      if (!glide) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = 48;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        glide = { osc, gain };
      }
      const now = context.currentTime;
      glide.osc.frequency.setTargetAtTime(46 + clamped * 52, now, 0.09);
      glide.gain.gain.setTargetAtTime(Math.max(0.0001, clamped * 0.34), now, 0.09);
    },
    setRotor: (level) => {
      if (!context || !master || context.state !== "running") return;
      const clamped = Math.min(1, Math.max(0, level));
      if (!rotor) {
        // A low tone chopped by an LFO: the wash of blades, not a recording.
        const osc = context.createOscillator();
        const gain = context.createGain();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();
        osc.type = "triangle";
        osc.frequency.value = 62;
        gain.gain.value = 0.0001;
        lfo.type = "sine";
        lfo.frequency.value = 7;
        lfoGain.gain.value = 0.0001;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        lfo.start();
        rotor = { osc, gain, lfo, lfoGain };
      }
      const now = context.currentTime;
      rotor.gain.gain.setTargetAtTime(Math.max(0.0001, clamped * 0.2), now, 0.25);
      rotor.lfo.frequency.setTargetAtTime(6 + clamped * 9, now, 0.25);
      rotor.lfoGain.gain.setTargetAtTime(Math.max(0.0001, clamped * 0.16), now, 0.25);
    },
    scrape: () => voice("sawtooth", 150, 62, 0.18, 0.75),
    nearMiss: () => voice("sine", 780, 240, 0.22, 0.4),
    clack: () => voice("square", 320, 120, 0.07, 0.5),
    tick: (step) => {
      const base = 420 + Math.min(Math.max(step, 0), 24) * 16;
      voice("triangle", base, base * 1.2, 0.07, 0.6);
    },
    warn: () => {
      voice("square", 300, 300, 0.09, 0.55);
      voice("square", 240, 240, 0.11, 0.5, 0.11);
    },
    fail: () => {
      voice("sawtooth", 200, 96, 0.3, 0.7);
      voice("sawtooth", 150, 70, 0.36, 0.6, 0.1);
    },
    fanfare: () => {
      voice("triangle", 392, 392, 0.11, 0.85);
      voice("triangle", 523, 523, 0.11, 0.85, 0.1);
      voice("triangle", 659, 659, 0.13, 0.85, 0.2);
      voice("triangle", 784, 784, 0.32, 0.85, 0.3);
    },
    dispose: () => {
      try {
        glide?.osc.stop();
        rotor?.osc.stop();
        rotor?.lfo.stop();
      } catch {
        // Already stopped.
      }
      glide = null;
      rotor = null;
      if (context && context.state !== "closed") void context.close();
      context = null;
      master = null;
    },
  };
}
