import { drawFilmLabel, makeFilmVisual, withAlpha } from "../shared";

const markers = ["B2-B1-G-1", "Morse lamp", "scholar's stone", "weight token", "city lights", "hidden panel"] as const;

// ··· / −−− steady city night; one lamp signals in Morse.
const MORSE = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, accentBright } = frame;
  context.save();

  // The house, floor by floor: five lights in a vertical run. The bottom one
  // is the semi-basement, and it talks in Morse.
  const columnX = width * 0.8;
  const columnTop = height * 0.22;
  const columnGap = Math.min(66, height * 0.1);
  const beat = Math.floor(time * 3) % MORSE.length;
  const lampOn = MORSE[beat] === 1;
  for (let level = 0; level < 5; level += 1) {
    const y = columnTop + level * columnGap;
    const isBasement = level === 4;
    const glow = isBasement
      ? lampOn
        ? 0.6
        : 0.07
      : 0.24 + 0.07 * Math.sin(time * (0.4 + level * 0.13) + level);
    context.fillStyle = withAlpha(accentBright, Math.max(0.05, glow));
    context.beginPath();
    context.arc(columnX, y, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = withAlpha(accentBright, isBasement && lampOn ? 0.5 : 0.18);
    context.beginPath();
    context.arc(columnX, y, 11, 0, Math.PI * 2);
    context.stroke();
    if (isBasement && lampOn) {
      const halo = context.createRadialGradient(columnX, y, 2, columnX, y, 64);
      halo.addColorStop(0, withAlpha(accentBright, 0.24));
      halo.addColorStop(1, withAlpha(accentBright, 0));
      context.fillStyle = halo;
      context.fillRect(columnX - 64, y - 64, 128, 128);
    }
  }

  // The scholar's stone sits heavy in the lower left, gleaming once in a while.
  const stoneX = 96;
  const stoneY = height - 128;
  context.save();
  context.translate(stoneX, stoneY);
  context.fillStyle = withAlpha(frame.accentDim, 0.55);
  context.fillRect(-32, 27, 64, 7);
  context.fillRect(-24, 23, 48, 5);
  context.fillStyle = withAlpha(accentBright, 0.16);
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(-21, 23);
  context.lineTo(-27, 2);
  context.lineTo(-17, -19);
  context.lineTo(-2, -27);
  context.lineTo(15, -21);
  context.lineTo(25, -2);
  context.lineTo(19, 15);
  context.lineTo(6, 23);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = withAlpha(accentBright, 0.25);
  context.beginPath();
  context.moveTo(-19, 4);
  context.quadraticCurveTo(0, -4, 19, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(-12, -12);
  context.quadraticCurveTo(2, -17, 13, -12);
  context.stroke();
  const gleam = Math.max(0, Math.sin(time * 0.8));
  context.strokeStyle = withAlpha(accentBright, 0.6 * gleam);
  context.beginPath();
  context.moveTo(-9, -21);
  context.lineTo(-3, -27);
  context.moveTo(-11, -25);
  context.lineTo(-7, -29);
  context.stroke();
  context.restore();

  drawFilmLabel(frame, "MORSE LAMP / B2/B1/G/1", width - 20, 28, 0.44, "right");
  drawFilmLabel(frame, "WEIGHT TOKEN / SIGNAL", 20, height - 22, 0.4);
  context.restore();
});
