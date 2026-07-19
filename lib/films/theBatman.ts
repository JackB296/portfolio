import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const theBatman: FilmDefinition = {
  film: "The Batman",
  year: 2022,
  grade: {
    vibe: "Wet concrete, evidence red, and midnight rain",
    ink: "6 4 5",
    inkSoft: "11 7 8",
    inkCard: "16 10 11",
    accent: "225 29 72",
    accentBright: "251 113 133",
    accentDim: "159 18 57",
  },
  experience: defineExperience({
    label: "Rain-soaked investigation",
    signature: "A red beacon sweeps a silhouetted skyline while the investigative light follows the pointer",
    markers: ["2022 case", "red string", "cipher", "riddler card", "question marks", "city trace"],
    motion: "stalk",
    radius: "2px",
    audio: { music: music("Siniestro detective piano", "/audio/film-modes/the-batman-music.mp3", { volume: 0.18, filterFrequency: 12_000 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/theBatman"),
  }),
  review: {
    rating: 4.5,
    body: "Paul Dano did not let me down with his incredible performance as the Riddler. Batman needs his villains to give his mission meaning, and they need him to validate their chaotic existences. It's beautiful.",
  },
  credits: {
    pixabayMusic: { title: "Siniestro", creator: "anrocomposer", href: "https://pixabay.com/music/modern-classical-siniestro-119656/" },
  },
};

export default theBatman;
