"use client";

import { accentAlpha } from "@/lib/theme";

// The Esper's photographs, drawn rather than photographed.
//
// Every case is a noir interior described in scene units — shapes with
// positions and sizes in a fixed 1200x800 space — which the deck renders
// through a pan/zoom transform. Nothing here is a still, a texture, or an
// asset: a room is walls, a lamp cone, a mirror, a doorway and the things left
// on the furniture, and it holds up under magnification because it is geometry
// rather than pixels.
//
// The `at` field on a shape is the magnification at which it begins to resolve.
// A reflection in the mirror, a number stencilled on a tag, a shape standing in
// the dark behind a door: none of them exist in the wide frame. They arrive as
// the operator pushes in and the grain gives way, which is the whole feeling
// the scene is built to produce.

export const SCENE_W = 1200;
export const SCENE_H = 800;

/** Canvas paint, expressed against the live grade rather than a fixed hex. */
export type Paint = Readonly<{ c: "accent" | "ink" | "white"; a: number }>;

const A = (a: number): Paint => ({ c: "accent", a });
const K = (a: number): Paint => ({ c: "ink", a });
const W = (a: number): Paint => ({ c: "white", a });

type Common = Readonly<{
  fill?: Paint;
  stroke?: Paint;
  /** Stroke width in screen pixels — held constant as the view scales. */
  lw?: number;
  /** Magnification at which this begins to resolve. Omitted means "always". */
  at?: number;
}>;

export type Shape =
  | (Common & Readonly<{ t: "rect"; x: number; y: number; w: number; h: number }>)
  | (Common & Readonly<{ t: "ellipse"; x: number; y: number; rx: number; ry: number }>)
  | (Common & Readonly<{ t: "poly"; pts: readonly number[]; open?: boolean }>)
  | (Common & Readonly<{ t: "line"; x1: number; y1: number; x2: number; y2: number }>)
  | (Common & Readonly<{ t: "glow"; x: number; y: number; r: number }>)
  | (Common &
      Readonly<{
        t: "text";
        x: number;
        y: number;
        size: number;
        text: string;
        align?: CanvasTextAlign;
      }>);

/** The one thing in the frame the case is asking for. */
export type EsperTarget = Readonly<{
  /** Centre in scene units. */
  x: number;
  y: number;
  /** How close the frame centre must be, in scene units. */
  r: number;
  /** Magnification the print needs before the detail is legible. */
  at: number;
  /** What the operator is looking at once it resolves. */
  finding: string;
}>;

export type EsperHint = Readonly<{
  text: string;
  /** The last hint slews the deck to the sector instead of describing it. */
  lock?: boolean;
}>;

export type EsperCase = Readonly<{
  id: string;
  label: string;
  /** Why the frame is on the deck at all. */
  brief: string;
  /** The sector the lock hint calls out, for the operator's log. */
  sector: string;
  hints: readonly EsperHint[];
  target: EsperTarget;
  shapes: readonly Shape[];
}>;

// ---------------------------------------------------------------------------
// Shared furniture. Each returns scene-space shapes so the three rooms are
// built from the same vocabulary and read as one photographer's night.
// ---------------------------------------------------------------------------

/** Floorboards running to a vanishing point — the depth cue every room needs. */
function floorboards(
  y: number,
  bottom: number,
  vanishX: number,
  count: number,
  paint: Paint
): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i <= count; i += 1) {
    const x = (i / count) * SCENE_W * 1.8 - SCENE_W * 0.4;
    out.push({ t: "line", x1: vanishX, y1: y, x2: x, y2: bottom, stroke: paint, lw: 1, at: 2 });
  }
  return out;
}

/** A hanging lamp: flex, shade, cone of light, and the pool it throws. */
function lamp(x: number, y: number, spread: number, floorY: number): Shape[] {
  return [
    { t: "line", x1: x, y1: 0, x2: x, y2: y, stroke: A(0.3), lw: 1 },
    { t: "poly", pts: [x - 34, y, x + 34, y, x + 18, y - 26, x - 18, y - 26], fill: A(0.32) },
    { t: "glow", x, y: y + 8, r: 90, fill: A(0.5) },
    { t: "poly", pts: [x - 30, y + 4, x + 30, y + 4, x + spread, floorY, x - spread, floorY], fill: A(0.055) },
    { t: "ellipse", x, y: floorY, rx: spread, ry: spread * 0.24, fill: A(0.07) },
  ];
}

/** Venetian blinds over a lit window, with the street showing between slats. */
function blindWindow(x: number, y: number, w: number, h: number): Shape[] {
  const out: Shape[] = [
    { t: "rect", x, y, w, h, fill: A(0.1) },
    { t: "rect", x, y, w, h, stroke: A(0.34), lw: 2 },
  ];
  // The city beyond: blocks, then windows in the blocks, then rain on the pane.
  out.push({ t: "rect", x: x + 18, y: y + h * 0.32, w: w * 0.3, h: h * 0.68, fill: K(0.3), at: 2.4 });
  out.push({ t: "rect", x: x + w * 0.52, y: y + h * 0.18, w: w * 0.34, h: h * 0.82, fill: K(0.34), at: 2.4 });
  for (let i = 0; i < 14; i += 1) {
    const bx = x + 26 + (i % 4) * 22;
    const by = y + h * 0.4 + Math.floor(i / 4) * 30;
    out.push({ t: "rect", x: bx, y: by, w: 10, h: 14, fill: A(0.34), at: 4 });
  }
  for (let i = 0; i < 18; i += 1) {
    const rx = x + 8 + ((i * 53) % (w - 16));
    const ry = y + 10 + ((i * 97) % (h - 40));
    out.push({ t: "line", x1: rx, y1: ry, x2: rx - 5, y2: ry + 26, stroke: W(0.16), lw: 1, at: 5 });
  }
  // Slats last, so the street sits behind them.
  for (let sy = y + 10; sy < y + h - 6; sy += 15) {
    out.push({ t: "rect", x: x + 4, y: sy, w: w - 8, h: 7, fill: A(0.2) });
    out.push({ t: "line", x1: x + 4, y1: sy + 7, x2: x + w - 4, y2: sy + 7, stroke: K(0.35), lw: 1, at: 3 });
  }
  return out;
}

/** A doorway cut into the back wall, keeping its own dark. */
function doorway(x: number, y: number, w: number, h: number, darkness: number): Shape[] {
  return [
    { t: "rect", x: x - 10, y: y - 10, w: w + 20, h: h + 10, fill: A(0.09) },
    { t: "rect", x, y, w, h, fill: K(darkness) },
    { t: "rect", x, y, w, h, stroke: A(0.26), lw: 2 },
  ];
}

/**
 * Emulsion structure — flecks and hairline scratches scattered over a region,
 * arriving between ×6 and ×15. A flat fill viewed at ×15 is a flat fill, so
 * every scene carries a layer of this: it is what a magnified frame is made of
 * once the furniture is bigger than the viewport.
 */
function emulsion(x: number, y: number, w: number, h: number, count: number, seed: number): Shape[] {
  const out: Shape[] = [];
  let n = seed;
  const next = () => {
    n = (n * 1_103_515_245 + 12_345) % 2_147_483_648;
    return n / 2_147_483_648;
  };
  for (let i = 0; i < count; i += 1) {
    const px = x + next() * w;
    const py = y + next() * h;
    const at = 6 + next() * 9;
    const roll = next();
    if (roll < 0.55) {
      out.push({ t: "ellipse", x: px, y: py, rx: 0.5 + next() * 1.1, ry: 0.5 + next() * 1.1, fill: W(0.1 + next() * 0.2), at });
    } else if (roll < 0.85) {
      out.push({ t: "ellipse", x: px, y: py, rx: 0.6 + next() * 1.4, ry: 0.6 + next() * 1.4, fill: K(0.14 + next() * 0.24), at });
    } else {
      const len = 4 + next() * 16;
      out.push({ t: "line", x1: px, y1: py, x2: px + len, y2: py + (next() - 0.5) * 5, stroke: W(0.08 + next() * 0.12), lw: 1, at });
    }
  }
  return out;
}

/** A standing figure, blocked out in planes rather than an outline. */
function figure(x: number, footY: number, height: number, paint: Paint, at: number): Shape[] {
  const headR = height * 0.085;
  const shoulder = footY - height * 0.78;
  return [
    { t: "ellipse", x, y: footY - height * 0.9, rx: headR, ry: headR * 1.15, fill: paint, at },
    {
      t: "poly",
      pts: [
        x - height * 0.15, shoulder,
        x + height * 0.15, shoulder,
        x + height * 0.115, footY - height * 0.34,
        x + height * 0.06, footY,
        x - height * 0.06, footY,
        x - height * 0.115, footY - height * 0.34,
      ],
      fill: paint,
      at,
    },
    { t: "line", x1: x - height * 0.1, y1: shoulder + 6, x2: x - height * 0.14, y2: footY - height * 0.4, stroke: paint, lw: 3, at },
    { t: "line", x1: x + height * 0.1, y1: shoulder + 6, x2: x + height * 0.14, y2: footY - height * 0.4, stroke: paint, lw: 3, at },
  ];
}

// ---------------------------------------------------------------------------
// Case one — the mirror. The room says he was alone; the glass disagrees.
// ---------------------------------------------------------------------------

function apartmentNine(): Shape[] {
  const out: Shape[] = [];
  const FLOOR = 620;

  out.push({ t: "rect", x: 0, y: 0, w: SCENE_W, h: FLOOR, fill: A(0.05) });
  out.push({ t: "rect", x: 0, y: FLOOR, w: SCENE_W, h: SCENE_H - FLOOR, fill: A(0.035) });
  out.push({ t: "line", x1: 0, y1: FLOOR, x2: SCENE_W, y2: FLOOR, stroke: A(0.22), lw: 2 });
  out.push(...floorboards(FLOOR, SCENE_H, 640, 16, A(0.08)));
  // Wallpaper: a faint vertical stripe that only reads once you are inside it.
  for (let x = 0; x < SCENE_W; x += 26) {
    out.push({ t: "line", x1: x, y1: 0, x2: x, y2: FLOOR, stroke: A(0.035), lw: 1, at: 3 });
  }
  // Cornice.
  out.push({ t: "rect", x: 0, y: 44, w: SCENE_W, h: 10, fill: A(0.1), at: 1.6 });

  out.push(...blindWindow(96, 120, 280, 330));
  out.push(...doorway(690, 176, 156, FLOOR - 176, 0.62));
  // The real doorway is empty — a hallway runner, a skirting line, nobody.
  out.push({ t: "rect", x: 706, y: 560, w: 124, h: 60, fill: A(0.05), at: 3 });
  out.push({ t: "line", x1: 706, y1: 468, x2: 830, y2: 468, stroke: A(0.09), lw: 1, at: 4 });

  out.push(...lamp(520, 96, 190, FLOOR));

  // Table, glass, ashtray, and a photograph with a lab stamp — a decoy that
  // rewards magnification without answering the brief.
  out.push({ t: "rect", x: 386, y: 512, w: 300, h: 20, fill: A(0.17) });
  out.push({ t: "rect", x: 386, y: 532, w: 300, h: 8, fill: K(0.28), at: 2 });
  out.push({ t: "line", x1: 404, y1: 540, x2: 396, y2: FLOOR, stroke: A(0.2), lw: 4 });
  out.push({ t: "line", x1: 668, y1: 540, x2: 676, y2: FLOOR, stroke: A(0.2), lw: 4 });
  out.push({ t: "rect", x: 432, y: 470, w: 30, h: 44, fill: A(0.14), at: 1.8 });
  out.push({ t: "ellipse", x: 447, y: 470, rx: 15, ry: 5, fill: A(0.3), at: 2.4 });
  out.push({ t: "rect", x: 432, y: 494, w: 30, h: 20, fill: A(0.22), at: 3 });
  out.push({ t: "ellipse", x: 546, y: 508, rx: 30, ry: 10, fill: A(0.14), at: 2.4 });
  out.push({ t: "line", x1: 540, y1: 500, x2: 566, y2: 486, stroke: W(0.4), lw: 2, at: 4 });
  out.push({ t: "rect", x: 596, y: 496, w: 66, h: 46, fill: A(0.16), at: 2.2 });
  out.push({ t: "rect", x: 602, y: 502, w: 54, h: 28, fill: K(0.4), at: 4 });
  out.push({ t: "text", x: 604, y: 539, size: 9, text: "LOT 44-C", fill: A(0.75), at: 8 });

  // Chair, pushed back and turned away.
  out.push({ t: "rect", x: 300, y: 500, w: 62, h: 12, fill: A(0.15), at: 1.6 });
  out.push({ t: "rect", x: 300, y: 420, w: 12, h: 84, fill: A(0.15), at: 1.6 });
  out.push({ t: "line", x1: 308, y1: 512, x2: 302, y2: FLOOR, stroke: A(0.18), lw: 3, at: 2 });
  out.push({ t: "line", x1: 356, y1: 512, x2: 362, y2: FLOOR, stroke: A(0.18), lw: 3, at: 2 });

  // Radiator under the window.
  for (let i = 0; i < 9; i += 1) {
    out.push({ t: "rect", x: 116 + i * 17, y: 520, w: 9, h: 96, fill: A(0.12), at: 2.2 });
  }

  // The mirror. Frame, glass, and — inside the glass — the room reversed: the
  // window's light on the left becomes light on the right, the doorway lands
  // opposite, and someone is standing in it.
  const MX = 926;
  const MY = 150;
  const MW = 226;
  const MH = 306;
  out.push({ t: "rect", x: MX - 12, y: MY - 12, w: MW + 24, h: MH + 24, fill: A(0.2) });
  out.push({ t: "rect", x: MX - 12, y: MY - 12, w: MW + 24, h: MH + 24, stroke: A(0.42), lw: 2 });
  out.push({ t: "rect", x: MX, y: MY, w: MW, h: MH, fill: K(0.34) });
  out.push({ t: "rect", x: MX, y: MY, w: MW, h: MH, fill: A(0.055) });
  // Reflected room, arriving in layers.
  out.push({ t: "rect", x: MX, y: MY + MH * 0.72, w: MW, h: MH * 0.28, fill: A(0.05), at: 2 });
  out.push({ t: "glow", x: MX + MW * 0.78, y: MY + MH * 0.3, r: 74, fill: A(0.24), at: 2.6 });
  // The reflected doorway is lit from the hall behind it. That bright field is
  // what makes the tell legible: a silhouette needs something to be a
  // silhouette against, and dark-on-dark reads as nothing at any magnification.
  out.push({ t: "rect", x: MX + 26, y: MY + 40, w: 72, h: MH * 0.68, fill: A(0.32), at: 3.4 });
  out.push({ t: "rect", x: MX + 26, y: MY + 40, w: 72, h: MH * 0.68, stroke: A(0.44), lw: 1, at: 4 });
  out.push({ t: "glow", x: MX + 62, y: MY + 40 + MH * 0.36, r: 62, fill: A(0.22), at: 5 });
  // The tell: someone standing in it, and — deeper still — a face. Kept short
  // enough that the whole figure fits the viewport at the magnification it
  // resolves at; a taller one would only ever be seen as a torso.
  const standY = MY + 40 + MH * 0.68 - 8;
  out.push(...figure(MX + 62, standY, 118, K(0.82), 7));
  out.push({ t: "line", x1: MX + 74, y1: standY - 88, x2: MX + 76, y2: standY - 38, stroke: W(0.45), lw: 2, at: 9 });
  out.push({ t: "ellipse", x: MX + 58, y: standY - 109, rx: 1.9, ry: 1.9, fill: W(0.85), at: 11 });
  out.push({ t: "ellipse", x: MX + 66, y: standY - 109, rx: 1.9, ry: 1.9, fill: W(0.85), at: 11 });
  out.push({ t: "line", x1: MX + 56, y1: standY - 101, x2: MX + 68, y2: standY - 101, stroke: W(0.24), lw: 1, at: 14 });
  // Glass imperfections, so the surface reads as glass at depth.
  out.push({ t: "line", x1: MX + 8, y1: MY + 30, x2: MX + MW - 20, y2: MY + 92, stroke: W(0.05), lw: 2, at: 5 });
  out.push({ t: "line", x1: MX + 140, y1: MY + 8, x2: MX + 190, y2: MY + MH - 20, stroke: W(0.035), lw: 1, at: 6 });

  // Dust in the lamp cone — only at depth, and only where the light is.
  for (let i = 0; i < 26; i += 1) {
    const dx = 440 + ((i * 137) % 170);
    const dy = 180 + ((i * 211) % 380);
    out.push({ t: "ellipse", x: dx, y: dy, rx: 1.6, ry: 1.6, fill: W(0.3), at: 6 });
  }

  out.push(...emulsion(0, 0, SCENE_W, SCENE_H, 900, 7717));
  // Denser inside the glass, so the mirror keeps texture at the depth the
  // case is actually read at.
  out.push(...emulsion(MX, MY, MW, MH, 320, 4241));
  return out;
}

// ---------------------------------------------------------------------------
// Case two — the tag. A case left at a hotel desk, and a number on its label.
// ---------------------------------------------------------------------------

function hotelDesk(): Shape[] {
  const out: Shape[] = [];
  const FLOOR = 596;

  out.push({ t: "rect", x: 0, y: 0, w: SCENE_W, h: FLOOR, fill: A(0.045) });
  out.push({ t: "rect", x: 0, y: FLOOR, w: SCENE_W, h: SCENE_H - FLOOR, fill: A(0.03) });
  out.push({ t: "rect", x: 0, y: FLOOR - 14, w: SCENE_W, h: 14, fill: A(0.12) });
  out.push(...floorboards(FLOOR, SCENE_H, 500, 14, A(0.07)));

  out.push(...blindWindow(60, 96, 240, 300));

  // Key rack: hooks, keys, and room numbers stamped on the fobs. Every number
  // here is a decoy — the manifest wants a case number, not a room.
  out.push({ t: "rect", x: 370, y: 116, w: 330, h: 196, fill: A(0.08) });
  out.push({ t: "rect", x: 370, y: 116, w: 330, h: 196, stroke: A(0.3), lw: 2 });
  const rooms = ["204", "207", "211", "218", "223", "229", "231", "240", "244", "251", "255", "262"];
  for (let i = 0; i < 12; i += 1) {
    const kx = 398 + (i % 4) * 78;
    const ky = 150 + Math.floor(i / 4) * 58;
    out.push({ t: "line", x1: kx, y1: ky - 8, x2: kx, y2: ky, stroke: A(0.34), lw: 2, at: 2 });
    out.push({ t: "rect", x: kx - 13, y: ky, w: 26, h: 20, fill: A(0.22), at: 2.6 });
    out.push({ t: "line", x1: kx, y1: ky + 20, x2: kx, y2: ky + 34, stroke: A(0.3), lw: 2, at: 3.4 });
    out.push({ t: "rect", x: kx - 4, y: ky + 30, w: 9, h: 6, fill: A(0.34), at: 4.4 });
    out.push({ t: "text", x: kx - 11, y: ky + 15, size: 11, text: rooms[i], fill: K(0.72), at: 7 });
  }

  // The counter, the ledger, the bell.
  out.push({ t: "rect", x: 40, y: 430, w: 560, h: 30, fill: A(0.2) });
  out.push({ t: "rect", x: 40, y: 460, w: 560, h: 200, fill: A(0.07) });
  for (let x = 70; x < 590; x += 66) {
    out.push({ t: "line", x1: x, y1: 462, x2: x, y2: 656, stroke: A(0.07), lw: 1, at: 2.6 });
  }
  out.push({ t: "rect", x: 150, y: 400, w: 168, h: 32, fill: A(0.14), at: 1.6 });
  out.push({ t: "rect", x: 156, y: 396, w: 156, h: 8, fill: A(0.24), at: 2.4 });
  for (let i = 0; i < 7; i += 1) {
    out.push({ t: "line", x1: 168, y1: 408 + i * 3.4, x2: 168 + 110 - (i % 3) * 24, y2: 408 + i * 3.4, stroke: K(0.4), lw: 1, at: 6 });
  }
  out.push({ t: "ellipse", x: 400, y: 424, rx: 22, ry: 12, fill: A(0.24), at: 2 });
  out.push({ t: "rect", x: 378, y: 424, w: 44, h: 8, fill: A(0.3), at: 2.6 });

  // The pool of light on the floor, and the case standing in it.
  out.push(...lamp(872, 130, 200, FLOOR + 96));

  const SX = 764;
  const SY = 540;
  out.push({ t: "ellipse", x: 880, y: 700, rx: 190, ry: 44, fill: A(0.075) });
  out.push({ t: "rect", x: SX, y: SY, w: 232, h: 152, fill: A(0.13) });
  out.push({ t: "rect", x: SX, y: SY, w: 232, h: 152, stroke: A(0.36), lw: 2 });
  out.push({ t: "line", x1: SX, y1: SY + 76, x2: SX + 232, y2: SY + 76, stroke: A(0.26), lw: 2, at: 2 });
  out.push({ t: "rect", x: SX + 40, y: SY + 66, w: 26, h: 20, fill: A(0.34), at: 3 });
  out.push({ t: "rect", x: SX + 166, y: SY + 66, w: 26, h: 20, fill: A(0.34), at: 3 });
  // Handle, and the tag hanging off it into the light.
  out.push({ t: "poly", pts: [SX + 92, SY, SX + 92, SY - 30, SX + 140, SY - 30, SX + 140, SY], open: true, stroke: A(0.42), lw: 4 });
  out.push({ t: "line", x1: SX + 132, y1: SY - 26, x2: SX + 140, y2: SY - 4, stroke: A(0.4), lw: 1.5, at: 3.4 });
  out.push({ t: "poly", pts: [SX + 126, SY - 6, SX + 168, SY - 14, SX + 174, SY + 26, SX + 132, SY + 34], fill: A(0.5), at: 4 });
  out.push({ t: "poly", pts: [SX + 130, SY - 2, SX + 164, SY - 8, SX + 169, SY + 21, SX + 135, SY + 28], fill: K(0.2), at: 5.4 });
  out.push({ t: "text", x: SX + 134, y: SY + 12, size: 13, text: "N6-4041", fill: K(0.82), at: 9 });
  out.push({ t: "line", x1: SX + 134, y1: SY + 18, x2: SX + 167, y2: SY + 13, stroke: K(0.4), lw: 1, at: 10 });

  // A second case in the shadow, tag blank — the wrong answer for the impatient.
  out.push({ t: "rect", x: 1024, y: 596, w: 150, h: 100, fill: A(0.07), at: 1.6 });
  out.push({ t: "rect", x: 1024, y: 596, w: 150, h: 100, stroke: A(0.16), lw: 2, at: 2 });
  out.push({ t: "poly", pts: [1074, 596, 1074, 574, 1116, 574, 1116, 596], open: true, stroke: A(0.2), lw: 3, at: 2.6 });
  out.push({ t: "poly", pts: [1108, 578, 1136, 574, 1140, 600, 1112, 604], fill: A(0.16), at: 4 });

  // A stencilled crate — more numbers that are not the number.
  out.push({ t: "rect", x: 620, y: 636, w: 118, h: 92, fill: A(0.08), at: 1.8 });
  out.push({ t: "rect", x: 620, y: 636, w: 118, h: 92, stroke: A(0.2), lw: 2, at: 2.4 });
  out.push({ t: "text", x: 632, y: 690, size: 15, text: "LDS-9", fill: A(0.5), at: 6 });

  // Radiator, right of frame.
  for (let i = 0; i < 7; i += 1) {
    out.push({ t: "rect", x: 1052 + i * 20, y: 400, w: 11, h: 168, fill: A(0.1), at: 2.4 });
  }

  out.push(...emulsion(0, 0, SCENE_W, SCENE_H, 900, 3313));
  out.push(...emulsion(SX, SY - 40, 240, 200, 260, 8887));
  return out;
}

// ---------------------------------------------------------------------------
// Case three — the doorway. Everything in the open was photographed already.
// ---------------------------------------------------------------------------

function roofDoor(): Shape[] {
  const out: Shape[] = [];
  const DECK = 566;

  // Sky, lit from below by a city nobody in frame is looking at.
  out.push({ t: "rect", x: 0, y: 0, w: SCENE_W, h: DECK, fill: K(0.34) });
  out.push({ t: "glow", x: 220, y: DECK, r: 420, fill: A(0.18) });
  out.push({ t: "glow", x: 1030, y: DECK - 40, r: 300, fill: A(0.12) });
  out.push({ t: "rect", x: 0, y: DECK, w: SCENE_W, h: SCENE_H - DECK, fill: A(0.055) });
  for (let x = 0; x <= SCENE_W; x += 96) {
    out.push({ t: "line", x1: x, y1: DECK, x2: x, y2: SCENE_H, stroke: A(0.05), lw: 1, at: 2.4 });
  }
  for (let y = DECK + 60; y < SCENE_H; y += 68) {
    out.push({ t: "line", x1: 0, y1: y, x2: SCENE_W, y2: y, stroke: A(0.05), lw: 1, at: 2.4 });
  }

  // A neon sign across the gap, with copy that only resolves close up.
  out.push({ t: "rect", x: 40, y: 150, w: 250, h: 340, fill: K(0.42) });
  out.push({ t: "rect", x: 66, y: 200, w: 196, h: 62, fill: A(0.2), at: 2 });
  out.push({ t: "rect", x: 66, y: 200, w: 196, h: 62, stroke: A(0.5), lw: 2, at: 2.6 });
  out.push({ t: "text", x: 82, y: 244, size: 30, text: "SHIMATA", fill: A(0.8), at: 6 });
  for (let i = 0; i < 12; i += 1) {
    out.push({ t: "rect", x: 62 + (i % 3) * 68, y: 300 + Math.floor(i / 3) * 44, w: 34, h: 24, fill: A(0.16), at: 3.4 });
  }

  // The stairwell head.
  out.push({ t: "rect", x: 396, y: 190, w: 430, h: 380, fill: A(0.085) });
  out.push({ t: "rect", x: 396, y: 190, w: 430, h: 380, stroke: A(0.26), lw: 2 });
  out.push({ t: "rect", x: 380, y: 176, w: 462, h: 22, fill: A(0.15) });
  for (let y = 220; y < 560; y += 34) {
    out.push({ t: "line", x1: 400, y1: y, x2: 822, y2: y, stroke: A(0.05), lw: 1, at: 3 });
  }
  // Rust and rivets, arriving at depth.
  for (let i = 0; i < 22; i += 1) {
    out.push({ t: "ellipse", x: 412 + ((i * 149) % 400), y: 210 + ((i * 233) % 340), rx: 2.4, ry: 2.4, fill: A(0.22), at: 5 });
  }

  out.push(...doorway(506, 292, 200, 278, 0.78));
  // Inside: a jamb light, the top step, and a shape sitting on it.
  out.push({ t: "line", x1: 506, y1: 292, x2: 506, y2: 570, stroke: A(0.3), lw: 3, at: 2 });
  out.push({ t: "rect", x: 516, y: 500, w: 180, h: 14, fill: A(0.08), at: 3 });
  out.push({ t: "rect", x: 528, y: 514, w: 156, h: 12, fill: A(0.05), at: 4 });
  out.push({ t: "glow", x: 606, y: 496, r: 70, fill: A(0.07), at: 6 });
  // The unicorn: folded planes, a horn, a crease highlight at real depth. Sized
  // so the whole animal frames inside the viewport at the magnification it
  // resolves at — any larger and pushing in far enough to see it means being
  // too far inside it to recognise it.
  out.push({
    t: "poly",
    pts: [583, 499, 592, 475, 599, 481, 612, 469, 616, 481, 624, 491, 620, 499],
    fill: A(0.32),
    at: 11,
  });
  out.push({ t: "poly", pts: [592, 475, 599, 481, 596, 491], fill: A(0.46), at: 11 });
  out.push({ t: "poly", pts: [612, 469, 624, 455, 616, 472], fill: A(0.52), at: 12 });
  out.push({ t: "line", x1: 599, y1: 481, x2: 616, y2: 481, stroke: W(0.4), lw: 1.5, at: 13 });
  out.push({ t: "line", x1: 587, y1: 496, x2: 604, y2: 485, stroke: W(0.3), lw: 1, at: 14 });
  out.push({ t: "ellipse", x: 602, y: 501, rx: 22, ry: 4, fill: K(0.34), at: 12 });

  // Ducting and an aerial mast.
  out.push({ t: "rect", x: 860, y: 380, w: 180, h: 60, fill: A(0.1), at: 1.6 });
  for (let i = 0; i < 7; i += 1) {
    out.push({ t: "rect", x: 866 + i * 26, y: 380, w: 8, h: 60, fill: A(0.16), at: 3 });
  }
  out.push({ t: "rect", x: 940, y: 440, w: 26, h: 130, fill: A(0.1), at: 2 });
  out.push({ t: "line", x1: 1120, y1: 566, x2: 1120, y2: 210, stroke: A(0.24), lw: 3, at: 1.6 });
  out.push({ t: "line", x1: 1120, y1: 240, x2: 1160, y2: 268, stroke: A(0.18), lw: 2, at: 2.6 });
  out.push({ t: "line", x1: 1120, y1: 240, x2: 1080, y2: 268, stroke: A(0.18), lw: 2, at: 2.6 });

  // Fire-escape rail across the foreground.
  out.push({ t: "line", x1: 0, y1: 700, x2: SCENE_W, y2: 676, stroke: A(0.26), lw: 4, at: 1.4 });
  for (let x = 40; x < SCENE_W; x += 110) {
    out.push({ t: "line", x1: x, y1: 690, x2: x, y2: SCENE_H, stroke: A(0.2), lw: 3, at: 2 });
  }

  // The puddle. It shows a person — ours, standing off-camera. The decoy.
  out.push({ t: "ellipse", x: 236, y: 692, rx: 172, ry: 46, fill: K(0.42) });
  out.push({ t: "ellipse", x: 236, y: 692, rx: 172, ry: 46, fill: A(0.075) });
  out.push({ t: "rect", x: 176, y: 664, w: 122, h: 20, fill: A(0.16), at: 4 });
  out.push({ t: "text", x: 184, y: 680, size: 13, text: "ATAMIHS", fill: A(0.6), at: 8 });
  out.push(...figure(300, 726, 108, K(0.5), 7));
  for (let i = 0; i < 9; i += 1) {
    out.push({ t: "line", x1: 100 + i * 34, y1: 676 + (i % 3) * 12, x2: 140 + i * 34, y2: 676 + (i % 3) * 12, stroke: W(0.1), lw: 1, at: 6 });
  }

  // Pigeons on the parapet — motion the operator has to discount.
  for (const px of [858, 892, 934]) {
    out.push({ t: "ellipse", x: px, y: 560, rx: 11, ry: 8, fill: A(0.22), at: 4 });
    out.push({ t: "ellipse", x: px + 8, y: 552, rx: 4.4, ry: 4.4, fill: A(0.26), at: 5 });
  }

  out.push(...emulsion(0, 0, SCENE_W, SCENE_H, 900, 5591));
  out.push(...emulsion(506, 292, 200, 278, 300, 1289));
  return out;
}

export const ESPER_CASES: readonly EsperCase[] = [
  {
    id: "apartment-nine",
    label: "Apartment 9 · the mirror",
    brief:
      "The tenant swears he spent the evening alone. A neighbour puts a second person in the room. The frame is one exposure through his open door — find something in it that proves he had company.",
    sector: "F3",
    hints: [
      { text: "The window looks out. The mirror looks back. Work the glass that faces the room, not the one that faces the street." },
      { text: "The doorway the camera sees is empty — so look at the doorway the mirror keeps, over on the reflected side, away from the lamp." },
      { text: "Esper slews to sector F3. Push the magnification past ×7 and the glass gives it up.", lock: true },
    ],
    target: {
      x: 988,
      y: 314,
      r: 58,
      at: 7,
      finding: "A second person, standing in the reflected doorway, watching the room. He was not alone.",
    },
    shapes: apartmentNine(),
  },
  {
    id: "hotel-desk",
    label: "Hotel lobby · the tag",
    brief:
      "A case was left at the desk and collected by nobody. The off-world manifest is indexed by case number, so the number stencilled on its luggage tag is the whole ballgame. Read it off the frame.",
    sector: "G6",
    hints: [
      { text: "Nothing on the counter is his. He put it down on the floor, where a foot could still reach it while he talked." },
      { text: "Check what the lamp is lit against — there is one pool of light on the floor, and something hanging off a handle into it. Room numbers on the rack are not case numbers." },
      { text: "Esper slews to sector G6. Past ×9 the stencil separates from the grain.", lock: true },
    ],
    target: {
      x: 914,
      y: 548,
      r: 58,
      at: 9,
      finding: "The luggage tag reads N6-4041 — the case number the off-world manifest is indexed by.",
    },
    shapes: hotelDesk(),
  },
  {
    id: "roof-door",
    label: "Rooftop · the doorway",
    brief:
      "Our informant says someone came off this roof in a hurry and left something behind as a message. The open deck was photographed an hour ago and held nothing. Find the object that was left.",
    sector: "E4",
    hints: [
      { text: "Everything standing in the open was already photographed and cleared. What is left is whatever the light never reached." },
      { text: "The puddle shows you a person — that one is ours, reflected in from off-camera. The doorway keeps its own dark, and the top step inside it is not empty." },
      { text: "Esper slews to sector E4. It needs past ×11 before the folds separate.", lock: true },
    ],
    target: {
      x: 603,
      y: 482,
      r: 58,
      at: 11,
      finding: "A folded paper unicorn, set on the top step inside the door. Somebody knows what you dream about.",
    },
    shapes: roofDoor(),
  },
] as const;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * How much of a shape has arrived at this magnification. Detail with an `at`
 * threshold fades in across a band above it rather than popping, and stays
 * partly held back while the deck is still moving — the picture settles when
 * the operator does.
 */
export function reveal(at: number | undefined, zoom: number, resolve: number) {
  if (!at || at <= 1) return 1;
  const band = (zoom - at * 0.78) / (at * 0.5);
  const gate = band <= 0 ? 0 : band >= 1 ? 1 : band;
  return gate * (0.32 + 0.68 * resolve);
}

function paintOf(paint: Paint, alpha: number) {
  if (paint.c === "accent") return accentAlpha(alpha);
  if (paint.c === "ink") return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(255, 255, 255, ${alpha})`;
}

function path(context: CanvasRenderingContext2D, shape: Shape) {
  context.beginPath();
  switch (shape.t) {
    case "rect":
      context.rect(shape.x, shape.y, shape.w, shape.h);
      break;
    case "ellipse":
      context.ellipse(shape.x, shape.y, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      break;
    case "line":
      context.moveTo(shape.x1, shape.y1);
      context.lineTo(shape.x2, shape.y2);
      break;
    case "poly": {
      const pts = shape.pts;
      context.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) context.lineTo(pts[i], pts[i + 1]);
      if (!shape.open) context.closePath();
      break;
    }
    default:
      break;
  }
}

/**
 * Draw one case into an already-transformed context. `scale` is scene units to
 * device pixels, used to hold stroke weights and text hinting at a constant
 * screen size no matter how far in the deck has pushed.
 */
export function drawScene(
  context: CanvasRenderingContext2D,
  shapes: readonly Shape[],
  zoom: number,
  resolve: number,
  scale: number
) {
  for (const shape of shapes) {
    const gate = reveal(shape.at, zoom, resolve);
    if (gate <= 0.004) continue;

    if (shape.t === "glow") {
      const gradient = context.createRadialGradient(shape.x, shape.y, 0, shape.x, shape.y, shape.r);
      const paint = shape.fill ?? A(0.3);
      gradient.addColorStop(0, paintOf(paint, paint.a * gate));
      gradient.addColorStop(1, paintOf(paint, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      context.fill();
      continue;
    }

    if (shape.t === "text") {
      const paint = shape.fill ?? A(0.8);
      context.fillStyle = paintOf(paint, paint.a * gate);
      context.font = `${shape.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = shape.align ?? "left";
      context.fillText(shape.text, shape.x, shape.y);
      continue;
    }

    if (shape.fill) {
      context.fillStyle = paintOf(shape.fill, shape.fill.a * gate);
      path(context, shape);
      context.fill();
    }
    if (shape.stroke) {
      context.strokeStyle = paintOf(shape.stroke, shape.stroke.a * gate);
      context.lineWidth = (shape.lw ?? 1) / scale;
      path(context, shape);
      context.stroke();
    }
  }
}

/**
 * A 128px tile of fixed film grain, built once. Tiling this is cheap where a
 * per-pixel pass every frame would not be, and because it is locked to the
 * image rather than the screen it drifts with the pan like grain on a print.
 */
export function buildGrainTile(size = 128): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const context = tile.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(size, size);
  let seed = 20_190_101;
  for (let i = 0; i < size * size; i += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    const value = seed / 4_294_967_296;
    const level = value < 0.5 ? 0 : 255;
    image.data[i * 4] = level;
    image.data[i * 4 + 1] = level;
    image.data[i * 4 + 2] = level;
    image.data[i * 4 + 3] = Math.floor(Math.abs(value - 0.5) * 210);
  }
  context.putImageData(image, 0, 0);
  return tile;
}
