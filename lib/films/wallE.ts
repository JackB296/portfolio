import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const wallE: FilmDefinition = {
  film: "WALL-E",
  year: 2008,
  grade: {
    vibe: "Rust-brown dust, cube fields, and scanner cyan",
    ink: "9 9 6",
    inkSoft: "13 13 9",
    inkCard: "18 17 12",
    accent: "34 211 238",
    accentBright: "103 232 249",
    accentDim: "14 116 144",
  },
  experience: defineExperience({
    label: "Dust and regrowth",
    signature: "EVE scanning the wasteland, a cockroach on patrol, the Axiom passing, and the boot with the sprout",
    markers: ["700 counter", "JB113", "charge bars", "EVE probe", "Axiom liner", "boot sprout"],
    motion: "pantomime",
    radius: "6px",
    audio: { music: music("Drifting space atmosphere", "/audio/film-modes/wall-e-music.mp3", { volume: 0.19, filterFrequency: 15_000, scrollResponse: 0.15, scrollGain: 0.08, scrollRate: 0.03 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/wallE"),
    simulationsMenuTitle: "Define playing",
    simulations: [
      {
        id: "wall-e-spork",
        name: "sort the spork",
        load: () => import("@/components/film-experience/simulations/WallESortSpork"),
      },
      {
        id: "wall-e-dance",
        name: "space dance",
        load: () => import("@/components/film-experience/simulations/WallESpaceDance"),
      },
      {
        id: "wall-e-sprout",
        name: "protect the sprout",
        load: () => import("@/components/film-experience/simulations/WallEProtectSprout"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "This timeless sci-fi movie shows an exaggerated future in a way live action couldn't, and the mute robot romance carries its warning to kids and adults alike. Truly one of the most eye-opening movies, and one that will be talked about for years to come.",
  },
  credits: {
    pixabayMusic: { title: "Space Sleep Drift Atmosphere", creator: "Low_Atmos", href: "https://pixabay.com/music/ambient-space-sleep-drift-atmosphere-514685/" },
  },
};

export default wallE;
