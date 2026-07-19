import { createSectionTracker, drawFilmLabel, hash, makeStatefulFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

// Corkboard pins for the evidence map, as viewport ratios.
const PINS: ReadonlyArray<readonly [number, number]> = [
  [0.05, 0.16],
  [0.15, 0.1],
  [0.23, 0.2],
  [0.1, 0.3],
  [0.19, 0.36],
  [0.28, 0.3],
];
const STRINGS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
  [4, 5],
  [2, 5],
];

// Deterministic Gotham skyline: [left ratio, width ratio, height ratio]
const BUILDINGS: ReadonlyArray<readonly [number, number, number]> = Array.from(
  { length: 14 },
  (_, index) => [
    index / 14 + hash(index, 61) * 0.02,
    0.045 + hash(index, 62) * 0.045,
    0.08 + hash(index, 63) * 0.16,
  ] as const
);

export default makeStatefulFilmVisual(() => {
  // The section tracker's measurement cache is per activation (see shared.ts).
  const sections = createSectionTracker();

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, pointerX, pointerY, accent, accentBright } = frame;
  context.save();

  const horizon = height * 0.99;

  // Sky glow, strongest at the rooftops.
  const glow = context.createLinearGradient(0, height * 0.3, 0, horizon);
  glow.addColorStop(0, withAlpha(accent, 0));
  glow.addColorStop(0.75, withAlpha(accent, 0.1));
  glow.addColorStop(1, withAlpha(accentBright, 0.16));
  context.fillStyle = glow;
  context.fillRect(0, height * 0.3, width, horizon - height * 0.3);

  // The bat-signal: a beam from behind the skyline projecting the symbol
  // onto the clouds, drifting slowly as the searchlight is aimed.
  const sweep = Math.sin(time * 0.2) * 0.32 - 0.18;
  const sourceX = width * 0.68;
  const sourceY = horizon;
  const signalDistance = Math.min(width, height) * 0.62;
  const signalX = sourceX + Math.sin(sweep) * signalDistance;
  const signalY = sourceY - Math.cos(sweep) * signalDistance;
  const reach = signalDistance * 1.05;
  const beamHalf = 0.075;
  context.save();
  context.translate(sourceX, sourceY);
  context.rotate(sweep);
  const beam = context.createLinearGradient(0, 0, 0, -reach);
  beam.addColorStop(0, withAlpha(accentBright, 0.2));
  beam.addColorStop(1, withAlpha(accentBright, 0.05));
  context.fillStyle = beam;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-reach * Math.tan(beamHalf), -reach);
  context.lineTo(reach * Math.tan(beamHalf), -reach);
  context.closePath();
  context.fill();
  context.restore();

  // The lit disc on the clouds, with the bat cut out of the light.
  const signalScale = Math.min(width, height) / 900;
  const discRadius = 96 * signalScale;
  const shimmer = 0.85 + Math.sin(time * 1.7) * 0.08;
  const disc = context.createRadialGradient(
    signalX, signalY, discRadius * 0.1,
    signalX, signalY, discRadius
  );
  disc.addColorStop(0, withAlpha(accentBright, 0.42 * shimmer));
  disc.addColorStop(0.75, withAlpha(accentBright, 0.24 * shimmer));
  disc.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = disc;
  context.beginPath();
  context.ellipse(signalX, signalY, discRadius, discRadius * 0.72, sweep * 0.4, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.translate(signalX, signalY);
  context.rotate(sweep * 0.4);
  context.scale(signalScale * 1.15, signalScale * 1.15);
  context.fillStyle = "rgba(0, 0, 0, 0.92)";
  context.beginPath();
  context.moveTo(-50, 0);
  context.quadraticCurveTo(-32, -10, -14, -10);
  context.lineTo(-10, -10);
  context.lineTo(-7, -19);
  context.lineTo(-4, -10);
  context.quadraticCurveTo(0, -8, 4, -10);
  context.lineTo(7, -19);
  context.lineTo(10, -10);
  context.lineTo(14, -10);
  context.quadraticCurveTo(32, -10, 50, 0);
  context.quadraticCurveTo(30, 3, 26, 12);
  context.quadraticCurveTo(18, 5, 10, 9);
  context.quadraticCurveTo(4, 18, 0, 21);
  context.quadraticCurveTo(-4, 18, -10, 9);
  context.quadraticCurveTo(-18, 5, -26, 12);
  context.quadraticCurveTo(-30, 3, -50, 0);
  context.closePath();
  context.fill();
  context.restore();

  // Drifting fog banks catch the beacon.
  for (let index = 0; index < 26; index += 1) {
    const radius = 60 + hash(index, 64) * 150;
    const x = ((hash(index, 65) * width + time * (6 + hash(index, 66) * 8)) % (width + radius * 2)) - radius;
    const y = height * (0.45 + hash(index, 67) * 0.45);
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, withAlpha(accent, 0.045));
    cloud.addColorStop(1, withAlpha(accent, 0));
    context.fillStyle = cloud;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Cut the skyline out of the glow so the towers stay ink-dark.
  context.globalCompositeOperation = "destination-out";
  BUILDINGS.forEach(([leftRatio, widthRatio, heightRatio]) => {
    const buildingHeight = height * heightRatio;
    context.fillStyle = "rgba(0, 0, 0, 0.94)";
    context.fillRect(
      leftRatio * width,
      horizon - buildingHeight,
      widthRatio * width,
      buildingHeight + 2
    );
  });
  context.globalCompositeOperation = "source-over";

  // A few late-night windows inside the dark towers.
  BUILDINGS.forEach(([leftRatio, widthRatio, heightRatio], index) => {
    if (hash(index, 68) < 0.45) return;
    const flicker = Math.floor(time * 0.2 + index) % 5 === 0 ? 0.1 : 0.3;
    context.fillStyle = withAlpha(accentBright, flicker);
    const x = (leftRatio + widthRatio * (0.25 + hash(index, 69) * 0.4)) * width;
    const y = horizon - height * heightRatio * (0.35 + hash(index, 70) * 0.4);
    context.fillRect(x, y, 3.5, 5);
  });

  // The investigator's light stays on the pointer.
  const light = context.createRadialGradient(pointerX, pointerY, 4, pointerX, pointerY, 150);
  light.addColorStop(0, withAlpha(accentBright, 0.2));
  light.addColorStop(0.35, withAlpha(accent, 0.08));
  light.addColorStop(1, withAlpha(accent, 0));
  context.fillStyle = light;
  context.fillRect(pointerX - 150, pointerY - 150, 300, 300);

  // Cipher marks scrawled faintly in the sky.
  context.fillStyle = withAlpha(accentBright, 0.22);
  context.font = "18px ui-monospace, monospace";
  for (let index = 0; index < 9; index += 1) {
    const symbol = ["?", "□", "×", "+", "△"][index % 5];
    const x = width * (0.06 + hash(index, 71) * 0.88);
    const y = height * (0.12 + hash(index, 72) * 0.4);
    const pulse = 0.55 + 0.45 * Math.sin(time * 0.6 + index * 2.2);
    context.globalAlpha = pulse;
    context.fillText(symbol, x, y);
  }
  context.globalAlpha = 1;

  // The evidence string map: pins for the case, red string drawing taut
  // between them; the pin for the section under the reader stays lit.
  const activePin = sections.sectionAt(frame.scroll).index % PINS.length;
  const caseProgress = wrap(time * 0.3, STRINGS.length + 2);
  STRINGS.forEach(([from, to], link) => {
    const pull = Math.max(0, Math.min(1, caseProgress - link));
    if (pull === 0) return;
    const [x1, y1] = PINS[from];
    const [x2, y2] = PINS[to];
    context.strokeStyle = withAlpha(accentBright, 0.4);
    context.beginPath();
    context.moveTo(x1 * width, y1 * height);
    context.lineTo((x1 + (x2 - x1) * pull) * width, (y1 + (y2 - y1) * pull) * height);
    context.stroke();
  });
  PINS.forEach(([px, py], pin) => {
    const lit = pin === activePin;
    context.fillStyle = withAlpha(accentBright, lit ? 0.9 : 0.45);
    context.beginPath();
    context.arc(px * width, py * height, lit ? 3.5 : 2.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = withAlpha(accent, lit ? 0.6 : 0.3);
    context.strokeRect(px * width - 11, py * height - 17, 22, 10);
  });

  // The Riddler's card waits in the lower right, seal glowing.
  context.save();
  context.translate(width - 110, height - 96);
  context.rotate(-0.06 + Math.sin(time * 0.5) * 0.015);
  context.fillStyle = withAlpha(accentBright, 0.06);
  context.fillRect(-48, -31, 96, 62);
  context.strokeStyle = withAlpha(accentBright, 0.4);
  context.strokeRect(-48, -31, 96, 62);
  context.beginPath();
  context.moveTo(-48, -31);
  context.lineTo(0, 5);
  context.lineTo(48, -31);
  context.stroke();
  const sealGlow = 0.5 + 0.4 * Math.sin(time * 1.1);
  context.fillStyle = withAlpha(accent, 0.4 * sealGlow);
  context.beginPath();
  context.arc(0, 7, 9, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.65);
  context.beginPath();
  context.arc(0, 7, 9, 0, Math.PI * 2);
  context.stroke();
  context.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.fillStyle = withAlpha(accentBright, 0.9);
  context.fillText("?", 0, 11);
  context.textAlign = "left";
  context.restore();

  drawFilmLabel(frame, "CASE 2022 / CIPHER 04", 22, 30, 0.46);
  context.restore();
  };

  return { draw };
});
