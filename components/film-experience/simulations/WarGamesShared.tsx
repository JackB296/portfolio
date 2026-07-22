"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioContext } from "@/lib/filmAudio";
import { type LiveThemePalette } from "@/lib/theme";

// Shared plumbing for the three WarGames simulations: one lazily created
// AudioContext per game (opened on the first user gesture, closed on unmount),
// a visible-mute contract, a sustained voice for the dialup's carrier tone and
// the war-room alert, plus the vector-CRT canvas helpers and the feedback
// keyframes all three lean on. Every tone is a self-rendered oscillator —
// never film audio.

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain; kept subtle by default. */
  gain?: number;
  /** Optional frequency glide target. */
  slideTo?: number;
  /** Seconds from now, for tiny arpeggios. */
  delay?: number;
}>;

export function useWarGamesAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const toneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const toneLevelRef = useRef(0.035);

  // A live mute silences the sustained tone immediately, not just new blips.
  useEffect(() => {
    mutedRef.current = muted;
    const tone = toneRef.current;
    const ctx = contextRef.current;
    if (tone && ctx) {
      tone.gain.gain.setTargetAtTime(
        muted ? 0.0001 : toneLevelRef.current,
        ctx.currentTime,
        0.05
      );
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

  /** Open the context on a user gesture so later tones are allowed to sound. */
  const unlock = useCallback(() => {
    ensureContext();
  }, [ensureContext]);

  const play = useCallback(
    (spec: ToneSpec) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.18;
      const peak = spec.gain ?? 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "square";
      osc.frequency.setValueAtTime(spec.freq, now);
      if (spec.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(spec.slideTo, now + duration);
      }
      // A short plucked envelope so overlapping tones never smear or clip.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    },
    [ensureContext]
  );

  /** Start the sustained voice (carrier search, alert klaxon). No-op if live. */
  const startTone = useCallback(
    (freq: number, type: OscillatorType = "sine", level = 0.035) => {
      const ctx = ensureContext();
      if (!ctx || toneRef.current) return;
      toneLevelRef.current = level;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(
        mutedRef.current ? 0.0001 : level,
        ctx.currentTime,
        0.08
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      toneRef.current = { osc, gain };
    },
    [ensureContext]
  );

  const setToneFreq = useCallback((freq: number) => {
    const ctx = contextRef.current;
    const tone = toneRef.current;
    if (!ctx || !tone) return;
    tone.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.04);
  }, []);

  const stopTone = useCallback(() => {
    const ctx = contextRef.current;
    const tone = toneRef.current;
    toneRef.current = null;
    if (!ctx || !tone) return;
    const now = ctx.currentTime;
    tone.gain.gain.setTargetAtTime(0.0001, now, 0.05);
    tone.osc.stop(now + 0.3);
  }, []);

  // Close the context on unmount so no audio graph outlives the dialog.
  useEffect(() => {
    return () => {
      const tone = toneRef.current;
      toneRef.current = null;
      try {
        tone?.osc.stop();
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
    () => ({ muted, setMuted, unlock, play, startTone, setToneFreq, stopTone }),
    [muted, unlock, play, startTone, setToneFreq, stopTone]
  );
}

/** The visible mute every audible WarGames game carries. */
export function WarGamesMuteButton({
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

/**
 * Feedback keyframes shared by the WarGames games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion gets instant
 * state changes instead of movement — the games stay fully playable.
 */
export function WarGamesKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes wg-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes wg-shake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-4px, 2px); }
    45% { transform: translate(4px, -2px); }
    70% { transform: translate(-3px, -1px); }
    88% { transform: translate(2px, 1px); }
  }
  @keyframes wg-float {
    0% { opacity: 0; transform: translateY(8px); }
    15% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-26px); }
  }
  @keyframes wg-flash { 0% { opacity: 0.7; } 100% { opacity: 0; } }
  @keyframes wg-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wg-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes wg-trace { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .wg-anim-pop { display: inline-block; animation: wg-pop 220ms ease-out; }
  .wg-anim-shake { animation: wg-shake 320ms ease-in-out; }
  .wg-anim-float { animation: wg-float 1400ms ease-out forwards; }
  .wg-anim-flash { animation: wg-flash 420ms ease-out forwards; }
  .wg-anim-rise { animation: wg-rise 240ms ease-out both; }
  .wg-anim-blink { animation: wg-blink 900ms steps(2, end) infinite; }
  .wg-anim-trace { animation: wg-trace 600ms linear infinite; }
}
`}</style>
  );
}

/** "rgb(r, g, b)" → "rgba(r, g, b, a)" for canvas fades. */
export const withAlpha = (rgb: string, alpha: number) =>
  rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

/**
 * Per-frame accent-alpha helper bound to a single palette read.
 *
 * `accentAlpha()` from lib/theme reads a CSS custom property on every call, so
 * calling it inside a canvas loop forces one style recalculation per stroke —
 * a few hundred of those per frame drops the whole page to single-digit fps
 * and starves the games' own timers. Read the palette once per frame, then use
 * this.
 */
export const alphaFrom = (palette: LiveThemePalette) => (alpha: number) =>
  withAlpha(palette.accent, alpha);

/** Size a canvas to its CSS box at device resolution; returns CSS-pixel dims. */
export function fitCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

/**
 * The 1983 vector-terminal wash every WarGames stage sits on: phosphor
 * scanlines plus a slow bright sweep. Purely decorative, so callers skip it
 * under reduced motion by passing a frozen `now`.
 *
 * The palette is passed in rather than read here: `getLiveThemePalette` reads
 * CSS custom properties, and a read inside an animation frame forces a full
 * style recalculation of the page — enough of those and the tab renders at
 * single-digit fps. Callers sample it once per effect instead.
 */
export function paintCrt(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  palette: LiveThemePalette
) {
  const acc = alphaFrom(palette);
  context.fillStyle = withAlpha(palette.inkSoft, 0.9);
  context.fillRect(0, 0, width, height);

  context.fillStyle = acc(0.045);
  for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);

  const sweepY = ((now / 22) % (height + 120)) - 60;
  const gradient = context.createLinearGradient(0, sweepY - 40, 0, sweepY + 40);
  gradient.addColorStop(0, acc(0));
  gradient.addColorStop(0.5, acc(0.05));
  gradient.addColorStop(1, acc(0));
  context.fillStyle = gradient;
  context.fillRect(0, sweepY - 40, width, 80);
}
