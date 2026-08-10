import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const wargames: FilmDefinition = {
  film: "WarGames",
  year: 1983,
  grade: {
    vibe: "Blue vector CRT and recursive simulations",
    ink: "2 4 8",
    inkSoft: "4 8 14",
    inkCard: "6 12 20",
    accent: "59 130 246",
    accentBright: "96 165 250",
    accentDim: "29 78 216",
    grain: 0.05,
    fontDisplay: "var(--font-pixel-base), var(--font-mono), monospace"
  },
  experience: defineExperience({
    label: "JXN-83 simulation",
    signature: "Joshua types its greeting while the vector globe traces launches, DEFCON steps down, and tic-tac-toe resolves to a draw",
    markers: ["1983", "22 percent", "8080", "125 dots", "tic-tac-toe", "JXN-83"],
    motion: "terminal",
    radius: "0px",
    lineOpacity: 0.34,
    audio: {
      music: music("Retro computer synth", "/audio/film-modes/wargames-music.mp3", { volume: 0.19, filterFrequency: 14_000, scrollResponse: 0.25, scrollGain: 0.12, scrollRate: 0.05 }),
      effects: [effect("event", "Whispered system prompt", "/audio/film-modes/wargames-whisper.mp3", { volume: 0.3, filterFrequency: 6_000, triggerThreshold: 0.65, triggerCooldownMs: 18_000, segmentDuration: 1.4 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/wargames"),
    simulationsMenuTitle: "Shall we play a game?",
    simulations: [
      {
        id: "wargames-tic-tac-toe",
        name: "tic-tac-toe simulation",
        load: () => import("@/components/film-experience/simulations/WarGamesTicTacToe"),
      },
      {
        id: "wargames-thermonuclear",
        name: "global thermonuclear war",
        load: () => import("@/components/film-experience/simulations/WarGamesThermonuclear"),
      },
    ],
  }),
  review: {
    rating: 4,
    body: "I will never forget the first time I watched this movie and how it made me fall in love with computers. It's from well before my time, but that didn't stop me from being in awe of everything about it. One of the most important and influential movies in early programming culture.",
  },
  credits: {
    pixabayMusic: { title: "Retro Game", creator: "Bransboynd", href: "https://pixabay.com/music/electronic-retro-game-402454/" },
  },
};

export default wargames;
