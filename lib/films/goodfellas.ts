import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const goodfellas: FilmDefinition = {
  film: "Goodfellas",
  year: 1990,
  grade: {
    vibe: "Nightclub red through a velvet service corridor",
    ink: "11 7 6",
    inkSoft: "16 10 9",
    inkCard: "22 14 12",
    accent: "220 38 38",
    accentBright: "252 165 165",
    accentDim: "127 29 29",
    display: "serif",
  },
  experience: defineExperience({
    label: "Copacabana to final day",
    signature: "The Copacabana neon flickers on, a pink Cadillac cruises past, and the film freezes on every chapter",
    markers: ["Copacabana track", "freeze frames", "final-day dates", "neon sign", "pink Cadillac", "1955-1970-1990"],
    motion: "track",
    radius: "4px",
    audio: {
      music: music("Fast bebop swagger", "/audio/film-modes/goodfellas-music.mp3", { volume: 0.2, filterFrequency: 15_000, scrollResponse: 0.7, scrollGain: 0.24, scrollRate: 0.16 }),
      effects: [effect("event", "Passing car and road", "/audio/film-modes/goodfellas-road.mp3", { volume: 0.21, filterFrequency: 10_000, triggerThreshold: 0.32, triggerCooldownMs: 5_000, segmentDuration: 6.7 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/goodfellas"),
  }),
  review: {
    rating: 4.5,
    body: "Just the best-paced gangster movie out there. From top to bottom you feel every emotion with Henry as it happens to him. Scorsese doesn't disappoint; I could watch this any time, any day.",
  },
  credits: {
    pixabayMusic: { title: "Bebop Coffee Shop", creator: "alex-morgan", href: "https://pixabay.com/music/traditional-jazz-bebop-coffee-shop-517090/" },
    pixabayEffects: [{ title: "Car Passing Sound", creator: "Soundque", href: "https://pixabay.com/sound-effects/city-car-passing-sound-soundque-field-recording-442774/" }],
  },
};

export default goodfellas;
