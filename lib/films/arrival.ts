import { asset, defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

/** Bespoke CSS: see the app/globals.css html[data-film-mode="arrival"]
 * .glass blocks (circular-corner padding and text wrapping). */
const arrival: FilmDefinition = {
  film: "Arrival",
  year: 2016,
  grade: {
    vibe: "Slate mist, ink rings, and suspended light",
    ink: "7 9 12",
    inkSoft: "11 14 18",
    inkCard: "15 19 24",
    accent: "148 163 184",
    accentBright: "203 213 225",
    accentDim: "100 116 139",
    grain: 0.05,
  },
  experience: defineExperience({
    label: "Nonlinear threshold",
    signature: "Original circular ink language loops through fog and nonlinear project time",
    markers: ["12 markers", "seven-part bloom", "mirrored time", "heptapod shadow", "shell hover", "twelve clocks"],
    motion: "loop",
    radius: "999px",
    audio: { music: music("Alien futuristic ambience", "/audio/film-modes/arrival-music.mp3", { volume: 0.18, filterFrequency: 14_000, scrollResponse: 0.12, scrollGain: 0.08, scrollRate: 0.02 }), effects: [] },
    visualAssets: [asset("arrival-fog", "/posters/open/arrival-fog.webp", { left: "0", top: "0", width: "100vw", height: "100vh", objectFit: "cover", objectPosition: "center", opacity: 0.17, blendMode: "luminosity", motion: "breathe" })],
    loadVisuals: () => import("@/components/film-experience/modes/arrival"),
  }),
  review: {
    rating: 5,
    body: "The sound in this movie is some of the best ever, between Jóhannsson's score and the incredible house-shaking sound effects. A film about determinism and free will that will leave you thinking about your own life.",
  },
  credits: {
    pixabayMusic: { title: "The Futuristic Ambience (Everything Is One)", creator: "AlexGrohl", href: "https://pixabay.com/music/ambient-the-futuristic-ambience-everything-is-one-179395/" },
  },
};

export default arrival;
