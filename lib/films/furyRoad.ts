import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const furyRoad: FilmDefinition = {
  film: "Mad Max: Fury Road",
  year: 2015,
  grade: {
    vibe: "Chrome glare, rust, and dust at speed",
    ink: "10 5 3",
    inkSoft: "16 8 4",
    inkCard: "22 11 6",
    accent: "249 115 22",
    accentBright: "251 146 60",
    accentDim: "194 65 12",
  },
  experience: defineExperience({
    label: "Centered chase",
    signature: "A juddering war rig and its biker escort run the road through dust and mechanics",
    markers: ["eight-cylinder gauge", "compass", "pole-cats", "chrome sheen", "gear train", "witness me"],
    motion: "rush",
    radius: "1px",
    audio: {
      music: music("Dystopian wasteland ambient", "/audio/film-modes/fury-road-music.mp3", { volume: 0.22, filterFrequency: 16_000, scrollResponse: 0.5, scrollGain: 0.2, scrollRate: 0.1 }),
      effects: [effect("loop", "Loud multi-rev engine", "/audio/film-modes/fury-road-engine.mp3", { volume: 0.22, filterFrequency: 10_500, scrollResponse: 0.4, scrollGain: 0.2, scrollRate: 0.1 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/furyRoad"),
  }),
  review: {
    rating: 5,
    body: "One of, if not the, best action movies of all time. Truly revolutionary; there is nothing else like it. Every little thing has you thinking, wow, I never would have thought of that. I love a movie with so many details you can tell genuine effort went into, and this is one.",
  },
  credits: {
    pixabayMusic: { title: "Dystopian Ambient", creator: "Leberch", href: "https://pixabay.com/music/ambient-dystopian-ambient-520165/" },
    pixabayEffects: [{ title: "Car Engine Roaring", creator: "DRAGON-STUDIO", href: "https://pixabay.com/sound-effects/film-special-effects-car-engine-roaring-376881/" }],
  },
};

export default furyRoad;
