// Single source of truth for the accent color in JS/TS contexts. tailwind.config.ts,
// the WebGL/three.js scene, and the canvas demos all import from here so the accent
// lives in one place instead of being pasted as a hex literal in every file. The CSS
// mirror is `--accent` / `--accent-bright` in app/globals.css.
export const ACCENT = "#f59e0b";
export const ACCENT_BRIGHT = "#fbbf24";
export const ACCENT_DIM = "#b45309";

// The accent's RGB channels, for building rgba() strings on canvas or in inline styles.
const ACCENT_RGB = "245, 158, 11";

/** The accent as an rgba() string at the given alpha (0–1). */
export const accentAlpha = (alpha: number) => `rgba(${ACCENT_RGB}, ${alpha})`;
