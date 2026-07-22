import { defineExperience, effect } from "./builders";
import type { FilmDefinition } from "./types";

const furyRoad: FilmDefinition = {
  film: "Mad Max: Fury Road",
  year: 2015,
  grade: {
    vibe: "Chrome glare, rust, and dust at speed",
    ink: "10 5 3",
    inkSoft: "16 8 4",
    inkCard: "22 11 6",
    accent: "249 115 22",
    accentBright: "251 146 60",
    accentDim: "194 65 12",
  },
  experience: defineExperience({
    label: "Centered chase",
    signature: "A juddering war rig and its biker escort run the road through dust and mechanics",
    markers: ["eight-cylinder gauge", "compass", "pole-cats", "chrome sheen", "gear train", "witness me"],
    motion: "rush",
    radius: "1px",
    // No bed and no engine: the wasteland runs on dust alone. The dust loop is
    // the same ledgered CC0 sand recording Dune uses, driven differently here —
    // darker filter, more scroll response, so it reads as grit at speed rather
    // than the slow drift of a dune. See docs/assets/film-mode-audio-ledger.md.
    audio: {
      effects: [effect("loop", "Dust at speed", "/audio/film-modes/dune-sand.mp3", { volume: 0.2, filterFrequency: 9_000, scrollResponse: 0.45, scrollGain: 0.25, scrollRate: 0.12 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/furyRoad"),
    simulationsMenuTitle: "What a lovely day",
    simulations: [
      {
        id: "fury-road-rig",
        name: "the war rig",
        load: () => import("@/components/film-experience/simulations/FuryRoadWarRig"),
      },
      {
        id: "fury-road-witness",
        name: "witness me",
        load: () => import("@/components/film-experience/simulations/FuryRoadWitness"),
      },
      {
        id: "fury-road-polecat",
        name: "polecat swing",
        load: () => import("@/components/film-experience/simulations/FuryRoadPolecat"),
      },
      {
        id: "fury-road-storm",
        name: "into the storm",
        load: () => import("@/components/film-experience/simulations/FuryRoadStorm"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "One of, if not the, best action movies of all time. Truly revolutionary; there is nothing else like it. Every little thing has you thinking, wow, I never would have thought of that. I love a movie with so many details you can tell genuine effort went into, and this is one.",
  },
  // Nothing to credit: the Pixabay music bed and engine loop were both retired
  // on 2026-07-21, and the dust loop that replaced them is a CC0 recording
  // (credited on the CC0 line of the credits page, like Dune's sand).
  credits: {},
};

export default furyRoad;
