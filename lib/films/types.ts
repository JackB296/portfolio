import type { FilmExperienceDefinition } from "../filmExperienceTypes";
import type { FilmId } from "./ids";

// A grade is a set of CSS custom-property overrides applied to <html>. Every
// color on the site resolves through those variables (see tailwind.config.ts
// and app/globals.css), so applying a grade retunes surfaces, accent, grain,
// and image treatment at runtime. The default (no grade) is the emerald brand.
//
// All grades keep a dark base so the existing white-text components stay
// readable in every one of them.
export type FilmGrade = {
  id: FilmId;
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
};

/** The per-record grade shape; id/film/year live on the record itself. */
type FilmGradeSpec = Omit<FilmGrade, "id" | "film" | "year">;

/** The per-record experience shape; the id is injected by the registry. */
export type FilmExperienceSpec = Omit<FilmExperienceDefinition, "id">;

export type FilmReview = {
  /** 0–5, matching Jack's Letterboxd rating. Half steps allowed. */
  rating: number;
  /** One short paragraph. Rendered as the primary text of the detail panel. */
  body: string;
};

/** One licensed recording's attribution row on the credits page. */
type MediaCredit = Readonly<{
  title: string;
  creator: string;
  href: string;
}>;

/**
 * Structured attribution for the film's Pixabay recordings. Classical and
 * public-domain credits are prose with bespoke links, so they stay as JSX on
 * app/film-credits/page.tsx rather than fighting this shape.
 */
type FilmCredits = Readonly<{
  pixabayMusic?: MediaCredit;
  pixabayEffects?: readonly MediaCredit[];
}>;

/**
 * Everything the site knows about one film, in one place: its color grade,
 * its immersive experience (audio, canvas visuals, tokens), Jack's review,
 * and media attribution. Each film's theatrical one-sheet lives at
 * /public/posters/original/<id>.webp — the path derives from the id, so the
 * poster can't drift from the record.
 */
export type FilmDefinition = Readonly<{
  film: string;
  year: number;
  grade: FilmGradeSpec;
  experience: FilmExperienceSpec;
  review: FilmReview;
  credits: FilmCredits;
}>;

/** A registry record joined with its id — what consumers iterate. */
export type Film = FilmDefinition & Readonly<{ id: FilmId }>;
