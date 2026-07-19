// The director's-commentary registry: one entry per home section, in reel
// order. Same philosophy as the other registries (lib/films, lib/demos,
// lib/caseStudies): typed data in one place, components derive everything.
//
// Body copy explains how the section is engineered — the site narrating its
// own construction. Each entry links to the real source on GitHub.

/** Repo blob base for source links; the repo URL lives in exactly one place. */
export const SOURCE_BASE = "https://github.com/JackB296/portfolio/blob/main/";

export const COMMENTARY_STORAGE_KEY = "commentary-enabled";

export type CommentaryEntry = Readonly<{
  /** The home-page section anchor this entry pins to (`section[id]`). */
  section: string;
  reel: number;
  title: string;
  body: string;
  /** Repo-relative path of the source being discussed. */
  source: string;
}>;

export const commentary: readonly CommentaryEntry[] = [
  {
    section: "top",
    reel: 1,
    title: "The hero",
    body:
      "The shape behind the headline is an icosahedron, displaced by simplex noise in a GLSL vertex shader, with a GPU particle field behind it. The scene is code-split out of the main bundle and capped to the device pixel ratio so phones stay smooth. Under reduced motion it holds one still frame. The toggle in the corner swaps it for a live Conway's Game of Life.",
    source: "components/three/HeroScene.tsx",
  },
  {
    section: "about",
    reel: 2,
    title: "The data layer",
    body:
      "Nothing on this page is written twice. Bio, timeline, and cards all render from typed records in lib/, so a change in one file flows everywhere it should, and the compiler catches the places it doesn't. Adding a project means adding one record.",
    source: "lib/data.ts",
  },
  {
    section: "experience",
    reel: 3,
    title: "The timeline",
    body:
      "Each job's role, company, and dates come from its case-study record. A small helper joins them at build time, and a bad slug fails the build instead of shipping a stale timeline. Every entry links to the long-form write-up under /work.",
    source: "lib/caseStudies.ts",
  },
  {
    section: "projects",
    reel: 4,
    title: "The project cards",
    body:
      "The cards tilt on Framer Motion springs. The previews behind them are the real algorithms re-running in miniature: a raycaster marching rays through a grid, a Verlet cloth, a Game of Life, each drawn to a small canvas on hover. Under reduced motion they draw one honest frame and stop.",
    source: "components/home/previews.tsx",
  },
  {
    section: "skills",
    reel: 5,
    title: "The theming rails",
    body:
      "Every color on this site resolves through CSS custom properties on <html>: surfaces, accent, grain, even the filter on images. That one layer of indirection lets the film theater re-grade the whole site at runtime. Sixteen palettes, and no component knows about any of them. The section icons are inline SVG.",
    source: "app/globals.css",
  },
  {
    section: "contact",
    reel: 6,
    title: "The contact backend",
    body:
      "The form posts to a serverless route that validates the payload, rate-limits by IP, traps bots with a honeypot field, strips header injection, and escapes HTML before mailing through Resend. If no API key is configured it falls back to an email-me-directly message instead of a broken form.",
    source: "app/api/contact/route.ts",
  },
];

export const getCommentary = (section: string) =>
  commentary.find((entry) => entry.section === section);
