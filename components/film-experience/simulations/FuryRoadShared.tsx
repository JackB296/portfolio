"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createFuryRoadAudio, type FuryRoadAudio } from "@/components/film-experience/simulations/FuryRoadAudio";

/**
 * Chrome shared by the four Fury Road games: feedback keyframes, the visible
 * mute every audible game must carry, the meter and pip rows the fuel/hull/grip
 * readouts are built from, and the HUD chip the stat rows use.
 *
 * Every keyframe sits behind `prefers-reduced-motion: no-preference`, so the
 * reduced-motion player gets instant state changes rather than movement — and
 * every game stays fully playable in that mode via its own turn-based half.
 */

/**
 * `"rgb(r, g, b)"` → `"rgba(r, g, b, a)"`.
 *
 * Canvas work samples the live grade ONCE per frame via `getLiveThemePalette()`
 * and derives every alpha from that sample with this helper, rather than
 * calling `accentAlpha()` per draw call. `accentAlpha` is cached per grade now,
 * but a few hundred string builds a frame still costs more than one.
 */
export function withAlpha(rgb: string, alpha: number) {
  return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/**
 * The props every Fury Road half receives from its entry: the audio kit, the
 * live mute flag, and the toggle. Both the reduced-motion plan and the live
 * variant of a game take exactly this shape.
 */
export type FuryRoadHalfProps = {
  audio: FuryRoadAudio;
  muted: boolean;
  onToggleMute: () => void;
};

/** One transient on-field note (a pickup, a squeak) keyed for its replay. */
export type FloatNote = { id: number; text: string };

/** One audio kit per game instance, built once and torn down on unmount. */
export function useFuryRoadAudio() {
  const [audio] = useState<FuryRoadAudio>(createFuryRoadAudio);
  const [muted, setMuted] = useState(false);
  useEffect(() => () => audio.dispose(), [audio]);
  const onToggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    audio.unlock();
  };
  return { audio, muted, onToggleMute };
}

// The trailing-click guard now lives in the shared hook; re-exported here so
// the Fury Road games keep importing it from their own barrel.
export { useFreshPress } from "@/lib/useFreshPress";

export function FuryRoadKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes fr-pop { 0% { transform: scale(1.45); } 100% { transform: scale(1); } }
  @keyframes fr-shake { 0%, 100% { transform: translateX(0); } 18% { transform: translateX(-6px); } 38% { transform: translateX(5px); } 58% { transform: translateX(-3px); } 78% { transform: translateX(2px); } }
  @keyframes fr-float { 0% { opacity: 0; transform: translateY(12px); } 16% { opacity: 1; } 100% { opacity: 0; transform: translateY(-30px); } }
  @keyframes fr-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes fr-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
  @keyframes fr-banner { 0% { transform: scale(1.5) skewX(-10deg); opacity: 0; } 45% { transform: scale(0.97) skewX(-6deg); opacity: 1; } 100% { transform: scale(1) skewX(-6deg); opacity: 0; } }
  .fr-anim-pop { display: inline-block; animation: fr-pop 200ms ease-out; }
  .fr-anim-shake { animation: fr-shake 300ms ease-in-out; }
  .fr-anim-float { animation: fr-float 1200ms ease-out forwards; }
  .fr-anim-rise { animation: fr-rise 220ms ease-out both; }
  .fr-anim-pulse { animation: fr-pulse 620ms linear infinite; }
  .fr-anim-flash { animation: fr-flash 320ms ease-out forwards; }
  .fr-anim-banner { animation: fr-banner 1100ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
}
`}</style>
  );
}

/**
 * The shared switch every Fury Road entry wraps its two halves in: the feedback
 * keyframes, then the reduced-motion plan or the live variant. Each entry still
 * owns its own reduced-motion source and the exact props it hands each half.
 */
export function FuryRoadHalf({
  reduced,
  plan,
  live,
}: {
  reduced: boolean;
  plan: React.ReactNode;
  live: React.ReactNode;
}) {
  return (
    <>
      <FuryRoadKeyframes />
      {reduced ? plan : live}
    </>
  );
}

export function FuryRoadMuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
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
 * A labelled horizontal meter. Color never carries meaning on its own — the
 * caller always passes a `note` (a short word) so the state reads without it,
 * and the fill is mirrored by aria-valuenow on the wrapper.
 */
export function FuryRoadMeter({
  label,
  value,
  note,
  danger = false,
  reducedMotion = false,
  height = "h-4",
}: {
  label: string;
  /** 0-1. */
  value: number;
  note?: string;
  danger?: boolean;
  reducedMotion?: boolean;
  height?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={note ? `${percent} percent, ${note}` : `${percent} percent`}
      className={`relative ${height} flex-1 overflow-hidden border ${
        danger ? "border-accent" : "border-accent/25"
      } bg-ink/60`}
    >
      <div
        aria-hidden
        className={`h-full ${danger ? "bg-accent" : "bg-accent/55"} ${
          reducedMotion ? "" : "transition-[width] duration-100 ease-linear"
        } ${danger && !reducedMotion ? "fr-anim-pulse" : ""}`}
        style={{ width: `${percent}%` }}
      />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-between px-1.5 text-[9px] uppercase tracking-[0.14em] text-white/75"
      >
        <span>{label}</span>
        {note && <span className={danger ? "text-accent-bright" : "text-white/45"}>{note}</span>}
      </span>
    </div>
  );
}

/**
 * Discrete hull pips. Shape carries the state as well as fill does — spent pips
 * are hollow and struck through — so the count reads without color.
 */
export function FuryRoadPips({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${label}: ${value} of ${max}`}>
      <span aria-hidden className="text-[9px] uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={`grid h-3 w-3 place-items-center border text-[8px] leading-none ${
              index < value ? "border-accent bg-accent/70 text-ink" : "border-white/25 text-white/35"
            }`}
          >
            {index < value ? "" : "×"}
          </span>
        ))}
      </span>
    </span>
  );
}

/** One HUD stat: a dim label with a bright tabular value that never reflows. */
export function FuryRoadStat({
  label,
  value,
  width = "w-10",
  pulseKey,
}: {
  label: string;
  value: string | number;
  width?: string;
  /** Change this to replay the pop animation on the value. */
  pulseKey?: string | number;
}) {
  return (
    <span className="whitespace-nowrap">
      {label}{" "}
      <span
        key={pulseKey}
        className={`inline-block ${width} text-right tabular-nums text-accent ${
          pulseKey === undefined ? "" : "fr-anim-pop"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

/** The banner every reduced-motion half carries, so the mode is never a mystery. */
export function FuryRoadPlanBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-accent/25 bg-ink/50 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
      {children}
    </p>
  );
}
