import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const amadeus: FilmDefinition = {
  film: "Amadeus",
  year: 1984,
  grade: {
    vibe: "Parchment, candlelight gold, and burgundy velvet",
    ink: "12 7 10",
    inkSoft: "17 10 14",
    inkCard: "23 14 19",
    accent: "253 224 71",
    accentBright: "254 240 138",
    accentDim: "161 98 7",
    fontDisplay: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif"
  },
  experience: defineExperience({
    label: "Candlelit manuscript",
    signature: "Candlelight follows the cursor across manuscript staves, shedding tiny embers",
    markers: ["1787", "1984", "movement count", "player keys", "requiem", "candle count"],
    motion: "theatrical",
    radius: "2px",
    audio: { music: music("Mozart: Lacrimosa (Requiem)", "/audio/film-modes/amadeus-music.mp3", { volume: 0.22 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/amadeus"),
    simulationsMenuTitle: "From your obedient servant",
    simulations: [
      {
        id: "amadeus-manuscript",
        name: "the flawless page",
        load: () => import("@/components/film-experience/simulations/AmadeusManuscript"),
      },
      {
        id: "amadeus-conduct",
        name: "conduct",
        load: () => import("@/components/film-experience/simulations/AmadeusConduct"),
      },
      {
        id: "amadeus-notes",
        name: "too many notes",
        load: () => import("@/components/film-experience/simulations/AmadeusNotes"),
      },
    ],
  }),
  review: {
    rating: 4.5,
    body: "Absolutely genius movie. Salieri dedicates his life to his art, and we watch his ego crash and burn when Mozart effortlessly does it better. Mozart, meanwhile, is an eternal child, impulsive and obsessive. The acting and music will send chills down your spine.",
  },
  // Public-domain composition, supplied recording — credited as prose on the credits page.
  credits: {},
};

export default amadeus;
