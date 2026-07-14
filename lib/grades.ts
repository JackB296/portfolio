// The "screening room": film-inspired color grades for the whole site.
//
// A grade is a set of CSS custom-property overrides applied to <html>. Every
// color on the site resolves through those variables (see tailwind.config.ts
// and app/globals.css), so applying a grade retunes surfaces, accent, grain,
// and image treatment at runtime. The default (no grade) is the amber brand.
//
// All grades keep a dark base so the existing white-text components stay
// readable in every one of them.

export type FilmGrade = {
  id: string;
  film: string;
  year: number;
  /** One-line flavor text shown in the switcher. */
  vibe: string;
  /** RGB triplets, space-separated ("245 158 11"). */
  ink: string;
  inkSoft: string;
  inkCard: string;
  accent: string;
  accentBright: string;
  accentDim: string;
  /** Overrides for --grain-opacity (default 0.035). */
  grain?: number;
  /** CSS filter applied to every <img> while the grade is active. */
  imageFilter?: string;
  /** Heading font treatment. Default keeps Space Grotesk. */
  display?: "serif" | "mono";
  /**
   * Optional real poster image (e.g. "/posters/matrix.jpg"). Drop a file
   * into public/posters/ and set this; the theme modal then shows it instead
   * of the built-in drawn poster art. Sourcing real posters (and the
   * copyright call that goes with it) is the site owner's decision.
   */
  poster?: string;
};

export const GRADE_STORAGE_KEY = "film-grade";
export const GRADE_EVENT = "gradechange";

export const grades: FilmGrade[] = [
  {
    id: "casablanca",
    film: "Casablanca",
    year: 1942,
    vibe: "Black and white, heavy grain, here's looking at you",
    ink: "10 10 10",
    inkSoft: "15 15 15",
    inkCard: "21 21 21",
    accent: "212 212 216",
    accentBright: "244 244 245",
    accentDim: "113 113 122",
    grain: 0.09,
    imageFilter: "grayscale(1) contrast(1.05)",
    display: "serif",
  },
  {
    id: "matrix",
    film: "The Matrix",
    year: 1999,
    vibe: "Phosphor green rain on black terminals",
    ink: "1 5 2",
    inkSoft: "3 10 5",
    inkCard: "5 15 8",
    accent: "34 197 94",
    accentBright: "74 222 128",
    accentDim: "21 128 61",
    grain: 0.05,
    display: "mono",
  },
  {
    id: "blade-runner",
    film: "Blade Runner",
    year: 1982,
    vibe: "Neon dusk over an endless violet city",
    ink: "8 6 20",
    inkSoft: "12 9 28",
    inkCard: "16 12 36",
    accent: "236 72 153",
    accentBright: "249 168 212",
    accentDim: "157 23 77",
  },
  {
    id: "space-odyssey",
    film: "2001: A Space Odyssey",
    year: 1968,
    vibe: "Monolith black, HAL-9000 red",
    ink: "3 3 6",
    inkSoft: "7 7 11",
    inkCard: "11 11 16",
    accent: "220 38 38",
    accentBright: "248 113 113",
    accentDim: "153 27 27",
  },
  {
    id: "dune",
    film: "Dune",
    year: 2021,
    vibe: "Spice-drenched sand and desert shadow",
    ink: "12 9 5",
    inkSoft: "18 13 8",
    inkCard: "24 18 11",
    accent: "217 119 6",
    accentBright: "245 158 11",
    accentDim: "146 64 14",
    grain: 0.06,
  },
  {
    id: "the-batman",
    film: "The Batman",
    year: 2022,
    vibe: "Gotham rain, taillight crimson",
    ink: "6 4 5",
    inkSoft: "11 7 8",
    inkCard: "16 10 11",
    accent: "225 29 72",
    accentBright: "251 113 133",
    accentDim: "159 18 57",
  },
  {
    id: "parasite",
    film: "Parasite",
    year: 2019,
    vibe: "Cold teal, basements and glass houses",
    ink: "4 8 8",
    inkSoft: "7 13 13",
    inkCard: "10 18 18",
    accent: "20 184 166",
    accentBright: "45 212 191",
    accentDim: "15 118 110",
  },
  {
    id: "arrival",
    film: "Arrival",
    year: 2016,
    vibe: "Mist, slate, and slow gray light",
    ink: "7 9 12",
    inkSoft: "11 14 18",
    inkCard: "15 19 24",
    accent: "148 163 184",
    accentBright: "203 213 225",
    accentDim: "100 116 139",
    grain: 0.05,
  },
  {
    id: "fury-road",
    film: "Mad Max: Fury Road",
    year: 2015,
    vibe: "Chrome, rust, and a lovely day",
    ink: "10 5 3",
    inkSoft: "16 8 4",
    inkCard: "22 11 6",
    accent: "249 115 22",
    accentBright: "251 146 60",
    accentDim: "194 65 12",
  },
  {
    id: "her",
    film: "Her",
    year: 2013,
    vibe: "Warm dusk coral, soft and close",
    ink: "14 8 8",
    inkSoft: "20 12 11",
    inkCard: "26 15 14",
    accent: "251 113 133",
    accentBright: "253 164 175",
    accentDim: "190 18 60",
  },
  {
    id: "wall-e",
    film: "WALL-E",
    year: 2008,
    vibe: "Rust-brown Earth, EVE-display cyan",
    ink: "9 9 6",
    inkSoft: "13 13 9",
    inkCard: "18 17 12",
    accent: "34 211 238",
    accentBright: "103 232 249",
    accentDim: "14 116 144",
  },
  {
    id: "royal-tenenbaums",
    film: "The Royal Tenenbaums",
    year: 2001,
    vibe: "Mustard corduroy and family portraits",
    ink: "10 9 6",
    inkSoft: "15 13 9",
    inkCard: "20 17 12",
    accent: "234 179 8",
    accentBright: "250 204 21",
    accentDim: "161 98 7",
  },
  {
    id: "fight-club",
    film: "Fight Club",
    year: 1999,
    vibe: "Sickly green basements, pink soap",
    ink: "6 8 6",
    inkSoft: "9 12 9",
    inkCard: "12 16 12",
    accent: "244 114 182",
    accentBright: "249 168 212",
    accentDim: "190 24 93",
    grain: 0.06,
  },
  {
    id: "goodfellas",
    film: "Goodfellas",
    year: 1990,
    vibe: "Copacabana red over whiskey brown",
    ink: "11 7 6",
    inkSoft: "16 10 9",
    inkCard: "22 14 12",
    accent: "220 38 38",
    accentBright: "252 165 165",
    accentDim: "127 29 29",
    display: "serif",
  },
  {
    id: "amadeus",
    film: "Amadeus",
    year: 1984,
    vibe: "Candlelight gold on burgundy velvet",
    ink: "12 7 10",
    inkSoft: "17 10 14",
    inkCard: "23 14 19",
    accent: "253 224 71",
    accentBright: "254 240 138",
    accentDim: "161 98 7",
    display: "serif",
  },
  {
    id: "wargames",
    film: "WarGames",
    year: 1983,
    vibe: "NORAD vector blue. Shall we play a game?",
    ink: "2 4 8",
    inkSoft: "4 8 14",
    inkCard: "6 12 20",
    accent: "59 130 246",
    accentBright: "96 165 250",
    accentDim: "29 78 216",
    grain: 0.05,
    display: "mono",
  },
];

export function getGrade(id: string | null | undefined) {
  return grades.find((g) => g.id === id);
}

/** The custom-property map a grade sets on <html>. */
export function gradeVars(g: FilmGrade): Record<string, string> {
  return {
    "--ink-rgb": g.ink,
    "--ink-soft-rgb": g.inkSoft,
    "--ink-card-rgb": g.inkCard,
    "--accent-rgb": g.accent,
    "--accent-bright-rgb": g.accentBright,
    "--accent-dim-rgb": g.accentDim,
    "--grain-opacity": String(g.grain ?? 0.035),
    "--grade-image-filter": g.imageFilter ?? "none",
  };
}

const ALL_VARS = [
  "--ink-rgb",
  "--ink-soft-rgb",
  "--ink-card-rgb",
  "--accent-rgb",
  "--accent-bright-rgb",
  "--accent-dim-rgb",
  "--grain-opacity",
  "--grade-image-filter",
];

/** Apply a grade (or null to reset to the default brand) on the client. */
export function applyGrade(g: FilmGrade | null) {
  const el = document.documentElement;
  if (!g) {
    ALL_VARS.forEach((v) => el.style.removeProperty(v));
    delete el.dataset.grade;
    delete el.dataset.gradeDisplay;
  } else {
    const vars = gradeVars(g);
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.dataset.grade = g.id;
    if (g.display) el.dataset.gradeDisplay = g.display;
    else delete el.dataset.gradeDisplay;
  }
  window.dispatchEvent(new CustomEvent(GRADE_EVENT));
}

/**
 * Source for the tiny inline <script> in the root layout that re-applies the
 * persisted grade before first paint, so a reload doesn't flash amber.
 */
export function gradeBootScript(): string {
  const data = Object.fromEntries(
    grades.map((g) => [g.id, { v: gradeVars(g), d: g.display ?? "" }])
  );
  return `(function(){try{var id=localStorage.getItem(${JSON.stringify(
    GRADE_STORAGE_KEY
  )});if(!id)return;var G=${JSON.stringify(
    data
  )};var g=G[id];if(!g)return;var d=document.documentElement;for(var k in g.v){d.style.setProperty(k,g.v[k]);}d.dataset.grade=id;if(g.d)d.dataset.gradeDisplay=g.d;}catch(e){}})();`;
}
