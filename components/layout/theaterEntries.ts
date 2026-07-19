// The theater's catalog model: one entry per film plus the House entry, built
// once from the film registry. FilmScene and TheaterDialog read display
// fields, the grade, and the review straight off the entry, so no leaf ever
// reaches back into the registry for data this projection dropped.
import { films, HOUSE_FILM, HOUSE_ID } from "@/lib/films";
import type { FilmReview } from "@/lib/films";
import { getGrade, type FilmGrade } from "@/lib/grades";
import { HOUSE_ACCENT_TRIPLET, HOUSE_INK_TRIPLET } from "@/lib/theme";

export type TheaterEntry = Readonly<{
  /** The film's registry id, or "house" for the default brand. */
  id: string;
  /** Display title — the film's name, or "House Grade". */
  film: string;
  year: number;
  /** One-line flavor text shown on the poster and in the detail panel. */
  vibe: string;
  /** RGB triplets ("5 6 10") for the poster art and dialog backdrop. */
  ink: string;
  accent: string;
  /** The grade applied on preview/commit; null resets to the house brand. */
  grade: FilmGrade | null;
  /** Jack's review of the film — the House entry has none. */
  review?: FilmReview;
}>;

/** Every theater cover in wall order: House first, then the film registry. */
export const THEATER_ENTRIES: readonly TheaterEntry[] = [
  {
    id: HOUSE_ID,
    film: HOUSE_FILM,
    year: 2026,
    vibe: "The portfolio's original emerald signal",
    ink: HOUSE_INK_TRIPLET,
    accent: HOUSE_ACCENT_TRIPLET,
    grade: null,
  },
  ...films.map(({ id, film, year, grade, review }) => ({
    id,
    film,
    year,
    vibe: grade.vibe,
    ink: grade.ink,
    accent: grade.accent,
    // The registry's composed grade, so getGrade(id) and this entry share
    // one object identity. Every film id has a grade by construction.
    grade: getGrade(id)!,
    review,
  })),
];
