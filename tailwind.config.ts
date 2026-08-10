import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // All colors resolve through CSS custom properties on <html> so the
      // film-grade switcher can retheme the whole site at runtime.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          card: "rgb(var(--ink-card-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          bright: "rgb(var(--accent-bright-rgb) / <alpha-value>)",
          dim: "rgb(var(--accent-dim-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        pixel: ["var(--font-pixel)", "var(--font-mono)", "ui-monospace", "monospace"],
        // The hero name's own slot: JetBrains Mono under the house grade,
        // re-voiced with the rest of the site under a film grade.
        name: ["var(--font-name)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
