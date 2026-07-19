import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const her: FilmDefinition = {
  film: "Her",
  year: 2013,
  grade: {
    vibe: "Warm coral, soft bokeh, and attentive waves",
    ink: "14 8 8",
    inkSoft: "20 12 11",
    inkCard: "26 15 14",
    accent: "251 113 133",
    accentBright: "253 164 175",
    accentDim: "190 18 60",
  },
  experience: defineExperience({
    label: "Attentive operating system",
    signature: "A warm attentive waveform, a small earpiece listening, and an OS assembling itself on arrival",
    markers: ["2013", "OS calibration", "earpiece", "warm waveform", "OS boot", "letter cursor"],
    motion: "breathe",
    radius: "20px",
    audio: { music: music("Wistful intimate piano", "/audio/film-modes/her-music.mp3", { volume: 0.19, filterFrequency: 14_000 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/her"),
  }),
  review: {
    rating: 4.5,
    body: "One of the saddest movies ever made, and it only becomes more relevant with time. Definitely give this a rewatch and sit with the fact that this could be the near future. How would you react? What would you do?",
  },
  credits: {
    pixabayMusic: { title: "Sad Piano", creator: "SoundGalleryByDmitryTaras", href: "https://pixabay.com/music/solo-piano-sad-piano-496878/" },
  },
};

export default her;
