// Shared low-level audio primitives for the film simulations. These are the
// bits that were byte-identical across a dozen self-rendered synths; each film
// still owns its own cue palette, gain structure, and drones. Every tone is an
// oscillator — house rule, no samples.

/**
 * Create an AudioContext, falling back to the webkit-prefixed constructor for
 * older Safari. Returns null when audio is unavailable (SSR, no constructor, or
 * a construction that throws) so callers can play silent. This is the exact
 * idiom that was copied into ~a dozen simulation synths.
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain relative to the destination node; kept subtle. */
  gain?: number;
  /** Optional glide target across the note. */
  slideTo?: number;
  /** Seconds from now, for tiny figures/arpeggios. */
  delay?: number;
}>;

/** Per-film envelope shape, so each simulation keeps its exact attack and tail. */
export type ToneEnvelope = Readonly<{
  /** Default oscillator type when a cue omits one. */
  defaultType?: OscillatorType;
  /** Linear attack ramp length, seconds. */
  attack?: number;
  /** Extra seconds the oscillator runs past the decay before stopping. */
  stopTail?: number;
  /** Frequency floor. */
  minFreq?: number;
  /** Default peak gain when a cue omits one. */
  defaultGain?: number;
}>;

/**
 * Emit one enveloped oscillator tone into `destination` (usually a per-game
 * master GainNode, or the context destination for per-tone-gain synths). Attack
 * is a linear ramp to peak, decay is exponential to silence — the shape every
 * self-rendered film cue uses. Timings come from `env` so each film reproduces
 * its own exact envelope; the caller still owns the mute/context-state guard.
 */
export function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  spec: ToneSpec,
  env: ToneEnvelope = {}
) {
  const at = ctx.currentTime + (spec.delay ?? 0);
  const duration = spec.duration ?? 0.2;
  const peak = spec.gain ?? env.defaultGain ?? 0.8;
  const attack = env.attack ?? 0.01;
  const stopTail = env.stopTail ?? 0.03;
  const minFreq = env.minFreq ?? 1;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type ?? env.defaultType ?? "triangle";
  osc.frequency.setValueAtTime(Math.max(minFreq, spec.freq), at);
  if (spec.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(minFreq, spec.slideTo), at + duration);
  }
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(destination);
  osc.start(at);
  osc.stop(at + duration + stopTail);
}
