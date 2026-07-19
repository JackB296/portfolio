// The "screening room": film-inspired color grades for the whole site.
//
// The grade data lives on each film's record in lib/films/; this module is
// the grade *behavior* — deriving the CSS custom-property map, applying it to
// <html> at runtime, and generating the pre-paint boot script. See
// lib/films/types.ts for what a grade is.

import { films, getFilm } from "./films";
import type { FilmGrade } from "./films/types";

export type { FilmGrade };

export const GRADE_STORAGE_KEY = "film-grade";
export const GRADE_EVENT = "gradechange";
/**
 * The grade-change protocol. applyGrade writes the grade to <html> and then
 * dispatches GRADE_EVENT on window with a GradeChangeDetail; the intent says
 * what the change means:
 *
 * - "preview": a transient re-theme while browsing the theater wall (focus or
 *   hover on a cover). No sound, no persistence — the committed grade stands.
 * - "commit": a user selection. Persists to localStorage and arms sound (the
 *   click is a user gesture, so autoplay is allowed).
 * - "restore": the theater closed without a commit; the page returns to the
 *   committed grade.
 *
 * Dispatch sites: TheaterDialog (preview on cover focus, restore on close),
 * GradeSwitcher (commit on select). Interpreter: FilmExperienceRoot, which
 * drives visuals from the active (previewed) film and audio from the
 * committed one. tests/helpers.ts dispatchGrade emits raw events for tests.
 */
export type GradeChangeIntent = "preview" | "commit" | "restore";
export type GradeChangeDetail = Readonly<{
  gradeId: string | null;
  intent: GradeChangeIntent;
  /** A commit that must NOT auto-arm sound: the feature-presentation leader
   * commits tonight's film for the visit, but the visitor hasn't asked for
   * audio (and may not have gestured), so the toggle stays off. */
  silent?: boolean;
}>;

/** Every film's grade, in theater-wall order. */
export const grades: readonly FilmGrade[] = films.map(
  ({ id, film, year, grade }) => ({ id, film, year, ...grade })
);

export function getGrade(id: string | null | undefined) {
  return grades.find((g) => g.id === id);
}

/** The custom-property map a grade sets on <html>. */
function gradeVars(g: FilmGrade): Record<string, string> {
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

const ALL_VARS = Object.keys(gradeVars(grades[0]));

/** Apply a grade (or null to reset to the default brand) on the client. */
export function applyGrade(
  g: FilmGrade | null,
  intent: GradeChangeIntent = "commit",
  options?: Readonly<{ silent?: boolean }>
) {
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
  window.dispatchEvent(
    new CustomEvent<GradeChangeDetail>(GRADE_EVENT, {
      detail: { gradeId: g?.id ?? null, intent, silent: options?.silent },
    })
  );
}

/**
 * Commit a grade as the user's selection: apply with the commit intent and
 * persist it. The one code path for every committer (GradeSwitcher, the guest
 * terminal), so persistence can't drift from application.
 */
export function commitGrade(g: FilmGrade | null) {
  applyGrade(g, "commit");
  try {
    if (g) localStorage.setItem(GRADE_STORAGE_KEY, g.id);
    else localStorage.removeItem(GRADE_STORAGE_KEY);
  } catch {
    // Private browsing can block storage; the grade still applies this visit.
  }
}

/** The material custom properties a film's experience sets on <html>. Their
 * :root defaults live in app/globals.css (the CSS origin). */
export const FILM_TOKEN_VARS = {
  radius: "--film-radius",
  lineOpacity: "--film-line-opacity",
} as const;

/** The custom-property map a film's experience tokens set on <html> — the one
 * serialization both applyExperienceTokens and gradeBootScript write. */
function filmTokenVars(tokens: {
  radius: string;
  lineOpacity: number;
}): Record<string, string> {
  return {
    [FILM_TOKEN_VARS.radius]: tokens.radius,
    [FILM_TOKEN_VARS.lineOpacity]: String(tokens.lineOpacity),
  };
}

/**
 * Write a film's experience tokens (mode/motion data attributes plus the
 * material vars) to <html>, or clear them for null / non-film ids. The
 * companion to applyGrade: the same "write film state to <html>" concern.
 */
export function applyExperienceTokens(id: string | null) {
  const html = document.documentElement;
  const film = getFilm(id);

  if (!film) {
    delete html.dataset.filmMode;
    delete html.dataset.filmMotion;
    Object.values(FILM_TOKEN_VARS).forEach((name) => html.style.removeProperty(name));
    return;
  }

  html.dataset.filmMode = film.id;
  html.dataset.filmMotion = film.experience.tokens.motion;
  Object.entries(filmTokenVars(film.experience.tokens)).forEach(([name, value]) =>
    html.style.setProperty(name, value)
  );
}

/**
 * Source for the tiny inline <script> in the root layout that re-applies the
 * persisted grade — and the film's experience tokens — before first paint, so
 * a reload neither flashes emerald nor pops the film's material CSS in late.
 */
export function gradeBootScript(): string {
  const data = Object.fromEntries(
    films.map(({ id, film, year, grade, experience }) => [
      id,
      {
        // One var map: the grade's custom properties plus the film's material
        // tokens, serialized by the same helpers the runtime writers use.
        v: {
          ...gradeVars({ id, film, year, ...grade }),
          ...filmTokenVars(experience.tokens),
        },
        d: grade.display ?? "",
        m: experience.tokens.motion,
      },
    ])
  );
  return `(function(){try{var id=localStorage.getItem(${JSON.stringify(
    GRADE_STORAGE_KEY
  )});if(!id)return;var G=${JSON.stringify(
    data
  )};var g=G[id];if(!g)return;var d=document.documentElement;for(var k in g.v){d.style.setProperty(k,g.v[k]);}d.dataset.grade=id;if(g.d)d.dataset.gradeDisplay=g.d;d.dataset.filmMode=id;d.dataset.filmMotion=g.m;}catch(e){}})();`;
}
