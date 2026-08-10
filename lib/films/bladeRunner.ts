import { defineExperience, effect, music } from "./builders";
import type { FilmDefinition } from "./types";

const bladeRunner: FilmDefinition = {
  film: "Blade Runner 2049",
  year: 2017,
  grade: {
    vibe: "Ochre haze, cold rain, and monumental city grids",
    ink: "8 6 20",
    inkSoft: "12 9 28",
    inkCard: "16 12 36",
    accent: "234 88 12",
    accentBright: "251 146 60",
    accentDim: "154 52 18",
    fontDisplay: "'OCR A Extended', 'OCR A', Consolas, 'Lucida Console', monospace",
  },
  experience: defineExperience({
    label: "Ochre memory rain",
    signature: "Dense neon megastructures, flashing signage, spinner traffic, drifting holograms, and cold rain",
    markers: ["2017 archive", "memory index", "neon rain", "spinner traffic", "hologram ad", "baseline test"],
    motion: "drift",
    radius: "4px",
    audio: {
      music: music("Interrogation noir jazz", "/audio/film-modes/blade-runner-music.mp3", { volume: 0.19, filterFrequency: 14_000 }),
      effects: [effect("loop", "Rain on balcony metal", "/audio/film-modes/blade-runner-rain.mp3", { volume: 0.08, filterFrequency: 12_000, scrollResponse: 0.3, scrollGain: 0.24, scrollRate: 0.02 })],
    },
    loadVisuals: () => import("@/components/film-experience/modes/bladeRunner"),
    simulationsMenuTitle: "More human than human",
    simulations: [
      {
        id: "blade-runner-vk",
        name: "voight-kampff",
        load: () => import("@/components/film-experience/simulations/BladeRunnerVoightKampff"),
      },
      {
        id: "blade-runner-enhance",
        name: "enhance",
        load: () => import("@/components/film-experience/simulations/BladeRunnerEnhance"),
      },
      {
        id: "blade-runner-origami",
        name: "origami tell",
        load: () => import("@/components/film-experience/simulations/BladeRunnerOrigami"),
      },
    ],
  }),
  review: {
    rating: 4,
    body: "Nothing better than a grim cyberpunk future, and this delivers that aesthetic with a great story and a beautiful soundtrack. This movie and its original only become more relevant as AI booms and the line between real and artificial thins. I have watched it twice: once believing there is a line and always will be, and once believing there is none. What I found is that the line is just something we make up in our heads. Where do intelligence and artificial intelligence really differ, if something can feel suffering?",
  },
  credits: {
    pixabayMusic: { title: "Police Interrogation (ASMR Noir Jazz)", creator: "KonstantinPazuzuStudio", href: "https://pixabay.com/music/crime-scene-police-interrogation-asmr-noir-jazz-520244/" },
  },
};

export default bladeRunner;
