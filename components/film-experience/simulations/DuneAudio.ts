"use client";

// Self-rendered sound for the Dune simulations: one AudioContext per game
// instance, oscillator voices only (house rule — no samples), created lazily
// on the first user gesture and closed on unmount. Every game that plays a
// note also shows a visible mute control; volumes stay subtle.

export type DuneSynth = Readonly<{
  /** One short enveloped tone. `glide` slides the pitch across the note. */
  tone: (frequency: number, durationMs: number, options?: ToneOptions) => void;
  /** Start (or retune) the single sustained drone voice. */
  drone: (frequency: number, gain: number) => void;
  stopDrone: () => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
}>;

type ToneOptions = Readonly<{
  type?: OscillatorType;
  gain?: number;
  /** Target frequency to slide toward across the note. */
  glide?: number;
}>;

export function createDuneSynth(initiallyMuted = false): DuneSynth {
  let context: AudioContext | null = null;
  let muted = initiallyMuted;
  let droneOsc: OscillatorNode | null = null;
  let droneGain: GainNode | null = null;

  const ensure = (): AudioContext | null => {
    try {
      if (!context) context = new AudioContext();
      if (context.state === "suspended") void context.resume();
      return context;
    } catch {
      return null; // no audio support: the games play silent
    }
  };

  const tone = (frequency: number, durationMs: number, options: ToneOptions = {}) => {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const seconds = Math.max(0.03, durationMs / 1000);
      const peak = options.gain ?? 0.05;
      osc.type = options.type ?? "triangle";
      osc.frequency.setValueAtTime(Math.max(20, frequency), now);
      if (options.glide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.glide), now + seconds);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.05);
    } catch {
      // Audio is garnish; a failed note never interrupts play.
    }
  };

  const stopDrone = () => {
    if (!context || !droneGain || !droneOsc) return;
    try {
      droneGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.06);
      droneOsc.stop(context.currentTime + 0.4);
    } catch {
      // Already stopped: nothing to unwind.
    }
    droneOsc = null;
    droneGain = null;
  };

  const drone = (frequency: number, gainValue: number) => {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (!droneOsc || !droneGain) {
        droneOsc = ctx.createOscillator();
        droneGain = ctx.createGain();
        droneOsc.type = "sine";
        droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        droneOsc.connect(droneGain).connect(ctx.destination);
        droneOsc.start();
      }
      droneOsc.frequency.setTargetAtTime(Math.max(20, frequency), ctx.currentTime, 0.08);
      droneGain.gain.setTargetAtTime(Math.max(0.0001, gainValue), ctx.currentTime, 0.12);
    } catch {
      // Drone is optional color; ignore failures.
    }
  };

  return {
    tone,
    drone,
    stopDrone,
    setMuted: (next) => {
      muted = next;
      if (next) stopDrone();
    },
    dispose: () => {
      stopDrone();
      try {
        void context?.close();
      } catch {
        // Context already closed.
      }
      context = null;
    },
  };
}
