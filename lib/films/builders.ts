import type {
  AudioCueDefinition,
  AudioCueMode,
  FilmMotion,
  FilmVisualAssetDefinition,
} from "../filmExperienceTypes";
import type { FilmExperienceSpec } from "./types";

type CueOptions = Partial<Omit<AudioCueDefinition, "label" | "src" | "mode">>;

type AssetOptions = Omit<
  FilmVisualAssetDefinition,
  "id" | "src" | "objectFit" | "opacity" | "blendMode" | "motion"
> &
  Partial<
    Pick<
      FilmVisualAssetDefinition,
      "objectFit" | "opacity" | "blendMode" | "motion"
    >
  >;

type ExperienceInput = Omit<FilmExperienceSpec, "tokens"> & {
  motion: FilmMotion;
  radius?: string;
  lineOpacity?: number;
};

const cue = (
  mode: AudioCueMode,
  label: string,
  src: string,
  options: CueOptions = {}
): AudioCueDefinition => ({
  label,
  src,
  mode,
  volume: 0.2,
  filterFrequency: 18_000,
  ...options,
});

export const music = (label: string, src: string, options?: CueOptions) =>
  cue("music", label, src, options);

export const effect = (
  mode: Exclude<AudioCueMode, "music">,
  label: string,
  src: string,
  options?: CueOptions
) => cue(mode, label, src, options);

export const asset = (
  id: string,
  src: string,
  options: AssetOptions
): FilmVisualAssetDefinition => ({
  id,
  src,
  objectFit: "contain",
  opacity: 0.18,
  blendMode: "soft-light",
  motion: "breathe",
  ...options,
});

/** Concentrates token defaults so each film states only its deltas. The
 * radius/lineOpacity fallbacks mirror the :root CSS defaults in
 * app/globals.css (written to <html> via FILM_TOKEN_VARS in lib/grades.ts). */
export const defineExperience = ({
  motion,
  radius = "10px",
  lineOpacity = 0.2,
  ...spec
}: ExperienceInput): FilmExperienceSpec => ({
  ...spec,
  tokens: { motion, radius, lineOpacity },
});
