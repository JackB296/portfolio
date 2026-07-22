// Three crime scenes, read by torchlight.
//
// Each scene is a brief and a set of fixed marks. Some marks are the case;
// most are the room. The work is not finding things — the beam does that — it
// is deciding which of the things you found belong in the file. Positions are
// normalized and fixed so a sweep is learnable (and testable).

export type SceneMark = Readonly<{
  id: string;
  x: number;
  y: number;
  /** What the beam shows once it has been held on the mark. */
  label: string;
  /** The line the case board records, or the reason it doesn't. */
  detail: string;
  /** True when the mark belongs in the file for THIS brief. */
  evidence: boolean;
}>;

export type Scene = Readonly<{
  id: string;
  title: string;
  brief: string;
  /** Starting charge, in percent. Later scenes start colder. */
  battery: number;
  /** Percent per second the torch burns while lit. */
  drain: number;
  marks: readonly SceneMark[];
}>;

export const SCENES: readonly Scene[] = [
  {
    id: "study",
    title: "The study",
    brief: "The mayor's study. Log what the visitor left behind — not what the house owns.",
    battery: 100,
    drain: 2.6,
    marks: [
      {
        id: "s-card",
        x: 0.24,
        y: 0.3,
        label: "A card",
        detail: "A folded card, taped shut, addressed to nobody in the room.",
        evidence: true,
      },
      {
        id: "s-tape",
        x: 0.7,
        y: 0.24,
        label: "Duct tape",
        detail: "A torn strip of duct tape, still holding a thumbprint that isn't the mayor's.",
        evidence: true,
      },
      {
        id: "s-thumb",
        x: 0.47,
        y: 0.66,
        label: "Thumb drive",
        detail: "A drive on a loop of string, left where it would certainly be found.",
        evidence: true,
      },
      {
        id: "s-lamp",
        x: 0.85,
        y: 0.62,
        label: "Desk lamp",
        detail: "A desk lamp, switched off. It has stood there for years.",
        evidence: false,
      },
      {
        id: "s-glass",
        x: 0.12,
        y: 0.74,
        label: "A glass",
        detail: "Half a drink, warm, no second glass. The house, not the visitor.",
        evidence: false,
      },
    ],
  },
  {
    id: "hall",
    title: "The funeral hall",
    brief: "The service. The device came in with someone — log what travelled, not what was set out.",
    battery: 88,
    drain: 3.1,
    marks: [
      {
        id: "h-vest",
        x: 0.2,
        y: 0.24,
        label: "A vest",
        detail: "A padded vest under a coat, cut and re-stitched by hand.",
        evidence: true,
      },
      {
        id: "h-collar",
        x: 0.52,
        y: 0.2,
        label: "Metal collar",
        detail: "A hinged collar with a timer face, hardware-store parts throughout.",
        evidence: true,
      },
      {
        id: "h-note",
        x: 0.78,
        y: 0.36,
        label: "Second card",
        detail: "Another card, same hand, same green ink, addressed to the room.",
        evidence: true,
      },
      {
        id: "h-phone",
        x: 0.34,
        y: 0.7,
        label: "A burner",
        detail: "A cheap phone taped inside a sleeve, one number in the log.",
        evidence: true,
      },
      {
        id: "h-wreath",
        x: 0.66,
        y: 0.74,
        label: "A wreath",
        detail: "Flowers from the city florist. Ordered a week ago, on the record.",
        evidence: false,
      },
      {
        id: "h-order",
        x: 0.88,
        y: 0.14,
        label: "Order of service",
        detail: "The printed order of service. Two hundred identical copies.",
        evidence: false,
      },
      {
        id: "h-chair",
        x: 0.1,
        y: 0.56,
        label: "Folding chair",
        detail: "A hall chair, rented with the room. Nothing on it, nothing under it.",
        evidence: false,
      },
    ],
  },
  {
    id: "flood",
    title: "The seawall",
    brief: "Water to the ankles and the lights failing. Log what the flood carried in, not what it ruined.",
    battery: 76,
    drain: 3.6,
    marks: [
      {
        id: "f-manifest",
        x: 0.17,
        y: 0.22,
        label: "A manifest",
        detail: "A soaked page of ledger entries, all of them routed through one fund.",
        evidence: true,
      },
      {
        id: "f-charge",
        x: 0.44,
        y: 0.18,
        label: "Charge housing",
        detail: "A shaped charge housing, cut from the same stock as the collar.",
        evidence: true,
      },
      {
        id: "f-rifle",
        x: 0.72,
        y: 0.28,
        label: "Rifle case",
        detail: "An empty long case, foam cut for a weapon that is not in it.",
        evidence: true,
      },
      {
        id: "f-tape2",
        x: 0.86,
        y: 0.58,
        label: "Green ink",
        detail: "A pen with green ink, dropped where the water is still rising.",
        evidence: true,
      },
      {
        id: "f-map",
        x: 0.3,
        y: 0.66,
        label: "A marked map",
        detail: "A city map with the seawall circled twice, in the same hand.",
        evidence: true,
      },
      {
        id: "f-crate",
        x: 0.58,
        y: 0.72,
        label: "Broken crate",
        detail: "Dock freight, split by the surge. It has been here longer than tonight.",
        evidence: false,
      },
      {
        id: "f-light",
        x: 0.92,
        y: 0.2,
        label: "Dead floodlight",
        detail: "A floodlight the flood killed. The failure is the water, not the man.",
        evidence: false,
      },
      {
        id: "f-rail",
        x: 0.12,
        y: 0.78,
        label: "Bent railing",
        detail: "Railing bent outward by the wave. Nobody climbed this.",
        evidence: false,
      },
      {
        id: "f-boot",
        x: 0.64,
        y: 0.5,
        label: "A boot",
        detail: "One rubber boot, city issue, size ten. Half the crews wear them.",
        evidence: false,
      },
    ],
  },
];

export const evidenceCount = (scene: Scene) =>
  scene.marks.filter((mark) => mark.evidence).length;
