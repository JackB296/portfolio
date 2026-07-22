import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const parasite: FilmDefinition = {
  film: "Parasite",
  year: 2019,
  grade: {
    vibe: "Cold glass, concrete steps, and divided light",
    ink: "4 8 8",
    inkSoft: "7 13 13",
    inkCard: "10 18 18",
    accent: "20 184 166",
    accentBright: "45 212 191",
    accentDim: "15 118 110",
  },
  experience: defineExperience({
    label: "Above and below",
    signature: "Scattered city lights at night, one blinking Morse, and the scholar's stone sitting heavy below",
    markers: ["B2-B1-G-1", "Morse lamp", "scholar's stone", "weight token", "city lights", "hidden panel"],
    motion: "descend",
    radius: "0px",
    audio: { music: music("Minimal piano and strings", "/audio/film-modes/parasite-music.mp3", { volume: 0.18, filterFrequency: 13_000, scrollResponse: 0.22, scrollGain: 0.12, scrollRate: 0.04 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/parasite"),
    simulationsMenuTitle: "You know what plan never fails?",
    simulations: [
      {
        id: "parasite-con",
        name: "the con",
        load: () => import("@/components/film-experience/simulations/ParasiteTheCon"),
      },
      {
        id: "parasite-stairs",
        name: "up and down",
        load: () => import("@/components/film-experience/simulations/ParasiteUpAndDown"),
      },
      {
        id: "parasite-wifi",
        name: "the wi-fi hunt",
        load: () => import("@/components/film-experience/simulations/ParasiteWifiHunt"),
      },
      {
        id: "parasite-morse",
        name: "morse in the dark",
        load: () => import("@/components/film-experience/simulations/ParasiteMorse"),
      },
    ],
  }),
  review: {
    rating: 4.5,
    body: "Bong Joon Ho is one of my favorite directors, and this is his magnum opus: social commentary sharper than anything he'd done before. I'm glad he realized his dream of getting his message to viewers around the world.",
  },
  credits: {
    pixabayMusic: { title: "Minimal Piano Strings", creator: "TheoJT", href: "https://pixabay.com/music/solo-piano-minimal-piano-strings-195554/" },
  },
};

export default parasite;
