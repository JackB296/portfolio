// Single source of truth for theme colors in JS/TS contexts.
//
// The live values come from CSS custom properties on <html> (see app/globals.css
// and the film-grade blocks), so the whole site retunes when a grade is applied.
// The hex/RGB constants below are the default "amber" brand and act as SSR and
// non-DOM fallbacks (the OG image runs on the edge with no document).
export const ACCENT = "#34d399";
export const ACCENT_BRIGHT = "#6ee7b7";
export const ACCENT_DIM = "#059669";

// Default accent RGB channels, comma-joined for rgba() strings.
const ACCENT_RGB = "52, 211, 153";
const ACCENT_BRIGHT_RGB = "110, 231, 183";
const ACCENT_DIM_RGB = "5, 150, 105";
const INK_SOFT_RGB = "10, 12, 20";

export type LiveThemePalette = Readonly<{
  accent: string;
  bright: string;
  dim: string;
  inkSoft: string;
}>;

/** Stable SSR palette; the live grade is read after hydration. */
export const DEFAULT_THEME_PALETTE: LiveThemePalette = {
  accent: ACCENT,
  bright: ACCENT_BRIGHT,
  dim: ACCENT_DIM,
  inkSoft: "rgb(10, 12, 20)",
};

/** Read a `--*-rgb` custom property ("245 158 11") as "245, 158, 11". */
function liveRgb(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v ? v.split(/\s+/).join(", ") : fallback;
}

/** The current accent's RGB channels, e.g. "245, 158, 11". Canvas-safe. */
export const liveAccentRgb = () => liveRgb("--accent-rgb", ACCENT_RGB);

/** The current bright accent's RGB channels. Canvas-safe. */
export const liveAccentBrightRgb = () =>
  liveRgb("--accent-bright-rgb", ACCENT_BRIGHT_RGB);

/** The current dim accent's RGB channels. Canvas-safe. */
export const liveAccentDimRgb = () => liveRgb("--accent-dim-rgb", ACCENT_DIM_RGB);

/** The current soft surface channels. */
export const liveInkSoftRgb = () => liveRgb("--ink-soft-rgb", INK_SOFT_RGB);

/** The current accent as an rgba() string at the given alpha (0-1). Canvas-safe. */
export const accentAlpha = (alpha: number) =>
  `rgba(${liveAccentRgb()}, ${alpha})`;

/** The current bright accent as an rgba() string. Canvas-safe. */
export const accentBrightAlpha = (alpha: number) =>
  `rgba(${liveAccentBrightRgb()}, ${alpha})`;

/** The current accent as an opaque color string. Canvas-safe. */
export const liveAccent = () => `rgb(${liveAccentRgb()})`;

/** The current bright accent as an opaque color string. Canvas-safe. */
export const liveAccentBright = () => `rgb(${liveAccentBrightRgb()})`;

/** A live four-role palette sampled from the active grade. */
export const getLiveThemePalette = (): LiveThemePalette => ({
  accent: liveAccent(),
  bright: liveAccentBright(),
  dim: `rgb(${liveAccentDimRgb()})`,
  inkSoft: `rgb(${liveInkSoftRgb()})`,
});
