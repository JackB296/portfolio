import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

const markers = [
  "ground pulse",
  "twin moons",
  "water allocation",
  "ornithopter",
  "spice blow",
  "spice glints",
] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, pointerX, pointerY, scrollVelocity } = frame;
  context.save();

  const haze = context.createLinearGradient(0, 0, 0, height);
  haze.addColorStop(0, withAlpha(frame.accentBright, 0.04));
  haze.addColorStop(0.65, withAlpha(frame.accent, 0.085));
  haze.addColorStop(1, withAlpha(frame.accentDim, 0.13));
  context.fillStyle = haze;
  context.fillRect(0, 0, width, height);

  for (let layer = 0; layer < 3; layer += 1) {
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width + 40; x += 40) {
      const y = height * (0.6 + layer * 0.1) + Math.sin(x * 0.006 + layer * 1.7 + time * 0.04) * (45 - layer * 9);
      context.lineTo(x, y);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = withAlpha(layer === 0 ? frame.accent : frame.accentDim, 0.1 + layer * 0.055);
    context.fill();
  }

  const wind = 18 + Math.min(Math.abs(scrollVelocity), 70);
  context.strokeStyle = withAlpha(frame.accentBright, 0.26);
  context.lineWidth = 1;
  for (let index = 0; index < 150; index += 1) {
    const speed = 12 + hash(index, 2) * wind;
    const x = wrap(hash(index, 4) * width + time * speed, width + 100) - 50;
    const y = hash(index, 8) * height;
    const length = 2 + hash(index, 9) * 14;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y - length * 0.18);
    context.stroke();
  }

  const pulse = 24 + wrap(time * 38, 110);
  context.strokeStyle = withAlpha(frame.accentBright, 0.34 * (1 - (pulse - 24) / 110));
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(pointerX, pointerY, pulse * 1.5, pulse * 0.42, 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = withAlpha(frame.accentBright, 0.32);
  context.beginPath();
  context.arc(width - 104, 78, 18, 0, Math.PI * 2);
  context.arc(width - 62, 112, 7, 0, Math.PI * 2);
  context.fill();

  drawFilmLabel(frame, "N 24° / WATER 03", 24, 34, 0.4);
  drawFilmLabel(frame, "GROUND SIGNAL", pointerX, Math.max(24, pointerY - pulse * 0.55), 0.28, "center");

  // An ornithopter crosses the sky, wings at dragonfly flutter.
  const thopterX = wrap(time * 60, width + 400) - 200;
  const thopterY = height * 0.24 + Math.sin(time * 0.9) * 10;
  context.save();
  context.translate(thopterX, thopterY);
  context.rotate(Math.sin(time * 0.5) * 0.06);
  context.fillStyle = withAlpha(frame.accentBright, 0.4);
  context.beginPath();
  context.ellipse(0, 0, 17, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(15, -2);
  context.lineTo(27, 0);
  context.lineTo(15, 2);
  context.closePath();
  context.fill();
  for (const side of [-1, 1]) {
    for (let wing = 0; wing < 3; wing += 1) {
      const flap = Math.sin(time * 26 + wing * 1.2) * 0.5;
      context.save();
      context.translate(-5 + wing * 6, -1);
      context.rotate(side * (0.5 + flap));
      context.strokeStyle = withAlpha(frame.accentBright, 0.26 - wing * 0.05);
      context.beginPath();
      context.ellipse(0, side * -13, 2.6, 13, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }
  context.restore();

  // A spice blow erupting from a dune crest, glitter drifting downwind.
  const blowX = width * 0.3;
  const blowY = height * 0.63;
  for (let grain = 0; grain < 34; grain += 1) {
    const progress = wrap(hash(grain) + time * (0.14 + hash(grain, 2) * 0.1), 1);
    const x = blowX + progress * (14 + hash(grain, 3) * 60) + progress * progress * 46;
    const y = blowY - Math.sin(progress * Math.PI) * height * 0.3 * (0.4 + hash(grain, 4) * 0.6);
    const sparkle = 0.5 + 0.5 * Math.sin(time * 7 + grain * 3);
    context.fillStyle = withAlpha(frame.accentBright, (1 - progress) * 0.5 * sparkle);
    context.fillRect(x, y, 1.6, 1.6);
  }

  context.restore();
});
