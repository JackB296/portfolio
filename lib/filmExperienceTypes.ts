import type { FilmGrade } from "./grades";

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
}>;

export type FilmVisualModule = Readonly<{
  authored?: boolean;
  markers?: readonly string[];
  draw: (frame: FilmFrame) => void;
}>;

export type AudioCueMode = "loop" | "event" | "music";

export type AudioCueDefinition = Readonly<{
  label: string;
  src: string;
  mode: AudioCueMode;
  volume: number;
  filterFrequency: number;
  /** Normalized influence of page velocity on a recorded loop. */
  scrollResponse: number;
  /** Maximum proportional gain lift at full scroll velocity. */
  scrollGain: number;
  /** Maximum proportional playback-rate lift at full scroll velocity. */
  scrollRate: number;
  /** Event-only velocity threshold, normalized from zero to one. */
  triggerThreshold?: number;
  /** Event-only minimum delay between triggers. */
  triggerCooldownMs?: number;
  /** Event-only source duration; successive triggers use different offsets. */
  segmentDuration?: number;
}>;

export type FilmAudioDefinition = Readonly<{
  music: AudioCueDefinition;
  effects: readonly AudioCueDefinition[];
}>;

export type FilmAssetMotion =
  | "still"
  | "breathe"
  | "drift"
  | "float"
  | "pulse"
  | "track";

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

export type FilmExperienceDefinition = Readonly<{
  id: FilmGrade["id"];
  label: string;
  signature: string;
  references: readonly string[];
  tokens: Readonly<{
    motion: FilmMotion;
    material: string;
    radius: string;
    letterSpacing: string;
    lineOpacity: number;
  }>;
  audio: FilmAudioDefinition;
  visualAssets: readonly FilmVisualAssetDefinition[];
  loadVisuals: () => Promise<{ default: FilmVisualModule }>;
}>;
