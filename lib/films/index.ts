// The film registry: one record per film, everything else derived. The
// Record<FilmId, FilmDefinition> shape makes the compiler enforce that every
// id in FILM_IDS has exactly one record and no record has a typo'd id.
import { FILM_IDS, asFilmId, type FilmId } from "./ids";
import type { Film, FilmDefinition } from "./types";
import type {
  AudioCueDefinition,
  FilmExperienceDefinition,
  FilmVisualAssetDefinition,
} from "../filmExperienceTypes";

import amadeus from "./amadeus";
import arrival from "./arrival";
import bladeRunner from "./bladeRunner";
import casablanca from "./casablanca";
import dune from "./dune";
import fightClub from "./fightClub";
import furyRoad from "./furyRoad";
import goodfellas from "./goodfellas";
import her from "./her";
import matrix from "./matrix";
import parasite from "./parasite";
import royalTenenbaums from "./royalTenenbaums";
import spaceOdyssey from "./spaceOdyssey";
import theBatman from "./theBatman";
import wallE from "./wallE";
import wargames from "./wargames";

const records: Readonly<Record<FilmId, FilmDefinition>> = {
  casablanca,
  matrix,
  "blade-runner": bladeRunner,
  "space-odyssey": spaceOdyssey,
  dune,
  "the-batman": theBatman,
  parasite,
  arrival,
  "fury-road": furyRoad,
  her,
  "wall-e": wallE,
  "royal-tenenbaums": royalTenenbaums,
  "fight-club": fightClub,
  goodfellas,
  amadeus,
  wargames,
};

/** Every film, in theater-wall order. */
export const films: readonly Film[] = FILM_IDS.map((id) => ({
  id,
  ...records[id],
}));

const filmById = new Map(films.map((film) => [film.id, film]));

/** Look up a film from an untyped id (DOM dataset, event detail). */
export function getFilm(id: string | null | undefined): Film | undefined {
  const filmId = asFilmId(id ?? null);
  return filmId ? filmById.get(filmId) : undefined;
}

/** A cue as consumers read it: the optional scroll and event-trigger knobs
 * resolved to their defaults. segmentDuration stays optional — its default is
 * the decoded buffer's duration, which only the audio engine knows. */
export type ResolvedAudioCue = AudioCueDefinition &
  Required<
    Pick<
      AudioCueDefinition,
      | "scrollResponse"
      | "scrollGain"
      | "scrollRate"
      | "triggerThreshold"
      | "triggerCooldownMs"
    >
  >;

/** An experience as consumers read it: the registry record's optional fields
 * resolved to their defaults, so every reader sees concrete values. */
export type FilmExperienceView = FilmExperienceDefinition &
  Readonly<{
    visualAssets: readonly FilmVisualAssetDefinition[];
    audio: Readonly<{
      music: ResolvedAudioCue;
      effects: readonly ResolvedAudioCue[];
    }>;
  }>;

const resolveCue = (cue: AudioCueDefinition): ResolvedAudioCue => ({
  ...cue,
  scrollResponse: cue.scrollResponse ?? 0,
  scrollGain: cue.scrollGain ?? 0,
  scrollRate: cue.scrollRate ?? 0,
  // Event-cue trigger defaults; loop and music cues never read them.
  triggerThreshold: cue.triggerThreshold ?? 0.3,
  triggerCooldownMs: cue.triggerCooldownMs ?? 1_200,
});

/** The experience view: each film's immersive definition with its id. */
export const filmExperiences: readonly FilmExperienceView[] = films.map(
  ({ id, experience }) => ({
    id,
    ...experience,
    visualAssets: experience.visualAssets ?? [],
    audio: {
      music: resolveCue(experience.audio.music),
      effects: experience.audio.effects.map(resolveCue),
    },
  })
);

const experienceById = new Map(
  filmExperiences.map((experience) => [experience.id, experience])
);

/** Look up a film's composed experience from an untyped id. Each id resolves
 * to one stable object, so referential identity survives re-renders. */
export function getFilmExperience(
  id: string | null | undefined
): FilmExperienceView | undefined {
  const filmId = asFilmId(id ?? null);
  return filmId ? experienceById.get(filmId) : undefined;
}

// The barrel is the single import path outside lib/films; internal modules
// (and lib/filmExperienceTypes, which this file imports) reach ids.ts direct.
export { asFilmId, HOUSE_FILM, HOUSE_ID } from "./ids";
// lib/grades re-exports FilmGrade for grade consumers.
export type { FilmReview } from "./types";
