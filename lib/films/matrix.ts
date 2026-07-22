import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const matrix: FilmDefinition = {
  film: "The Matrix",
  year: 1999,
  grade: {
    vibe: "Phosphor green rain on black terminals",
    ink: "1 5 2",
    inkSoft: "3 10 5",
    inkCard: "5 15 8",
    accent: "34 197 94",
    accentBright: "74 222 128",
    accentDim: "21 128 61",
    grain: 0.05,
    display: "mono",
  },
  experience: defineExperience({
    label: "System under the system",
    signature: "Original glyph rain bends around the pointer and exposes the layout grid",
    markers: ["glyph rain", "red pill blue pill", "no spoon", "wake up call", "1999 build", "source layer"],
    motion: "terminal",
    radius: "0px",
    lineOpacity: 0.28,
    audio: {
      music: music("matrix redux", "/audio/film-modes/matrix-music.mp3", { volume: 0.2, filterFrequency: 15_000, scrollResponse: 0.3, scrollGain: 0.12, scrollRate: 0.05 }),
      effects: [effect("event", "Glyph data cascade", "/audio/film-modes/matrix-cascade.mp3", { volume: 0.18, filterFrequency: 10_000, triggerThreshold: 0.3, triggerCooldownMs: 2_200, segmentDuration: 1.5 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/matrix"),
    simulationsMenuTitle: "Free your mind",
    simulations: [
      {
        id: "matrix-decode",
        name: "decode the rain",
        load: () => import("@/components/film-experience/simulations/MatrixDecodeRain"),
      },
      {
        id: "matrix-bullet-time",
        name: "bullet-time",
        load: () => import("@/components/film-experience/simulations/MatrixBulletTime"),
      },
      {
        id: "matrix-red-or-blue",
        name: "red pill or blue",
        load: () => import("@/components/film-experience/simulations/MatrixRedOrBlue"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "One of my favorite movies of all time. This is the blend of computers and philosophy the world needed, and it will stay relevant for years to come. Not to mention it's built on the allegory of the cave, one of my favorite philosophical concepts.",
  },
  credits: {
    pixabayMusic: { title: "matrix redux", creator: "freesound_community", href: "https://pixabay.com/sound-effects/musical-matrix-redux-78819/" },
    pixabayEffects: [{ title: "Text Digital Interface", creator: "EstudioCoati", href: "https://pixabay.com/sound-effects/film-special-effects-interface-digital-de-texto-text-digital-interface-218128/" }],
  },
};

export default matrix;
