import { defineExperience, music } from "./builders";
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
    fontDisplay: "Futura, 'Century Gothic', 'Trebuchet MS', sans-serif",
  },
  experience: defineExperience({
    label: "Orbital alignment",
    signature: "Celestial alignment, original black geometry, apertures, and stately rotation",
    markers: ["1968", "2001", "9000 serial", "JB-35", "mission grid", "rendezvous"],
    motion: "precision",
    radius: "0px",
    lineOpacity: 0.3,
    audio: {
      // 2001 is deliberately scroll-inert: the bed holds its own tempo and
      // level no matter how the page moves, so the zeros are stated rather
      // than inherited. startAt trims the recording's slow opening so the
      // fanfare lands immediately, on the first pass and on every loop.
      music: music("Also sprach Zarathustra", "/audio/film-modes/space-odyssey-music.mp3", { volume: 0.22, scrollResponse: 0, scrollGain: 0, scrollRate: 0, startAt: 3 }),
      // The whispered HAL line was removed 2026-07-21. Event cues only ever
      // re-fire from scroll velocity (AudioDirector.respondToScroll), so with
      // scroll behaviour off for this film the cue could only have spoken once
      // at start-up — a dead cue, not a rare surprise. Removed rather than left.
      effects: [],
    },
    loadVisuals: () => import("@/components/film-experience/modes/spaceOdyssey"),
    simulationsMenuTitle: "Good afternoon, gentlemen",
    simulations: [
      {
        id: "space-odyssey-podbay",
        name: "open the pod bay doors",
        load: () => import("@/components/film-experience/simulations/SpaceOdysseyPodBay"),
      },
      {
        id: "space-odyssey-bone",
        name: "the bone toss",
        load: () => import("@/components/film-experience/simulations/SpaceOdysseyBoneToss"),
      },
      {
        id: "space-odyssey-disconnect",
        name: "disconnect HAL",
        load: () => import("@/components/film-experience/simulations/SpaceOdysseyDisconnect"),
      },
      {
        id: "space-odyssey-docking",
        name: "docking waltz",
        load: () => import("@/components/film-experience/simulations/SpaceOdysseyDocking"),
      },
    ],
  }),
  review: {
    rating: 4.5,
    body: "The match cut is, and always will be, one of the greatest cuts in history. Beyond being aesthetically pleasing, it says that even when we conquer space, we are still fundamentally primitive apes driven by violence and survival instinct.",
  },
  // Kevin MacLeod's CC BY 3.0 recording — credited as prose on the credits page.
  credits: {},
};

export default spaceOdyssey;
