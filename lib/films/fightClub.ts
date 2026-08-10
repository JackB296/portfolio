import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const fightClub: FilmDefinition = {
  film: "Fight Club",
  year: 1999,
  grade: {
    vibe: "Damaged film, basement green, and synthetic pink",
    ink: "6 8 6",
    inkSoft: "9 12 9",
    inkCard: "12 16 12",
    accent: "244 114 182",
    accentBright: "249 168 212",
    accentDim: "190 24 93",
    grain: 0.06,
    fontDisplay: "'Courier New', Courier, monospace",
  },
  experience: defineExperience({
    label: "Fractured catalog",
    signature: "A flickering basement fluorescent, a ringing payphone, and the credit towers going dark floor by floor",
    markers: ["1999", "payphone", "catalog SKU", "chemical burn", "credit towers", "basement tube"],
    motion: "rupture",
    radius: "3px",
    audio: {
      music: music("Industrial breakbeat", "/audio/film-modes/fight-club-music.mp3", { volume: 0.21, filterFrequency: 15_000, scrollResponse: 0.45, scrollGain: 0.2, scrollRate: 0.12 }),
      // The impact hit was retired 2026-07-21 at the owner's request: Fight Club
      // runs on its breakbeat bed alone, with no foreground effect.
      effects: [],
    },
    loadVisuals: () => import("@/components/film-experience/modes/fightClub"),
    simulations: [
      {
        id: "fight-club-tourist",
        name: "the tourist",
        load: () => import("@/components/film-experience/simulations/FightClubTourist"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "The absolute film bro classic. Undefeated as the best of all time. Everything about it is amazing, and that's without even analyzing it. The deeper you get into this movie, the more you realize its genius. It should be a must-watch for everyone; even its surface-level message, that the things you own end up owning you, is something we should all be thinking about.",
  },
  credits: {
    pixabayMusic: { title: "Take Shape", creator: "Rockot", href: "https://pixabay.com/music/upbeat-take-shape-breakbeat-action-cinematic-techno-315475/" },
    pixabayEffects: [{ title: "Punch", creator: "Universfield", href: "https://pixabay.com/sound-effects/punch-140236/" }],
  },
};

export default fightClub;
