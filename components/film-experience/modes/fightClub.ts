import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

export default makeFilmVisual((frame) => {
  const { context, width, height, time, accent, accentBright, accentDim } = frame;
  context.save();

  // The basement tube never holds steady: an irregular fluorescent flicker.
  const beat = Math.floor(time * 9);
  const dip = hash(beat, 97) > 0.86 ? 0.35 : 1;
  const surge = hash(beat, 98) > 0.94 ? 1.5 : 1;
  const flicker = frame.staticFrame ? 1 : dip * surge * (0.92 + Math.sin(time * 31) * 0.08);

  const grime = context.createLinearGradient(0, 0, 0, height);
  grime.addColorStop(0, withAlpha(accentBright, 0.11 * flicker));
  grime.addColorStop(0.45, withAlpha(accent, 0.045 * flicker));
  grime.addColorStop(1, withAlpha(accentDim, 0.02));
  context.fillStyle = grime;
  context.fillRect(0, 0, width, height);

  // The tube itself, humming at the top of the frame.
  const tubeLeft = width * 0.3;
  const tubeRight = width * 0.7;
  context.fillStyle = withAlpha(accentBright, 0.5 * flicker);
  context.fillRect(tubeLeft, height * 0.07, tubeRight - tubeLeft, 4);
  const tubeGlow = context.createRadialGradient(
    width / 2, height * 0.07, 4,
    width / 2, height * 0.07, width * 0.3
  );
  tubeGlow.addColorStop(0, withAlpha(accentBright, 0.16 * flicker));
  tubeGlow.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = tubeGlow;
  context.fillRect(width * 0.2, 0, width * 0.6, height * 0.5);

  // Concrete grime: diagonal scratches drifting with the scroll.
  context.strokeStyle = withAlpha(accentBright, 0.06 * flicker);
  for (let index = 0; index < 26; index += 1) {
    const x = wrap(hash(index, 91) * width + time * 2, width + 120) - 60;
    const y = hash(index, 92) * height;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 46, y + 8 + hash(index, 93) * 10);
    context.stroke();
  }

  // The credit towers: windows extinguish as the reader nears the page end,
  // and the skyline shivers right before it all goes.
  const root = typeof document === "undefined" ? null : document.documentElement;
  const travel = root ? Math.max(1, root.scrollHeight - window.innerHeight) : 1;
  const collapse = root ? Math.min(1, frame.scroll / travel) : 0;
  const shake = collapse > 0.97 && !frame.staticFrame ? Math.sin(time * 40) * 2 : 0;
  context.save();
  context.translate(shake, 0);
  for (let tower = 0; tower < 6; tower += 1) {
    const towerX = width * 0.08 + tower * width * 0.15;
    const towerWidth = width * 0.09;
    const towerHeight = height * (0.22 + hash(tower) * 0.24);
    context.strokeStyle = withAlpha(accentBright, 0.3 * flicker);
    context.strokeRect(towerX, height - towerHeight, towerWidth, towerHeight);
    for (let row = 0; row < 6; row += 1) {
      const windowY = height - towerHeight + 6 + row * (towerHeight - 12) / 6;
      const dead = row / 6 < collapse * 1.15 - tower * 0.06;
      for (let col = 0; col < 3; col += 1) {
        context.fillStyle = withAlpha(accentBright, (dead ? 0.03 : 0.3) * flicker);
        context.fillRect(
          towerX + 4 + col * (towerWidth - 8) / 3,
          windowY,
          (towerWidth - 8) / 3 - 3,
          4
        );
      }
    }
  }
  context.restore();

  // The payphone rings ahead of every reveal; nobody answers it.
  const phoneX = width - 84;
  const phoneY = height * 0.5;
  const ringing = !frame.staticFrame && wrap(time, 9) < 1.2;
  const jitter = ringing ? Math.sin(time * 55) * 1.5 : 0;
  context.save();
  context.translate(phoneX + jitter, phoneY);
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.fillStyle = withAlpha(accentBright, 0.07);
  context.beginPath();
  context.roundRect(-17, -37, 34, 62, 4);
  context.fill();
  context.stroke();
  context.fillStyle = withAlpha(accentBright, 0.5);
  context.beginPath();
  context.roundRect(-11, -32, 22, 8, 4);
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.35);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      context.strokeRect(-8 + col * 7, -17 + row * 7, 4, 4);
    }
  }
  context.strokeStyle = withAlpha(accentBright, 0.45);
  context.beginPath();
  context.moveTo(11, -26);
  context.quadraticCurveTo(25, -17, 20, 5);
  context.stroke();
  context.restore();
  if (ringing) {
    for (let pulse = 0; pulse < 2; pulse += 1) {
      const spread = wrap(time * 1.4 + pulse / 2, 1);
      context.strokeStyle = withAlpha(accentBright, 0.5 * (1 - spread));
      context.beginPath();
      context.arc(phoneX, phoneY - 40, 8 + spread * 24, -Math.PI * 0.85, -Math.PI * 0.15);
      context.stroke();
    }
  }

  drawFilmLabel(frame, "SPLICE / FRAME 01-02", 28, 32, 0.3);
  context.restore();
});
