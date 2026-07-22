"use client";

/**
 * Chrome shared by the two Goodfellas games: the feedback keyframes, the
 * visible mute both audible games must carry, and the labelled meter row the
 * take-integrity bar and the helicopter task bars are both built from.
 *
 * Every keyframe sits behind `prefers-reduced-motion: no-preference`, so the
 * reduced-motion player gets instant state changes rather than movement — and
 * both games stay fully playable in that mode.
 */

/**
 * `"rgb(r, g, b)"` → `"rgba(r, g, b, a)"`.
 *
 * Canvas work here samples the live grade ONCE per frame via
 * `getLiveThemePalette()` and derives every alpha from the result with this,
 * rather than calling `accentAlpha()` per draw call: `accentAlpha` reads a CSS
 * custom property through `getComputedStyle`, and a few hundred of those in one
 * frame forces a style recalc per call. The corridor draws several hundred
 * strokes a frame, which measured at 1fps before this change.
 */
export function withAlpha(rgb: string, alpha: number) {
  return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

export function GoodfellasKeyframes() {
  return (
    <style>{`
@media (prefers-reduced-motion: no-preference) {
  @keyframes gf-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes gf-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes gf-float { 0% { opacity: 0; transform: translateY(10px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateY(-28px); } }
  @keyframes gf-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes gf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
  @keyframes gf-flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
  @keyframes gf-slate { 0% { transform: rotate(-9deg) scale(1.6); opacity: 0; } 55% { transform: rotate(-4deg) scale(0.95); opacity: 1; } 100% { transform: rotate(-4deg) scale(1); opacity: 1; } }
  .gf-anim-pop { display: inline-block; animation: gf-pop 220ms ease-out; }
  .gf-anim-shake { animation: gf-shake 300ms ease-in-out; }
  .gf-anim-float { animation: gf-float 1300ms ease-out forwards; }
  .gf-anim-rise { animation: gf-rise 220ms ease-out both; }
  .gf-anim-pulse { animation: gf-pulse 620ms linear infinite; }
  .gf-anim-flash { animation: gf-flash 340ms ease-out forwards; }
  .gf-anim-slate { animation: gf-slate 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
}
`}</style>
  );
}

export function GoodfellasMuteButton({
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
 * A labelled horizontal meter. `tone` never carries meaning on its own — the
 * caller always passes a `note` (a short word) so the state reads without
 * color, and the fill is mirrored by an aria-valuenow on the wrapper.
 */
export function GoodfellasMeter({
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
        } ${danger && !reducedMotion ? "gf-anim-pulse" : ""}`}
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
