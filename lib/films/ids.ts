// The canonical list of films, in theater-wall order. Every other film list
// (grades, experiences, reviews, credits, posters) derives from the records
// keyed by these ids, so adding film #17 means: add its id here, create its
// record file, and register it in index.ts — the compiler walks you through
// the rest.
export const FILM_IDS = [
  "casablanca",
  "matrix",
  "blade-runner",
  "space-odyssey",
  "dune",
  "the-batman",
  "parasite",
  "arrival",
  "fury-road",
  "her",
  "wall-e",
  "royal-tenenbaums",
  "fight-club",
  "goodfellas",
  "amadeus",
  "wargames",
] as const;

export type FilmId = (typeof FILM_IDS)[number];

/**
 * The non-film sentinel: the theater wall's default entry, meaning "no film
 * grade — the house emerald brand". It is deliberately NOT a FilmId
 * (asFilmId(HOUSE_ID) is null), so registry lookups fall through and
 * experience state resets wherever it appears.
 */
export const HOUSE_ID = "house";
/** Display title for the house sentinel, mirroring FilmDefinition.film. */
export const HOUSE_FILM = "House Grade";

/** Narrow an untyped id (DOM dataset, event detail, URL) to a FilmId. */
export function asFilmId(value: string | null | undefined): FilmId | null {
  return value != null && (FILM_IDS as readonly string[]).includes(value)
    ? (value as FilmId)
    : null;
}
