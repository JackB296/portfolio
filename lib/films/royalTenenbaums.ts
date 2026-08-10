import { defineExperience, music } from "./builders";
import type { FilmDefinition } from "./types";

const royalTenenbaums: FilmDefinition = {
  film: "The Royal Tenenbaums",
  year: 2001,
  grade: {
    vibe: "Mustard book cloth, wallpaper, and centered frames",
    ink: "10 9 6",
    inkSoft: "15 13 9",
    inkCard: "20 17 12",
    accent: "234 179 8",
    accentBright: "250 204 21",
    accentDim: "161 98 7",
    fontDisplay: "Rockwell, 'Rockwell Nova', 'Courier New', serif",
  },
  experience: defineExperience({
    label: "Illustrated family archive",
    signature: "Symmetric chapter framing, Mordecai circling overhead, and a record spinning in the corner",
    // "family archive" and "storybook bands" named the top/bottom overlay that
    // has been removed; these two are drawn by the world that remains.
    markers: ["chapter numbers", "record player", "falcon circuit", "townhouse", "section label", "banked wings"],
    motion: "snap",
    radius: "0px",
    audio: { music: music("Satie: Gymnopédie No. 1", "/audio/film-modes/royal-tenenbaums-music.mp3", { volume: 0.2 }), effects: [] },
    loadVisuals: () => import("@/components/film-experience/modes/royalTenenbaums"),
    // One game, so no menu: the pill opens Mordecai's flight directly.
    simulations: [
      {
        id: "royal-tenenbaums-mordecai",
        name: "mordecai's return",
        load: () => import("@/components/film-experience/simulations/RoyalTenenbaumsMordecai"),
      },
    ],
  }),
  review: {
    rating: 5,
    body: "Wes absolutely kills it with an amazing story and characters that truly immerse you in this world. The soundtrack is revolutionary too. This one never fails to put a smile on my face.",
  },
  // Teknopazzo's CC0 recording — credited as prose on the credits page.
  credits: {},
};

export default royalTenenbaums;
