/**
 * Keepsake vector art for "Up and down".
 *
 * Every item is drawn from scratch with canvas paths — original shapes, no
 * traced or imported imagery — so each thing you dive for is recognisable at a
 * glance rather than being another anonymous square. All colour comes from the
 * live grade via `accentAlpha` / `getLiveThemePalette`; nothing here hardcodes
 * a hex.
 *
 * Each kind also carries the numbers that make the choosing interesting: what
 * it is worth, and how much of your back it takes up.
 */

import { accentAlpha } from "@/lib/theme";

export type KeepsakeKind =
  | "photo"
  | "stone"
  | "watch"
  | "letter"
  | "radio"
  | "tin"
  | "book";

export type KeepsakeSpec = Readonly<{
  kind: KeepsakeKind;
  /** Shown in the HUD and announced to screen readers. */
  label: string;
  /** Points banked when it reaches the landing. */
  value: number;
  /** Load units it costs out of the carrying capacity. */
  weight: number;
}>;

export const KEEPSAKES: Readonly<Record<KeepsakeKind, KeepsakeSpec>> = {
  letter: { kind: "letter", label: "a sealed letter", value: 70, weight: 1 },
  book: { kind: "book", label: "a bound ledger", value: 80, weight: 1 },
  watch: { kind: "watch", label: "a wristwatch", value: 130, weight: 1 },
  photo: { kind: "photo", label: "a framed photograph", value: 100, weight: 2 },
  tin: { kind: "tin", label: "a cash tin", value: 120, weight: 2 },
  radio: { kind: "radio", label: "a transistor radio", value: 170, weight: 3 },
  stone: { kind: "stone", label: "the scholar's stone", value: 260, weight: 4 },
};

type DrawArgs = Readonly<{
  ctx: CanvasRenderingContext2D;
  /** Centre of the icon, in device pixels. */
  x: number;
  y: number;
  /** Nominal icon height in pixels; every shape is written against 1.0 = 20px. */
  size: number;
  /** 0-1 — drives both stroke and fill opacity so items can pulse or fade. */
  alpha: number;
  /** Bright accent, used for the one highlight each item gets. */
  bright: string;
}>;

/** A rounded rectangle without relying on the (patchily supported) roundRect. */
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x, y + radius);
  ctx.closePath();
}

/** A framed photograph: frame, mount, a hill and a small sun behind glass. */
function drawPhoto({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  const w = s * 0.95;
  const h = s;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.fillStyle = accentAlpha(alpha * 0.16);
  box(ctx, x - w / 2, y - h / 2, w, h, s * 0.08);
  ctx.fill();
  ctx.stroke();
  // The mount inside the frame.
  const iw = w * 0.66;
  const ih = h * 0.62;
  ctx.lineWidth = Math.max(0.8, s * 0.05);
  ctx.strokeRect(x - iw / 2, y - ih / 2, iw, ih);
  // A hill and a sun — a picture, not a pattern.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - iw / 2, y - ih / 2, iw, ih);
  ctx.clip();
  ctx.fillStyle = accentAlpha(alpha * 0.7);
  ctx.beginPath();
  ctx.moveTo(x - iw / 2, y + ih / 2);
  ctx.lineTo(x - iw * 0.06, y - ih * 0.1);
  ctx.lineTo(x + iw / 2, y + ih / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bright;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x + iw * 0.24, y - ih * 0.22, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** A viewing stone on its carved stand: a heavy, valuable, awkward thing. */
function drawStone({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.fillStyle = accentAlpha(alpha * 0.3);
  // The stone: a lumpy, deliberately irregular silhouette.
  const peaks: readonly [number, number][] = [
    [-0.5, 0.18],
    [-0.4, -0.1],
    [-0.16, -0.34],
    [-0.02, -0.16],
    [0.16, -0.44],
    [0.34, -0.06],
    [0.5, 0.18],
  ];
  ctx.beginPath();
  peaks.forEach(([px, py], index) => {
    const cx = x + px * s;
    const cy = y + py * s;
    if (index === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A vein of quartz across it.
  ctx.strokeStyle = bright;
  ctx.globalAlpha = alpha * 0.9;
  ctx.lineWidth = Math.max(0.8, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y + s * 0.02);
  ctx.lineTo(x - s * 0.04, y - s * 0.12);
  ctx.lineTo(x + s * 0.22, y - s * 0.02);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // The stand.
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.46, y + s * 0.2);
  ctx.lineTo(x + s * 0.46, y + s * 0.2);
  ctx.lineTo(x + s * 0.34, y + s * 0.36);
  ctx.lineTo(x - s * 0.34, y + s * 0.36);
  ctx.closePath();
  ctx.stroke();
}

/** A wristwatch: case, hands, crown, and the two ends of the strap. */
function drawWatch({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  // Strap.
  ctx.beginPath();
  ctx.moveTo(x - s * 0.14, y - s * 0.3);
  ctx.lineTo(x - s * 0.1, y - s * 0.5);
  ctx.lineTo(x + s * 0.1, y - s * 0.5);
  ctx.lineTo(x + s * 0.14, y - s * 0.3);
  ctx.moveTo(x - s * 0.14, y + s * 0.3);
  ctx.lineTo(x - s * 0.1, y + s * 0.5);
  ctx.lineTo(x + s * 0.1, y + s * 0.5);
  ctx.lineTo(x + s * 0.14, y + s * 0.3);
  ctx.stroke();
  // Case.
  ctx.fillStyle = accentAlpha(alpha * 0.2);
  ctx.beginPath();
  ctx.arc(x, y, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Crown.
  ctx.beginPath();
  ctx.moveTo(x + s * 0.32, y);
  ctx.lineTo(x + s * 0.42, y);
  ctx.stroke();
  // Hands, fixed at a quarter past ten so the shape reads as a watch.
  ctx.strokeStyle = bright;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(0.8, s * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - s * 0.15, y - s * 0.14);
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * 0.19, y - s * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A sealed letter: envelope, flap, wax seal. */
function drawLetter({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  const w = s * 1.1;
  const h = s * 0.74;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.fillStyle = accentAlpha(alpha * 0.16);
  box(ctx, x - w / 2, y - h / 2, w, h, s * 0.06);
  ctx.fill();
  ctx.stroke();
  // The flap.
  ctx.lineWidth = Math.max(0.8, s * 0.055);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y + h * 0.12);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.stroke();
  // Wax seal.
  ctx.fillStyle = bright;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y + h * 0.1, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A transistor radio: body, speaker grill, tuning dial, antenna. */
function drawRadio({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  const w = s * 1.15;
  const h = s * 0.8;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  // Antenna, drawn first so the body overlaps its foot.
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y - h / 2);
  ctx.lineTo(x + w * 0.52, y - h * 1.05);
  ctx.stroke();
  ctx.fillStyle = accentAlpha(alpha * 0.18);
  box(ctx, x - w / 2, y - h / 2, w, h, s * 0.09);
  ctx.fill();
  ctx.stroke();
  // Speaker grill: a small block of holes.
  ctx.fillStyle = accentAlpha(alpha * 0.85);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.beginPath();
      ctx.arc(
        x - w * 0.28 + col * s * 0.13,
        y - h * 0.14 + row * s * 0.13,
        s * 0.035,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  // Tuning dial with a needle.
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.lineWidth = Math.max(0.8, s * 0.055);
  ctx.beginPath();
  ctx.arc(x + w * 0.24, y, s * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = bright;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.24, y);
  ctx.lineTo(x + w * 0.24 + s * 0.1, y - s * 0.1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A cash tin: lidded box, clasp, carrying handle. */
function drawTin({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  const w = s * 1.05;
  const h = s * 0.72;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  // Handle.
  ctx.beginPath();
  ctx.arc(x, y - h * 0.5, s * 0.22, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = accentAlpha(alpha * 0.18);
  box(ctx, x - w / 2, y - h / 2, w, h, s * 0.05);
  ctx.fill();
  ctx.stroke();
  // Lid seam.
  ctx.lineWidth = Math.max(0.8, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * 0.16);
  ctx.lineTo(x + w / 2, y - h * 0.16);
  ctx.stroke();
  // Clasp.
  ctx.fillStyle = bright;
  ctx.globalAlpha = alpha;
  ctx.fillRect(x - s * 0.07, y - h * 0.24, s * 0.14, s * 0.2);
  ctx.globalAlpha = 1;
}

/** A bound ledger: cover, spine band, page edges. */
function drawBook({ ctx, x, y, size: s, alpha, bright }: DrawArgs) {
  const w = s * 0.82;
  const h = s * 1.02;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = accentAlpha(alpha);
  ctx.fillStyle = accentAlpha(alpha * 0.16);
  box(ctx, x - w / 2, y - h / 2, w, h, s * 0.05);
  ctx.fill();
  ctx.stroke();
  // Spine band.
  ctx.fillStyle = accentAlpha(alpha * 0.55);
  ctx.fillRect(x - w / 2, y - h / 2, w * 0.22, h);
  // Page edges on the fore-edge.
  ctx.strokeStyle = bright;
  ctx.globalAlpha = alpha * 0.85;
  ctx.lineWidth = Math.max(0.7, s * 0.04);
  for (let i = 0; i < 3; i += 1) {
    const py = y - h * 0.22 + i * h * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, py);
    ctx.lineTo(x + w * 0.38, py);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const PAINTERS: Readonly<Record<KeepsakeKind, (args: DrawArgs) => void>> = {
  photo: drawPhoto,
  stone: drawStone,
  watch: drawWatch,
  letter: drawLetter,
  radio: drawRadio,
  tin: drawTin,
  book: drawBook,
};

/** Paint one keepsake centred on (x, y). Restores the context state it touches. */
export function drawKeepsake(args: DrawArgs & { kind: KeepsakeKind }) {
  const { ctx, kind } = args;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  PAINTERS[kind](args);
  ctx.restore();
}
