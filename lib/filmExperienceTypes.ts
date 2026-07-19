import type { ComponentType } from "react";
import type { FilmId } from "./films/ids";

export type FilmMotion =
  | "dissolve"
  | "drift"
  | "precision"
  | "pulse"
  | "stalk"
  | "descend"
  | "loop"
  | "rush"
  | "breathe"
  | "pantomime"
  | "snap"
  | "rupture"
  | "track"
  | "theatrical"
  | "terminal";

export type FilmFrame = Readonly<{
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  time: number;
  pointerX: number;
  pointerY: number;
  scroll: number;
  scrollVelocity: number;
  staticFrame: boolean;
  accent: string;
  accentBright: string;
  accentDim: string;
  /** Band levels from the active music analyser; silence with sound off. */
  musicLevels: (bandCount: number) => number[];
}>;

/**
 * One activation of a film's canvas world. CinematicLayer creates an instance
 * when the mode goes live and disposes it on teardown, so any per-activation
 * state (cached bitmaps, freeze-frame machines) lives in the instance closure
 * instead of leaking to module scope.
 */
export type FilmVisualInstance = Readonly<{
  draw: (frame: FilmFrame) => void;
  dispose?: () => void;
}>;

export type FilmVisualModule = Readonly<{
  create: () => FilmVisualInstance;
}>;

export type AudioCueMode = "loop" | "event" | "music";

export type AudioCueDefinition = Readonly<{
  label: string;
  src: string;
  mode: AudioCueMode;
  volume: number;
  filterFrequency: number;
  /** Normalized influence of page velocity on a recorded loop. Defaults to 0. */
  scrollResponse?: number;
  /** Maximum proportional gain lift at full scroll velocity. Defaults to 0. */
  scrollGain?: number;
  /** Maximum proportional playback-rate lift at full scroll velocity. Defaults to 0. */
  scrollRate?: number;
  /** Event-only velocity threshold, normalized from zero to one. */
  triggerThreshold?: number;
  /** Event-only minimum delay between triggers. */
  triggerCooldownMs?: number;
  /** Event-only source duration; successive triggers use different offsets. */
  segmentDuration?: number;
  /** Music/loop-only playback start offset in seconds. Playback begins here
   * and loops back to this point, so the opening [0, startAt) never plays. */
  startAt?: number;
}>;

type FilmAudioDefinition = Readonly<{
  music: AudioCueDefinition;
  effects: readonly AudioCueDefinition[];
}>;

type FilmAssetMotion = "breathe";

export type FilmVisualAssetDefinition = Readonly<{
  id: string;
  src: string;
  left: string;
  top: string;
  width: string;
  height?: string;
  objectFit: "contain" | "cover";
  objectPosition?: string;
  opacity: number;
  blendMode: "normal" | "screen" | "soft-light" | "multiply" | "luminosity";
  motion: FilmAssetMotion;
}>;

/** A film-specific interactive layer (e.g. WarGames' tic-tac-toe dialog),
 * loaded on demand and rendered by the experience controls. */
export type FilmSimulationComponent = ComponentType<{ onClose: () => void }>;

type FilmSimulationDefinition = Readonly<{
  /** Accessible name for the launch control in the experience pill. */
  label: string;
  load: () => Promise<{ default: FilmSimulationComponent }>;
}>;

export type FilmExperienceDefinition = Readonly<{
  id: FilmId;
  label: string;
  signature: string;
  /** The layered references the canvas world draws; surfaced on the canvas as
   * data-visual-references so tests can pin each film's iconography. */
  markers: readonly string[];
  tokens: Readonly<{
    motion: FilmMotion;
    radius: string;
    lineOpacity: number;
  }>;
  audio: FilmAudioDefinition;
  /** DOM image layers over the canvas world. Omitted means none. */
  visualAssets?: readonly FilmVisualAssetDefinition[];
  loadVisuals: () => Promise<{ default: FilmVisualModule }>;
  simulation?: FilmSimulationDefinition;
}>;
