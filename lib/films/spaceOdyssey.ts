import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const spaceOdyssey: FilmDefinition = {
  film: "2001: A Space Odyssey",
  year: 1968,
  grade: {
    vibe: "Orbital black, aperture red, and measured alignment",
    ink: "3 3 6",
    inkSoft: "7 7 11",
    inkCard: "11 11 16",
    accent: "220 38 38",
    accentBright: "248 113 113",
    accentDim: "153 27 27",
  },
  experience: defineExperience({
    label: "Orbital alignment",
    signature: "Celestial alignment, original black geometry, apertures, and stately rotation",
    markers: ["1968", "2001", "9000 serial", "JB-35", "mission grid", "rendezvous"],
    motion: "precision",
    radius: "0px",
    lineOpacity: 0.3,
    audio: {
      music: music("Also sprach Zarathustra", "/audio/film-modes/space-odyssey-music.mp3", { volume: 0.22 }),
      // A synthesized whisper (macOS "Whisper" voice, not the film recording
      // or Douglas Rain's voice) speaks HAL's line on a firm scroll. Long
      // cooldown so the homage stays a rare, eerie surprise; no segmentDuration
      // so the full sentence plays from the start each time.
      effects: [effect("event", "Whispered HAL-9000 line", "/audio/film-modes/space-odyssey-hal.mp3", { volume: 0.32, filterFrequency: 7_000, triggerThreshold: 0.65, triggerCooldownMs: 20_000 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/spaceOdyssey"),
  }),
  review: {
    rating: 4.5,
    body: "The match cut is, and always will be, one of the greatest cuts in history. Beyond being aesthetically pleasing, it says that even when we conquer space, we are still fundamentally primitive apes driven by violence and survival instinct.",
  },
  // Kevin MacLeod's CC BY 3.0 recording — credited as prose on the credits page.
  credits: {},
};

export default spaceOdyssey;
