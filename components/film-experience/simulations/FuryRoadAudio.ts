"use client";

import { createAudioContext, playTone } from "@/lib/filmAudio";

/**
 * Self-rendered cues for the four Fury Road games. House rules: oscillator
 * voices only (never film audio), one AudioContext per game instance created
 * inside a real user gesture, subtle master volume, a visible mute on every
 * consumer, and dispose() on unmount so no graph outlives the dialog.
 *
 * Two sustained voices carry the wasteland: an engine that tracks throttle
 * (the rig, the polecat's rushing convoy) and a wind bed that tracks dust
 * density (the storm, the leap's crosswind). Everything else is a short
 * enveloped blip.
 */

const MASTER_GAIN = 0.05;

export type FuryRoadAudio = {
  /** Create (or resume) the context. Call from a user-gesture handler. */
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  /** Sustained engine; `level` (0-1) sets pitch and presence. */
  setEngine: (level: number) => void;
  /** Sustained wind/dust bed; `level` (0-1) sets density and presence. */
  setWind: (level: number) => void;
  /** Chrome spray — a hiss that rises while the can is held. */
  spray: () => void;
  /** Metal on metal: a ram, a clipped wreck, a bolt landing. */
  impact: () => void;
  /** Slipping past something by a hair. */
  nearMiss: () => void;
  /** A rung of progress: a lane change, a pump, a beat called. */
  tick: (step: number) => void;
  /** Cargo caught, gap crossed, hazard dodged clean. */
  catchCue: () => void;
  /** A meter entering the danger band. */
  warn: () => void;
  /** The rig wrecked, the leap fallen, the storm taking you. */
  fail: () => void;
  /** A wave cleared, the run banked. */
  fanfare: () => void;
  dispose: () => void;
};

export function createFuryRoadAudio(): FuryRoadAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  // Sustained voices are lazily built and then held for the game's lifetime.
  let engine: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;
  let wind: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
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

  /** A burst of filtered noise: grit, spray, the crunch under an impact. */
  const noise = (duration: number, peak: number, from: number, to: number, delay = 0) => {
    if (!context || !master || muted || context.state !== "running") return;
    const at = context.currentTime + delay;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);
    filter.Q.value = 0.8;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(at);
    source.stop(at + duration + 0.02);
  };

  return {
    unlock,
    setMuted: (next) => {
      muted = next;
      if (master) master.gain.value = next ? 0 : MASTER_GAIN;
    },
    setEngine: (level) => {
      if (!context || !master || context.state !== "running") return;
      const clamped = Math.min(1, Math.max(0, level));
      if (!engine) {
        // Two detuned saws an octave apart: a big engine, not a beep.
        const osc = context.createOscillator();
        const sub = context.createOscillator();
        const gain = context.createGain();
        osc.type = "sawtooth";
        sub.type = "square";
        osc.frequency.value = 62;
        sub.frequency.value = 31;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        sub.connect(gain);
        gain.connect(master);
        osc.start();
        sub.start();
        engine = { osc, sub, gain };
      }
      const now = context.currentTime;
      engine.osc.frequency.setTargetAtTime(54 + clamped * 96, now, 0.08);
      engine.sub.frequency.setTargetAtTime(27 + clamped * 48, now, 0.08);
      engine.gain.gain.setTargetAtTime(Math.max(0.0001, clamped * 0.26), now, 0.1);
    },
    setWind: (level) => {
      if (!context || !master || context.state !== "running") return;
      const clamped = Math.min(1, Math.max(0, level));
      if (!wind) {
        // Two seconds of looped noise through a lowpass: dust, not static.
        const frames = context.sampleRate * 2;
        const buffer = context.createBuffer(1, frames, context.sampleRate);
        const data = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < frames; i += 1) {
          // A one-pole lowpass over white noise gives the low roar of wind.
          previous = previous * 0.96 + (Math.random() * 2 - 1) * 0.04;
          data[i] = previous * 6;
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        const gain = context.createGain();
        gain.gain.value = 0.0001;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        wind = { source, filter, gain };
      }
      const now = context.currentTime;
      wind.gain.gain.setTargetAtTime(Math.max(0.0001, clamped * 0.5), now, 0.3);
      wind.filter.frequency.setTargetAtTime(380 + clamped * 1400, now, 0.3);
    },
    spray: () => noise(0.26, 0.35, 2600, 5200),
    impact: () => {
      voice("square", 150, 48, 0.22, 0.7);
      noise(0.16, 0.4, 900, 180);
    },
    nearMiss: () => voice("sine", 880, 300, 0.2, 0.34),
    tick: (step) => {
      const base = 380 + Math.min(Math.max(step, 0), 24) * 18;
      voice("triangle", base, base * 1.18, 0.06, 0.55);
    },
    catchCue: () => {
      voice("triangle", 523, 523, 0.08, 0.7);
      voice("triangle", 784, 784, 0.14, 0.6, 0.07);
    },
    warn: () => {
      voice("square", 290, 290, 0.09, 0.5);
      voice("square", 232, 232, 0.11, 0.45, 0.11);
    },
    fail: () => {
      voice("sawtooth", 190, 62, 0.42, 0.7);
      noise(0.4, 0.45, 700, 120);
    },
    fanfare: () => {
      voice("triangle", 392, 392, 0.1, 0.8);
      voice("triangle", 523, 523, 0.1, 0.8, 0.09);
      voice("triangle", 659, 659, 0.12, 0.8, 0.18);
      voice("triangle", 880, 880, 0.3, 0.8, 0.27);
    },
    dispose: () => {
      try {
        engine?.osc.stop();
        engine?.sub.stop();
        wind?.source.stop();
      } catch {
        // Already stopped.
      }
      engine = null;
      wind = null;
      if (context && context.state !== "closed") void context.close();
      context = null;
      master = null;
    },
  };
}
