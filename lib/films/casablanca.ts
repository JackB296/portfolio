import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

/** Bespoke CSS: see the app/globals.css html[data-film-mode="casablanca"]
 * body::after block (the 35mm projected-frame vignette). */
const casablanca: FilmDefinition = {
  film: "Casablanca",
  year: 1942,
  grade: {
    vibe: "Silver fog, gate weave, and late departures",
    ink: "10 10 10",
    inkSoft: "15 15 15",
    inkCard: "21 21 21",
    accent: "212 212 216",
    accentBright: "244 244 245",
    accentDim: "113 113 122",
    grain: 0.09,
    imageFilter: "grayscale(1) contrast(1.05)",
    display: "serif",
  },
  experience: defineExperience({
    label: "Departing airfield",
    signature: "Fog, a sweeping airfield searchlight, a split-flap board resolving to Lisbon, and a champagne toast",
    markers: ["19:42 departures", "split-flap board", "searchlight tower", "champagne toast", "Lisbon route", "tarmac couple"],
    motion: "dissolve",
    radius: "2px",
    audio: {
      // Historical Jelly Roll Morton side; startAt skips the surface-noise
      // lead-in so the mix opens mid-tune at 1:18.
      music: music("Jelly Roll Morton — Giants of Jazz", "/audio/film-modes/casablanca-music.mp3", { volume: 0.26, startAt: 78 }),
      effects: [effect("event", "Propeller-plane approach", "/audio/film-modes/casablanca-plane.mp3", { volume: 0.34, filterFrequency: 11_000, triggerThreshold: 0.5, triggerCooldownMs: 15_000, segmentDuration: 12 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/casablanca"),
    simulationsMenuTitle: "Of all the games in all the world",
    simulations: [
      {
        id: "casablanca-letters",
        name: "letters of transit",
        load: () => import("@/components/film-experience/simulations/CasablancaLetters"),
      },
      {
        id: "casablanca-roulette",
        name: "land it on 22",
        load: () => import("@/components/film-experience/simulations/CasablancaRoulette"),
      },
      {
        id: "casablanca-runway",
        name: "the runway goodbye",
        load: () => import("@/components/film-experience/simulations/CasablancaRunway"),
      },
      {
        id: "casablanca-piano",
        name: "play it, sam",
        load: () => import("@/components/film-experience/simulations/CasablancaPiano"),
      },
    ],
  }),
  review: {
    rating: 4,
    body: "Rick is who I want and don't want to be all at once. He's an amazingly written, complex character of a kind you rarely see. The shield of detachment he wears slowly breaks down, and the final ten minutes are where he transforms, finally finding self-fulfillment through an act of true altruism.",
  },
  // Music is a historical Jelly Roll Morton recording, credited as prose on
  // app/film-credits/page.tsx with the other vintage/classical recordings.
  credits: {},
};

export default casablanca;
