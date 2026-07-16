import type {
  AudioCueDefinition,
  AudioCueMode,
  FilmExperienceDefinition,
  FilmMotion,
  FilmVisualAssetDefinition,
} from "./filmExperienceTypes";

type CueOptions = Partial<
  Omit<AudioCueDefinition, "label" | "src" | "mode">
>;

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

type ExperienceInput = Omit<FilmExperienceDefinition, "tokens"> & {
  motion: FilmMotion;
  material: string;
  radius?: string;
  letterSpacing?: string;
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
  scrollResponse: 0,
  scrollGain: 0,
  scrollRate: 0,
  ...options,
});

const music = (label: string, src: string, options?: CueOptions) =>
  cue("music", label, src, options);

const effect = (
  mode: Exclude<AudioCueMode, "music">,
  label: string,
  src: string,
  options?: CueOptions
) => cue(mode, label, src, options);

const asset = (
  id: string,
  src: string,
  options: AssetOptions
): FilmVisualAssetDefinition => ({
  id,
  src,
  objectFit: "contain",
  opacity: 0.18,
  blendMode: "soft-light",
  motion: "drift",
  ...options,
});

const defineExperience = ({
  motion,
  material,
  radius = "10px",
  letterSpacing = "0em",
  lineOpacity = 0.2,
  ...experience
}: ExperienceInput): FilmExperienceDefinition => ({
  ...experience,
  tokens: { motion, material, radius, letterSpacing, lineOpacity },
});

export const filmExperiences: readonly FilmExperienceDefinition[] = [
  defineExperience({
    id: "casablanca",
    label: "Departing airfield",
    signature: "Fog, a sweeping airfield searchlight, a split-flap board resolving to Lisbon, and a champagne toast",
    references: ["19:42 departures", "split-flap board", "searchlight tower", "champagne toast", "Lisbon route", "tarmac couple"],
    motion: "dissolve",
    material: "fogged glass and paper",
    radius: "2px",
    letterSpacing: "0.035em",
    audio: {
      music: music("Vintage departure jazz", "/audio/film-modes/casablanca-music.mp3", { volume: 0.19 }),
      effects: [effect("event", "Propeller-plane approach", "/audio/film-modes/casablanca-plane.mp3", { volume: 0.34, filterFrequency: 11_000, triggerThreshold: 0.5, triggerCooldownMs: 15_000, segmentDuration: 12 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/casablanca"),
  }),
  defineExperience({
    id: "matrix",
    label: "System under the system",
    signature: "Original glyph rain bends around the pointer and exposes the layout grid",
    references: ["red pill blue pill", "no spoon", "wake up call", "1999 build", "source layer", "hardline"],
    motion: "terminal",
    material: "phosphor and liquid",
    radius: "0px",
    letterSpacing: "-0.01em",
    lineOpacity: 0.28,
    audio: {
      music: music("matrix redux", "/audio/film-modes/matrix-music.mp3", { volume: 0.2, filterFrequency: 15_000, scrollResponse: 0.3, scrollGain: 0.12, scrollRate: 0.05 }),
      effects: [effect("event", "Glyph data cascade", "/audio/film-modes/matrix-cascade.mp3", { volume: 0.18, filterFrequency: 10_000, triggerThreshold: 0.3, triggerCooldownMs: 2_200, segmentDuration: 1.5 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/matrix"),
  }),
  defineExperience({
    id: "blade-runner",
    label: "Ochre memory rain",
    signature: "Dense neon megastructures, flashing signage, spinner traffic, drifting holograms, and cold rain",
    references: ["2017 archive", "memory index", "baseline test", "ochre horizon", "sea wall", "interlinked"],
    motion: "drift",
    material: "rain, ochre haze, and concrete",
    radius: "4px",
    audio: {
      music: music("Interrogation noir jazz", "/audio/film-modes/blade-runner-music.mp3", { volume: 0.19, filterFrequency: 14_000 }),
      effects: [effect("loop", "Rain on balcony metal", "/audio/film-modes/blade-runner-rain.mp3", { volume: 0.08, filterFrequency: 12_000, scrollResponse: 0.3, scrollGain: 0.24, scrollRate: 0.02 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/bladeRunner"),
  }),
  defineExperience({
    id: "space-odyssey",
    label: "Orbital alignment",
    signature: "Celestial alignment, original black geometry, apertures, and stately rotation",
    references: ["1968", "2001", "9000 serial", "JB-35", "mission grid", "rendezvous"],
    motion: "precision",
    material: "black, white, and aperture red",
    radius: "0px",
    letterSpacing: "0.08em",
    lineOpacity: 0.3,
    audio: { music: music("Also sprach Zarathustra", "/audio/film-modes/space-odyssey-music.mp3", { volume: 0.22 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/spaceOdyssey"),
  }),
  defineExperience({
    id: "dune",
    label: "Desert power",
    signature: "Wind-driven sand, heat shimmer, dune layers, and radial ground signals",
    references: ["twin moons", "water allocation", "ornithopter", "spice blow", "spice glints", "ground pulse"],
    motion: "pulse",
    material: "sand and heat",
    radius: "1px",
    letterSpacing: "0.05em",
    audio: {
      music: music("Cavernous desert choir", "/audio/film-modes/dune-music.mp3", { volume: 0.2, filterFrequency: 13_000, scrollResponse: 0.25, scrollGain: 0.12, scrollRate: 0.05 }),
      effects: [effect("loop", "Flowing desert sand", "/audio/film-modes/dune-sand.mp3", { volume: 0.09, filterFrequency: 9_000, scrollResponse: 0.58, scrollGain: 0.34, scrollRate: 0.1 })],
    },
    visualAssets: [asset("dune-namib", "/posters/open/dune-namib.webp", { left: "0", top: "43vh", width: "100vw", height: "57vh", objectFit: "cover", objectPosition: "center 55%", opacity: 0.22, blendMode: "soft-light", motion: "breathe" })],
    loadVisuals: () => import("@/components/film-experience/modes/dune"),
  }),
  defineExperience({
    id: "the-batman",
    label: "Rain-soaked investigation",
    signature: "A red beacon sweeps a silhouetted skyline while the investigative light follows the pointer",
    references: ["2022 case", "evidence string map", "cipher", "riddler card", "question marks", "city trace"],
    motion: "stalk",
    material: "rain and wet asphalt",
    radius: "2px",
    audio: { music: music("Siniestro detective piano", "/audio/film-modes/the-batman-music.mp3", { volume: 0.18, filterFrequency: 12_000 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/theBatman"),
  }),
  defineExperience({
    id: "parasite",
    label: "Above and below",
    signature: "Scattered city lights at night, one blinking Morse, and the scholar's stone sitting heavy below",
    references: ["B2-B1-G-1", "Morse lamp", "scholar's stone", "weight token", "city lights", "hidden panel"],
    motion: "descend",
    material: "glass versus damp concrete",
    radius: "0px",
    audio: { music: music("Minimal piano and strings", "/audio/film-modes/parasite-music.mp3", { volume: 0.18, filterFrequency: 13_000, scrollResponse: 0.22, scrollGain: 0.12, scrollRate: 0.04 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/parasite"),
  }),
  defineExperience({
    id: "arrival",
    label: "Nonlinear threshold",
    signature: "Original circular ink language loops through fog and nonlinear project time",
    references: ["12 markers", "seven-part bloom", "mirrored time", "heptapod shadow", "shell hover", "twelve clocks"],
    motion: "loop",
    material: "fog, ink, and pumice",
    radius: "999px",
    letterSpacing: "0.02em",
    audio: { music: music("Alien futuristic ambience", "/audio/film-modes/arrival-music.mp3", { volume: 0.18, filterFrequency: 14_000, scrollResponse: 0.12, scrollGain: 0.08, scrollRate: 0.02 }), effects: [] },
    visualAssets: [asset("arrival-fog", "/posters/open/arrival-fog.webp", { left: "0", top: "0", width: "100vw", height: "100vh", objectFit: "cover", objectPosition: "center", opacity: 0.17, blendMode: "luminosity", motion: "breathe" })],
    loadVisuals: () => import("@/components/film-experience/modes/arrival"),
  }),
  defineExperience({
    id: "fury-road",
    label: "Centered chase",
    signature: "A juddering war rig and its biker escort run the road through dust and mechanics",
    references: ["eight-cylinder gauge", "compass", "pole-cats", "chrome sheen", "gear train", "witness me"],
    motion: "rush",
    material: "rust, chrome, and sand",
    radius: "1px",
    audio: {
      music: music("Dystopian wasteland ambient", "/audio/film-modes/fury-road-music.mp3", { volume: 0.22, filterFrequency: 16_000, scrollResponse: 0.5, scrollGain: 0.2, scrollRate: 0.1 }),
      effects: [effect("loop", "Loud multi-rev engine", "/audio/film-modes/fury-road-engine.mp3", { volume: 0.22, filterFrequency: 10_500, scrollResponse: 0.4, scrollGain: 0.2, scrollRate: 0.1 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/furyRoad"),
  }),
  defineExperience({
    id: "her",
    label: "Attentive operating system",
    signature: "A warm attentive waveform, a small earpiece listening, and an OS assembling itself on arrival",
    references: ["2013", "OS calibration", "earpiece", "warm waveform", "OS boot", "letter cursor"],
    motion: "breathe",
    material: "coral, felt, and glass",
    radius: "20px",
    audio: { music: music("Wistful intimate piano", "/audio/film-modes/her-music.mp3", { volume: 0.19, filterFrequency: 14_000 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/her"),
  }),
  defineExperience({
    id: "wall-e",
    label: "Dust and regrowth",
    signature: "EVE scanning the wasteland, a cockroach on patrol, the Axiom passing, and the boot with the sprout",
    references: ["700 counter", "JB113", "charge bars", "EVE probe", "Axiom liner", "boot sprout"],
    motion: "pantomime",
    material: "rust, dust, and tiny lights",
    radius: "6px",
    audio: { music: music("Drifting space atmosphere", "/audio/film-modes/wall-e-music.mp3", { volume: 0.19, filterFrequency: 15_000, scrollResponse: 0.15, scrollGain: 0.08, scrollRate: 0.03 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/wallE"),
  }),
  defineExperience({
    id: "royal-tenenbaums",
    label: "Illustrated family archive",
    signature: "Symmetric chapter framing, Mordecai circling overhead, and a record spinning in the corner",
    references: ["chapter numbers", "record player", "falcon circuit", "townhouse", "family archive", "storybook bands"],
    motion: "snap",
    material: "wallpaper, corduroy, and paper",
    radius: "0px",
    letterSpacing: "0.03em",
    audio: { music: music("Satie: Gymnopédie No. 1", "/audio/film-modes/royal-tenenbaums-music.mp3", { volume: 0.2 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/royalTenenbaums"),
  }),
  defineExperience({
    id: "fight-club",
    label: "Fractured catalog",
    signature: "A flickering basement fluorescent, a ringing payphone, and the credit towers going dark floor by floor",
    references: ["1999", "payphone", "catalog SKU", "chemical burn", "credit towers", "basement tube"],
    motion: "rupture",
    material: "fluorescent grime, catalog paper, and lye",
    radius: "3px",
    audio: {
      music: music("Industrial breakbeat", "/audio/film-modes/fight-club-music.mp3", { volume: 0.21, filterFrequency: 15_000, scrollResponse: 0.45, scrollGain: 0.2, scrollRate: 0.12 }),
      effects: [effect("event", "Physical impact and burn", "/audio/film-modes/fight-club-impact.mp3", { volume: 0.24, filterFrequency: 8_500, triggerThreshold: 0.4, triggerCooldownMs: 4_200, segmentDuration: 1.5 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/fightClub"),
  }),
  defineExperience({
    id: "goodfellas",
    label: "Copacabana to final day",
    signature: "The Copacabana neon flickers on, a pink Cadillac cruises past, and the film freezes on every chapter",
    references: ["1955-1970-1990", "Copacabana track", "freeze frames", "final-day dates", "neon sign", "pink Cadillac"],
    motion: "track",
    material: "red velvet, tail lights, and newspaper",
    radius: "4px",
    audio: {
      music: music("Fast bebop swagger", "/audio/film-modes/goodfellas-music.mp3", { volume: 0.2, filterFrequency: 15_000, scrollResponse: 0.7, scrollGain: 0.24, scrollRate: 0.16 }),
      effects: [effect("event", "Passing car and road", "/audio/film-modes/goodfellas-road.mp3", { volume: 0.21, filterFrequency: 10_000, triggerThreshold: 0.32, triggerCooldownMs: 5_000, segmentDuration: 6.7 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/goodfellas"),
  }),
  defineExperience({
    id: "amadeus",
    label: "Candlelit manuscript",
    signature: "Candlelight follows the cursor across manuscript staves, shedding tiny embers",
    references: ["1787", "1984", "movement count", "player keys", "requiem", "candle count"],
    motion: "theatrical",
    material: "candlelight, velvet, and ink",
    radius: "2px",
    letterSpacing: "0.025em",
    audio: { music: music("Mozart: Lacrimosa (Requiem)", "/audio/film-modes/amadeus-music.mp3", { volume: 0.22 }), effects: [] },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/amadeus"),
  }),
  defineExperience({
    id: "wargames",
    label: "JXN-83 simulation",
    signature: "Joshua types its greeting while the vector globe traces launches, DEFCON steps down, and tic-tac-toe resolves to a draw",
    references: ["1983", "22 percent", "8080", "125 dots", "tic-tac-toe", "JXN-83"],
    motion: "terminal",
    material: "CRT, vector, and paper",
    radius: "0px",
    letterSpacing: "0.04em",
    lineOpacity: 0.34,
    audio: {
      music: music("Retro computer synth", "/audio/film-modes/wargames-music.mp3", { volume: 0.19, filterFrequency: 14_000, scrollResponse: 0.25, scrollGain: 0.12, scrollRate: 0.05 }),
      effects: [effect("event", "Whispered system prompt", "/audio/film-modes/wargames-whisper.mp3", { volume: 0.3, filterFrequency: 6_000, triggerThreshold: 0.65, triggerCooldownMs: 18_000, segmentDuration: 1.4 })],
    },
    visualAssets: [],
    loadVisuals: () => import("@/components/film-experience/modes/wargames"),
  }),
] as const;

export const filmExperienceById = new Map(
  filmExperiences.map((experience) => [experience.id, experience])
);
