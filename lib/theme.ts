// Single source of truth for theme colors in JS/TS contexts.
//
// The live values come from CSS custom properties on <html> (see app/globals.css
// and the film-grade blocks), so the whole site retunes when a grade is applied.
// The hex/RGB constants below are the default emerald brand and act as SSR and
// non-DOM fallbacks (the OG image runs on the edge with no document).
export const ACCENT = "#34d399";
export const ACCENT_BRIGHT = "#6ee7b7";
const ACCENT_DIM = "#059669";

// Default accent RGB channels, comma-joined for rgba() strings.
export const ACCENT_RGB = "52, 211, 153";
const ACCENT_BRIGHT_RGB = "110, 231, 183";
const ACCENT_DIM_RGB = "5, 150, 105";
const INK_SOFT_RGB = "10, 12, 20";

// House (no grade) triplets in the space-separated CSS custom-property form,
// for the places that describe the brand alongside film grades (the theater's
// House entry). globals.css :root is the origin; these mirror it for JS/TS.
export const HOUSE_ACCENT_TRIPLET = "52 211 153";
export const HOUSE_INK_TRIPLET = "5 6 10";

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
  inkSoft: `rgb(${INK_SOFT_RGB})`,
};

// Reading a custom property means getComputedStyle, which forces a style
// recalculation. Canvas loops call these hundreds of times a frame, so the
// channels are resolved once per grade and reused. The active grade is
// identified by the <html> data attributes the grade system already writes
// (see lib/grades.ts), and reading a dataset value costs nothing.
type Channels = Readonly<{
  accent: string;
  bright: string;
  dim: string;
  inkSoft: string;
}>;

const FALLBACK_CHANNELS: Channels = {
  accent: ACCENT_RGB,
  bright: ACCENT_BRIGHT_RGB,
  dim: ACCENT_DIM_RGB,
  inkSoft: INK_SOFT_RGB,
};

let cacheKey: string | null = null;
let cached: Channels = FALLBACK_CHANNELS;

/** "52 211 153" → "52, 211, 153". */
const commas = (value: string, fallback: string) =>
  value ? value.trim().split(/\s+/).join(", ") : fallback;

/** The active grade's channels, resolved at most once per grade change. */
function channels(): Channels {
  if (typeof window === "undefined") return FALLBACK_CHANNELS;
  const root = document.documentElement;
  // Previews and commits both rewrite data-grade; data-film-mode covers the
  // experience tokens layered on top of it.
  const key = `${root.dataset.grade ?? ""}|${root.dataset.filmMode ?? ""}`;
  if (cacheKey === key) return cached;

  const style = getComputedStyle(root);
  cached = {
    accent: commas(style.getPropertyValue("--accent-rgb"), ACCENT_RGB),
    bright: commas(style.getPropertyValue("--accent-bright-rgb"), ACCENT_BRIGHT_RGB),
    dim: commas(style.getPropertyValue("--accent-dim-rgb"), ACCENT_DIM_RGB),
    inkSoft: commas(style.getPropertyValue("--ink-soft-rgb"), INK_SOFT_RGB),
  };
  cacheKey = key;
  return cached;
}

/** The current accent as an rgba() string at the given alpha (0-1). Canvas-safe. */
export const accentAlpha = (alpha: number) =>
  `rgba(${channels().accent}, ${alpha})`;

/**
 * Any `rgb(r, g, b)` string → `rgba(r, g, b, alpha)`. For colors already
 * sampled from a palette (e.g. getLiveThemePalette), where accentAlpha's live
 * channel lookup isn't what you want.
 */
export const withAlpha = (rgb: string, alpha: number) =>
  rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

/** A live four-role palette sampled from the active grade. */
export const getLiveThemePalette = (): LiveThemePalette => {
  const live = channels();
  return {
    accent: `rgb(${live.accent})`,
    bright: `rgb(${live.bright})`,
    dim: `rgb(${live.dim})`,
    inkSoft: `rgb(${live.inkSoft})`,
  };
};
