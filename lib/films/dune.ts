import { asset, defineExperience, effect } from "./builders";
import type { FilmDefinition } from "./types";

const dune: FilmDefinition = {
  film: "Dune",
  year: 2021,
  grade: {
    vibe: "Wind-carved sand, heat haze, and desert shadow",
    ink: "12 9 5",
    inkSoft: "18 13 8",
    inkCard: "24 18 11",
    accent: "217 119 6",
    accentBright: "245 158 11",
    accentDim: "146 64 14",
    grain: 0.06,
  },
  experience: defineExperience({
    label: "Desert power",
    signature: "Wind-driven sand, heat shimmer, and layered dune crests",
    markers: ["twin moons", "water allocation", "ornithopter", "spice blow", "spice glints"],
    motion: "pulse",
    radius: "1px",
    // No music bed: Arrakis is wind and sand, nothing scored over it.
    audio: {
      effects: [effect("loop", "Flowing desert sand", "/audio/film-modes/dune-sand.mp3", { volume: 0.09, filterFrequency: 9_000, scrollResponse: 0.58, scrollGain: 0.34, scrollRate: 0.1 })],
    },
    visualAssets: [asset("dune-namib", "/posters/open/dune-namib.webp", { left: "0", top: "43vh", width: "100vw", height: "57vh", objectFit: "cover", objectPosition: "center 55%", opacity: 0.22, blendMode: "soft-light", motion: "breathe" })],
    loadVisuals: () => import("@/components/film-experience/modes/dune"),
    simulationsMenuTitle: "The sleeper must awaken",
    simulations: [
      {
        id: "dune-sandwalk",
        name: "walk without rhythm",
        load: () => import("@/components/film-experience/simulations/DuneSandwalk"),
      },
      {
        id: "dune-gom-jabbar",
        name: "the gom jabbar",
        load: () => import("@/components/film-experience/simulations/DuneGomJabbar"),
      },
      {
        id: "dune-slow-blade",
        name: "the slow blade",
        load: () => import("@/components/film-experience/simulations/DuneSlowBlade"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "All hail Villeneuve. To take a story as complex as Dune and do it justice is truly impressive. The commentary on politics, ecology, religion, and human evolution through the lens of a far future opens your mind to analyzing human behavior and psychology in ways you've never thought of before.",
  },
  // No attribution rows: the choir bed was retired on 2026-07-21 and its
  // recording deleted, and the sand loop it left behind is CC0.
  credits: {},
};

export default dune;
