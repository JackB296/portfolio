// The taxonomy the belt is built on. Two bins are given; the third has to be
// earned by an object that refuses both — and once it exists, the belt keeps
// sending things that need it.

export type Bin = "keep" | "crush" | "curio";

export type Glyph = "disc" | "shard" | "block" | "coil" | "bulb" | "spork" | "ring" | "cube";

export type SalvageItem = Readonly<{
  label: string;
  /** The bin that scores full credit. */
  bin: Bin;
  /** A second defensible answer — half credit, and the belt says so. */
  also?: Bin;
  glyph: Glyph;
}>;

export type Shift = Readonly<{
  label: string;
  /** Belt travel in field-fractions per second. */
  speed: number;
  items: readonly SalvageItem[];
}>;

export const SHIFTS: readonly Shift[] = [
  {
    label: "first light",
    speed: 0.22,
    items: [
      { label: "a dented hubcap", bin: "keep", glyph: "disc" },
      { label: "a shattered bottle", bin: "crush", glyph: "shard" },
      { label: "a working light bulb", bin: "keep", glyph: "bulb" },
      { label: "a rusted paint can", bin: "crush", glyph: "block" },
      { label: "a tangle of bent scrap", bin: "crush", glyph: "coil" },
      { label: "a Rubik's cube", bin: "keep", glyph: "cube" },
    ],
  },
  {
    label: "midday haul",
    speed: 0.3,
    items: [
      { label: "a cracked hubcap", bin: "crush", also: "keep", glyph: "disc" },
      { label: "a lighter that still sparks", bin: "keep", glyph: "bulb" },
      { label: "a crushed soda can", bin: "crush", glyph: "block" },
      // The rule-break. Neither bin will take it.
      { label: "a spork", bin: "curio", glyph: "spork" },
      { label: "a ring box, the ring tossed", bin: "curio", glyph: "ring" },
      { label: "a tire husk", bin: "crush", glyph: "coil" },
      { label: "a sheet of bubble wrap", bin: "keep", also: "curio", glyph: "block" },
      { label: "a snapped antenna", bin: "crush", also: "keep", glyph: "coil" },
    ],
  },
  {
    label: "long shadows",
    speed: 0.4,
    items: [
      { label: "a paddle with no ball", bin: "keep", glyph: "disc" },
      { label: "a fire extinguisher", bin: "keep", glyph: "block" },
      { label: "a shattered monitor", bin: "crush", glyph: "shard" },
      { label: "an eggbeater", bin: "curio", glyph: "coil" },
      { label: "a coil of rusted cable", bin: "crush", glyph: "coil" },
      { label: "a hubcap that still shines", bin: "keep", glyph: "disc" },
      { label: "a bulb with the filament gone", bin: "crush", also: "keep", glyph: "bulb" },
      { label: "a Rubik's cube, solved", bin: "curio", glyph: "cube" },
      { label: "another spork", bin: "curio", glyph: "spork" },
    ],
  },
];

export const BIN_LABEL: Readonly<Record<Bin, string>> = {
  keep: "KEEP",
  crush: "CRUSH",
  curio: "CURIOS",
};
