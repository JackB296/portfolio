import { drawFilmLabel, drawSoftVignette, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

// Fixed neon palette — this mode deliberately departs from the single-accent
// rule so the cyberpunk signage reads as colorful. The cinematic layer is
// screen-blended, so everything here is drawn as light, never dark fills.
type Rgb = readonly [number, number, number];
const NEON: readonly Rgb[] = [
  [255, 62, 165], // magenta
  [62, 240, 255], // cyan
  [255, 200, 62], // amber
  [125, 255, 120], // green
  [200, 120, 255], // violet
  [255, 120, 80], // ember
];
const neon = (c: Rgb, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const pick = (seed: number) => NEON[Math.floor(hash(seed, 7) * NEON.length)];

export default makeFilmVisual((frame) => {
  const { context, width, height, time, accentBright } = frame;
  context.save();

  // Warm smog glow rising off the city (screen-blend friendly).
  const smog = context.createLinearGradient(0, height * 0.32, 0, height);
  smog.addColorStop(0, "rgba(120, 90, 160, 0)");
  smog.addColorStop(0.55, "rgba(150, 80, 120, 0.08)");
  smog.addColorStop(1, "rgba(255, 140, 80, 0.16)");
  context.fillStyle = smog;
  context.fillRect(0, height * 0.32, width, height * 0.68);

  // One tower: faint neon-tinted body + edge lines + a dense window grid.
  const drawTower = (
    x: number,
    towerWidth: number,
    topY: number,
    color: Rgb,
    depth: number,
    seed: number
  ) => {
    const style = hash(seed, 3);
    const bodyAlpha = 0.05 * depth;
    const edgeAlpha = 0.26 * depth;
    let left = x;
    let right = x + towerWidth;

    context.fillStyle = neon(color, bodyAlpha);
    context.strokeStyle = neon(color, edgeAlpha);
    context.lineWidth = 1;

    if (style < 0.34) {
      // Tapered megastructure.
      const inset = towerWidth * 0.2;
      context.beginPath();
      context.moveTo(left, height);
      context.lineTo(left + inset, topY);
      context.lineTo(right - inset, topY);
      context.lineTo(right, height);
      context.closePath();
      context.fill();
      context.stroke();
      left += inset * 0.5;
      right -= inset * 0.5;
    } else if (style < 0.7) {
      // Stepped setback tower.
      const shoulderY = topY + (height - topY) * 0.28;
      context.fillRect(left, shoulderY, towerWidth, height - shoulderY);
      context.strokeRect(left, shoulderY, towerWidth, height - shoulderY);
      const upper = towerWidth * 0.6;
      const ux = left + (towerWidth - upper) / 2;
      context.fillRect(ux, topY, upper, shoulderY - topY);
      context.strokeRect(ux, topY, upper, shoulderY - topY);
    } else {
      // Crowned slab.
      context.fillRect(left, topY, towerWidth, height - topY);
      context.strokeRect(left, topY, towerWidth, height - topY);
      context.fillStyle = neon(color, edgeAlpha);
      context.fillRect(left - 3, topY - 4, towerWidth + 6, 4);
    }

    // Window grid, a lit subset flickering.
    const cols = Math.max(3, Math.floor(towerWidth / 12));
    const gap = towerWidth / cols;
    for (let col = 0; col < cols; col += 1) {
      for (let wy = topY + 14; wy < height - 6; wy += 15) {
        const cellSeed = seed * 131 + col * 17 + Math.floor(wy);
        if (hash(cellSeed, 5) < 0.45) continue;
        const beat = Math.floor(time * (0.6 + hash(cellSeed, 6) * 1.6));
        const lit = hash(cellSeed + beat, 8) > 0.35;
        context.fillStyle = lit
          ? `rgba(255, 210, 150, ${0.28 * depth})`
          : neon(color, 0.08 * depth);
        context.fillRect(x + col * gap + gap * 0.25, wy, gap * 0.4, 5);
      }
    }

    // Rooftop antenna with a blinking beacon.
    const beacon = Math.sin(time * 2.4 + seed) > 0.4;
    context.strokeStyle = neon(color, edgeAlpha);
    context.beginPath();
    context.moveTo(left + towerWidth * 0.5, topY);
    context.lineTo(left + towerWidth * 0.5, topY - 22);
    context.stroke();
    if (beacon) {
      context.fillStyle = "rgba(255, 80, 80, 0.7)";
      context.beginPath();
      context.arc(left + towerWidth * 0.5, topY - 22, 2.6, 0, Math.PI * 2);
      context.fill();
    }
  };

  // Far dense layer.
  for (let index = 0; index < 12; index += 1) {
    const towerWidth = width * (0.06 + hash(index, 11) * 0.06);
    const x = (index / 12) * width - towerWidth * 0.15 + hash(index, 12) * 22;
    const topY = height * (0.32 + hash(index, 13) * 0.3);
    drawTower(x, towerWidth, topY, pick(index + 90), 0.55, index + 1);
  }

  // Hologram projections — huge translucent ads drifting over the skyline.
  const drawHologram = (cx: number, cy: number, scale: number, color: Rgb, phase: number) => {
    const flicker = 0.7 + 0.3 * Math.sin(time * 1.3 + phase) * Math.sin(time * 0.5 + phase);
    context.save();
    context.translate(cx + Math.sin(time * 0.2 + phase) * 22, cy);
    const beam = context.createLinearGradient(0, 240 * scale, 0, -240 * scale);
    beam.addColorStop(0, neon(color, 0.03));
    beam.addColorStop(0.5, neon(color, 0.14 * flicker));
    beam.addColorStop(1, neon(color, 0));
    context.fillStyle = beam;
    context.fillRect(-80 * scale, -240 * scale, 160 * scale, 480 * scale);
    // Scanline-sliced abstract figure.
    for (let slice = -110; slice < 130; slice += 5) {
      const s = slice / 100;
      const bodyWidth = (Math.abs(s + 0.68) < 0.16 ? 24 : 52 - Math.abs(s) * 24) * scale;
      context.fillStyle = neon(color, 0.2 * flicker * (0.6 + 0.4 * Math.sin(slice + time * 4)));
      context.fillRect(-bodyWidth, slice * scale, bodyWidth * 2, 2.6 * scale);
    }
    context.restore();
  };
  drawHologram(width * 0.26, height * 0.46, Math.min(width, height) / 560, NEON[0], 0);
  drawHologram(width * 0.8, height * 0.42, Math.min(width, height) / 660, NEON[1], 2.4);

  // Near towers carrying the big flashing signage.
  const nearTowers: Array<{ x: number; w: number; topY: number; color: Rgb }> = [];
  for (let index = 0; index < 8; index += 1) {
    const towerWidth = width * (0.09 + hash(index, 31) * 0.08);
    const x = (index / 8) * width - towerWidth * 0.1 + hash(index, 32) * 18;
    const topY = height * (0.14 + hash(index, 33) * 0.26);
    const color = pick(index + 40);
    drawTower(x, towerWidth, topY, color, 1, index + 40);
    nearTowers.push({ x, w: towerWidth, topY, color });
  }

  // Flashing neon signage down the near tower faces.
  nearTowers.forEach((tower, towerIndex) => {
    const signs = 1 + Math.floor(hash(towerIndex, 41) * 2);
    for (let sign = 0; sign < signs; sign += 1) {
      const color = pick(towerIndex * 3 + sign + 200);
      const vertical = hash(towerIndex + sign, 43) > 0.4;
      const sx = tower.x + tower.w * (0.24 + hash(towerIndex + sign, 44) * 0.5);
      const sy = tower.topY + (height - tower.topY) * (0.12 + hash(towerIndex + sign, 45) * 0.45);
      const cells = 3 + Math.floor(hash(towerIndex + sign, 46) * 4);
      const mostlyLit = hash(Math.floor(time * 3) + towerIndex + sign, 49) > 0.35;
      if (mostlyLit) {
        const span = cells * 14;
        const halo = context.createRadialGradient(
          sx + (vertical ? 5 : span / 2), sy + (vertical ? span / 2 : 5), 2,
          sx + (vertical ? 5 : span / 2), sy + (vertical ? span / 2 : 5), span
        );
        halo.addColorStop(0, neon(color, 0.22));
        halo.addColorStop(1, neon(color, 0));
        context.fillStyle = halo;
        context.fillRect(sx - span, sy - span, span * 2.2, span * 2.2);
      }
      for (let cell = 0; cell < cells; cell += 1) {
        const beat = Math.floor(time * (2 + hash(cell + towerIndex, 47) * 4)) + cell;
        const lit = hash(beat, 48) > 0.25;
        context.fillStyle = neon(color, lit ? 0.7 : 0.16);
        if (vertical) context.fillRect(sx, sy + cell * 14, 10, 10);
        else context.fillRect(sx + cell * 14, sy, 10, 10);
      }
    }
  });

  // Spinner traffic — flying cars streaking across at several depths.
  for (let index = 0; index < 8; index += 1) {
    const laneY = height * (0.1 + hash(index, 51) * 0.55);
    const depth = 0.5 + hash(index, 52) * 0.5;
    const direction = hash(index, 53) > 0.5 ? 1 : -1;
    const speed = (55 + hash(index, 54) * 95) * depth;
    const travel = wrap(time * speed + hash(index, 55) * width * 2, width + 200) - 100;
    const x = direction > 0 ? travel : width - travel;
    const length = (46 + hash(index, 56) * 70) * depth;
    const headColor = pick(index + 300);
    const tail = x - direction * length;
    const streak = context.createLinearGradient(x, laneY, tail, laneY);
    streak.addColorStop(0, neon(headColor, 0.55 * depth));
    streak.addColorStop(1, neon(headColor, 0));
    context.fillStyle = streak;
    context.fillRect(Math.min(x, tail), laneY, length, 2.4 * depth);
    context.fillStyle = neon(headColor, 0.9 * depth);
    context.fillRect(x - 1, laneY - 1, 3.4 * depth, 3.4 * depth);
    context.fillStyle = `rgba(255, 70, 60, ${0.55 * depth})`;
    context.fillRect(tail, laneY, 2.4, 2.4);
  }

  // Cold neon rain over everything.
  context.strokeStyle = "rgba(180, 205, 245, 0.16)";
  context.lineWidth = 1;
  for (let index = 0; index < 100; index += 1) {
    const x = hash(index, 61) * width;
    const y = wrap(hash(index, 62) * height + time * (200 + hash(index, 63) * 180), height + 34) - 34;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - 7, y + 24);
    context.stroke();
  }

  // The baseline test: words surfacing out of the noise, one at a time.
  const baselineWords = ["CELLS", "INTERLINKED", "WITHIN CELLS INTERLINKED", "DREADFULLY DISTINCT"];
  const wordIndex = Math.floor(wrap(time * 0.4, baselineWords.length));
  const wordPhase = wrap(time * 0.4, 1);
  const presence = Math.min(1, wordPhase * 4) * Math.min(1, (1 - wordPhase) * 4);
  context.font = "600 15px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.letterSpacing = "4px";
  context.fillStyle = withAlpha(accentBright, 0.34 * presence);
  context.fillText(baselineWords[wordIndex], width / 2, height - 46);
  context.letterSpacing = "0px";
  context.textAlign = "left";
  context.strokeStyle = withAlpha(accentBright, 0.2);
  context.beginPath();
  for (let step = 0; step <= 60; step += 1) {
    const x = width / 2 - 120 + step * 4;
    const level = Math.sin(step * 0.8 + time * 3) * (step % 7 ? 2 : 6) * presence;
    if (step === 0) context.moveTo(x, height - 30 - level);
    else context.lineTo(x, height - 30 - level);
  }
  context.stroke();
  drawFilmLabel(frame, "BASELINE", width / 2 - 120, height - 64, 0.3);

  drawFilmLabel(frame, "MEMORY INDEX / ARCHIVE 06", 22, 32, 0.42);
  drawSoftVignette(frame, 0.14);
  context.restore();
});
