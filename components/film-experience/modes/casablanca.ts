import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

const markers = [
  "19:42 departures",
  "split-flap board",
  "searchlight tower",
  "champagne toast",
  "Lisbon route",
  "tarmac couple",
] as const;

const PLANE_SRC = "/posters/open/casablanca-plane.webp";
let plane: HTMLImageElement | null = null;

function planeImage() {
  if (!plane && typeof Image !== "undefined") {
    plane = new Image();
    plane.src = PLANE_SRC;
  }
  return plane;
}

// Parametric flight path: a long left-to-right crossing with two layered
// sine weaves so the aircraft drifts up/down and side-to-side in speed.
// Exported so tests can assert the crossing without sampling the canvas.
export function planePosition(rawTime: number, width: number, height: number) {
  // Phase offset keeps the aircraft on screen for static (time 0) frames.
  const time = rawTime + 9;
  const span = width + 520;
  const x = wrap(time * 52 + Math.sin(time * 0.35) * 26, span) - 260;
  const y =
    height * 0.21 +
    Math.sin(time * 0.44) * height * 0.05 +
    Math.sin(time * 0.17 + 2.1) * height * 0.08;
  return { x, y };
}

function drawPlane(frame: FilmFrame) {
  const { context, width, height, time, accentBright } = frame;
  const image = planeImage();
  if (!image || !image.complete || image.naturalWidth === 0) return;

  const planeWidth = Math.min(width * 0.15, 200);
  const planeHeight = (image.naturalHeight / image.naturalWidth) * planeWidth;
  const now = planePosition(time, width, height);

  context.save();
  context.lineCap = "round";
  for (let step = 24; step >= 1; step -= 1) {
    const past = planePosition(time - step * 0.16, width, height);
    const next = planePosition(time - (step - 1) * 0.16, width, height);
    if (Math.abs(past.x - next.x) > width / 2) continue;
    const fade = 1 - step / 26;
    context.strokeStyle = withAlpha(accentBright, 0.09 * fade);
    context.lineWidth = Math.max(1, 4.5 * fade);
    context.beginPath();
    context.moveTo(past.x - planeWidth * 0.46, past.y + planeHeight * 0.06);
    context.lineTo(next.x - planeWidth * 0.46, next.y + planeHeight * 0.06);
    context.stroke();
  }

  const ahead = planePosition(time + 0.3, width, height);
  const bank =
    Math.abs(ahead.x - now.x) > width / 2
      ? 0
      : Math.atan2(ahead.y - now.y, Math.max(ahead.x - now.x, 8)) * 0.8;
  context.translate(now.x, now.y);
  context.rotate(bank);
  context.globalAlpha = 0.8;
  context.drawImage(image, -planeWidth / 2, -planeHeight / 2, planeWidth, planeHeight);
  context.restore();
}

// Two backlit silhouettes on the tarmac — coats, one fedora, one suitcase —
// swaying gently side to side while the fog rolls past.
function drawFigure(
  frame: FilmFrame,
  x: number,
  footY: number,
  scale: number,
  sway: number,
  options: { fedora?: boolean; suitcase?: boolean; alpha: number }
) {
  const { context, accentBright } = frame;
  context.save();
  context.translate(x, footY);
  context.rotate(sway);
  context.scale(scale, scale);
  context.fillStyle = withAlpha(accentBright, options.alpha);

  context.beginPath();
  context.moveTo(-12, 0);
  context.quadraticCurveTo(-15, -40, -9, -64);
  context.quadraticCurveTo(-11, -72, -5, -76);
  context.lineTo(5, -76);
  context.quadraticCurveTo(11, -72, 9, -64);
  context.quadraticCurveTo(15, -40, 12, 0);
  context.closePath();
  context.fill();

  context.beginPath();
  context.arc(0, -84, 7.5, 0, Math.PI * 2);
  context.fill();

  if (options.fedora) {
    context.beginPath();
    context.ellipse(0, -90, 11, 2.4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-6, -97, 12, 7);
  }
  if (options.suitcase) {
    context.fillRect(14, -20, 17, 18);
    context.fillRect(19.5, -24, 6, 4);
  }
  context.restore();
}

const drawScene = (frame: FilmFrame) => {
  const { context, width, height, time, accent, accentBright } = frame;
  context.save();

  const fog = context.createLinearGradient(0, 0, width, height);
  fog.addColorStop(0, withAlpha(accent, 0.025));
  fog.addColorStop(0.5, withAlpha(accentBright, 0.09));
  fog.addColorStop(1, withAlpha(accent, 0.02));
  context.fillStyle = fog;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 64; index += 1) {
    const radius = 30 + hash(index, 3) * 130;
    const x = wrap(hash(index, 5) * width + time * (2 + hash(index, 6) * 5), width + radius * 2) - radius;
    const y = hash(index, 8) * height;
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, withAlpha(accentBright, 0.035));
    cloud.addColorStop(1, withAlpha(accentBright, 0));
    context.fillStyle = cloud;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  context.fillStyle = withAlpha(accentBright, 0.075);
  context.beginPath();
  context.moveTo(width * 0.04, height);
  context.lineTo(width * 0.28, 0);
  context.lineTo(width * 0.38, 0);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(width * 0.96, height);
  context.lineTo(width * 0.64, 0);
  context.lineTo(width * 0.74, 0);
  context.closePath();
  context.fill();

  drawPlane(frame);

  const coupleX = width * 0.15;
  const coupleY = height * 0.87;
  const coupleScale = Math.min(width, height) / 900 + 0.42;
  drawFigure(
    frame,
    coupleX,
    coupleY,
    coupleScale,
    Math.sin(time * 0.55) * 0.028,
    { fedora: true, alpha: 0.32 }
  );
  drawFigure(
    frame,
    coupleX + 34 * coupleScale + Math.sin(time * 0.55 + 0.8) * 3,
    coupleY,
    coupleScale * 0.92,
    Math.sin(time * 0.55 + 1.9) * 0.032,
    { suitcase: true, alpha: 0.28 }
  );

  drawFilmLabel(frame, "DEPARTURES 19:42", 24, 34, 0.45);

  // The airfield searchlight tower sweeping its beam from the lower left.
  const towerX = width * 0.055;
  const towerY = height - 26;
  context.fillStyle = withAlpha(accentBright, 0.4);
  context.fillRect(towerX - 5, towerY - 26, 10, 26);
  context.fillRect(towerX - 9, towerY - 32, 18, 6);
  context.save();
  context.translate(towerX, towerY - 34);
  context.rotate(-0.95 + Math.sin(time * 0.32) * 0.6);
  const beam = context.createLinearGradient(0, 0, 0, -height * 0.9);
  beam.addColorStop(0, withAlpha(accentBright, 0.22));
  beam.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = beam;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-height * 0.11, -height * 0.9);
  context.lineTo(height * 0.11, -height * 0.9);
  context.closePath();
  context.fill();
  context.restore();

  // "Here's looking at you": two coupes tilted together, bubbles rising.
  const toastX = width * 0.27;
  const toastY = height * 0.9;
  ([[-1, -16], [1, 16]] as const).forEach(([lean, offset]) => {
    context.save();
    context.translate(toastX + offset, toastY);
    context.rotate(lean * (0.12 + Math.sin(time * 0.7) * 0.02));
    context.strokeStyle = withAlpha(accentBright, 0.4);
    context.beginPath();
    context.moveTo(-11, -26);
    context.quadraticCurveTo(0, -17, 11, -26);
    context.lineTo(9.5, -31);
    context.lineTo(-9.5, -31);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(0, -20);
    context.lineTo(0, 2);
    context.moveTo(-7, 3);
    context.lineTo(7, 3);
    context.stroke();
    context.restore();
  });
  context.fillStyle = withAlpha(accentBright, 0.3);
  for (let bubble = 0; bubble < 10; bubble += 1) {
    const rise = wrap(time * (0.22 + hash(bubble) * 0.3) + hash(bubble, 2), 1);
    context.beginPath();
    context.arc(
      toastX + Math.sin(bubble * 9 + time) * 18,
      toastY - 34 - rise * 90,
      1 + hash(bubble, 3),
      0,
      Math.PI * 2
    );
    context.fill();
  }

  // The split-flap departures board clacking its way to LISBON.
  const flapWord = "LISBON";
  const flapCell = 22;
  const boardX = width - 190;
  const boardY = height - 116;
  context.font = "600 13px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  for (let slot = 0; slot < flapWord.length; slot += 1) {
    const settle = wrap(time * 0.5 - slot * 0.24, 4.2);
    const settled = settle > 1;
    const glyph = settled
      ? flapWord[slot]
      : String.fromCharCode(65 + Math.floor(hash(slot + Math.floor(time * 13), 3) * 26));
    context.fillStyle = withAlpha(accentBright, 0.07);
    context.fillRect(boardX + slot * flapCell + 1.5, boardY - 12, flapCell - 3, 25);
    context.strokeStyle = withAlpha(accentBright, 0.3);
    context.strokeRect(boardX + slot * flapCell + 1.5, boardY - 12, flapCell - 3, 25);
    context.strokeStyle = withAlpha(accentBright, 0.16);
    context.beginPath();
    context.moveTo(boardX + slot * flapCell + 1.5, boardY);
    context.lineTo(boardX + slot * flapCell + flapCell - 1.5, boardY);
    context.stroke();
    context.fillStyle = withAlpha(accentBright, settled ? 0.6 : 0.3);
    context.fillText(glyph, boardX + slot * flapCell + flapCell / 2, boardY + 5);
  }
  context.textAlign = "left";
  drawFilmLabel(frame, "ONE WAY / 19:42", boardX + 2, boardY + 32, 0.34);

  context.restore();
};

// The 35mm print pass: the scene renders to an offscreen frame first, then
// lands on the page with gate flicker, halation bloom around bright shapes,
// and a projector light leak breathing in the top corner. The edge vignette
// lives in globals.css (html[data-film-mode="casablanca"] body::after) since
// the screen-blended canvas cannot darken the page.
let printFrame: HTMLCanvasElement | null = null;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, dpr, time } = frame;
  if (!printFrame && typeof document !== "undefined") {
    printFrame = document.createElement("canvas");
  }
  const off = printFrame?.getContext("2d");
  if (!printFrame || !off) {
    drawScene(frame);
    return;
  }

  const frameWidth = Math.max(1, Math.round(width * dpr));
  const frameHeight = Math.max(1, Math.round(height * dpr));
  if (printFrame.width !== frameWidth || printFrame.height !== frameHeight) {
    printFrame.width = frameWidth;
    printFrame.height = frameHeight;
  }
  off.setTransform(dpr, 0, 0, dpr, 0, 0);
  off.clearRect(0, 0, width, height);
  drawScene({ ...frame, context: off });

  // Gate flicker: mostly steady, shivering slightly, with occasional dips.
  const beat = Math.floor(time * 8);
  const dip = hash(beat, 53) > 0.92 ? 0.82 : 1;
  const flicker = frame.staticFrame ? 1 : dip * (0.94 + Math.sin(time * 29) * 0.06);

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = flicker;
  context.drawImage(printFrame, 0, 0);
  // Halation: bright areas bloom past their edges like projected film.
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.32 * flicker;
  context.filter = "blur(12px)";
  context.drawImage(printFrame, 0, 0);
  context.filter = "none";
  context.restore();

  const leak = context.createRadialGradient(
    width * 0.92, height * 0.05, 0,
    width * 0.92, height * 0.05, width * 0.5
  );
  const leakStrength = 0.05 + 0.03 * Math.sin(time * 0.13);
  leak.addColorStop(0, withAlpha(frame.accentBright, leakStrength));
  leak.addColorStop(1, withAlpha(frame.accentBright, 0));
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = leak;
  context.fillRect(0, 0, width, height);
  context.restore();
});
