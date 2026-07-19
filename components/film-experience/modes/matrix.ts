import { drawFilmLabel, hash, makeStatefulFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

const glyphs = ["0", "1", "J", "B", "{", "}", "λ", "∑", "◇", "/", ">", "_"];

export default makeStatefulFilmVisual(() => {
  // The wake-up call types from the moment the mode activates, not page load.
  let lastFrameAt = -Infinity;
  let typingStartedAt = 0;

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, pointerX, pointerY } = frame;
  if (time - lastFrameAt > 1) typingStartedAt = time;
  lastFrameAt = time;
  context.save();
  context.fillStyle = withAlpha(frame.accentDim, 0.045);
  context.fillRect(0, 0, width, height);

  context.strokeStyle = withAlpha(frame.accent, 0.08);
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  for (let column = 0; column < Math.ceil(width / 24); column += 1) {
    const x = column * 24 + 12;
    const speed = 32 + hash(column, 5) * 90;
    const head = wrap(time * speed + hash(column, 8) * height, height + 260) - 130;
    for (let row = 0; row < 12; row += 1) {
      let y = head - row * 18;
      const distance = Math.hypot(x - pointerX, y - pointerY);
      if (distance < 90) y += (y - pointerY) * (1 - distance / 90) * 0.6;
      context.fillStyle = withAlpha(
        row === 0 ? frame.accentBright : frame.accent,
        Math.max(0.04, 0.62 - row * 0.047)
      );
      const glyph = glyphs[Math.floor(hash(column * 20 + row, Math.floor(time * 2)) * glyphs.length)];
      context.fillText(glyph, x, y);
    }
  }
  context.textAlign = "left";

  // The choice: two real capsules, the red one pulsing.
  const pillY = height - 118;
  (
    [
      ["rgba(239, 68, 68,", width - 96, -0.5, true],
      ["rgba(59, 130, 246,", width - 58, 0.5, false],
    ] as const
  ).forEach(([tint, pillX, tilt, pulses], index) => {
    const glow = pulses ? 0.55 + 0.25 * Math.sin(time * 1.4) : 0.55;
    context.save();
    context.translate(pillX, pillY + Math.sin(time * 0.8 + index * 2.2) * 4);
    context.rotate(tilt);
    context.fillStyle = `${tint} ${glow * 0.3})`;
    context.beginPath();
    context.roundRect(-7, -16, 14, 32, 7);
    context.fill();
    context.strokeStyle = `${tint} ${glow})`;
    context.beginPath();
    context.roundRect(-7, -16, 14, 32, 7);
    context.stroke();
    context.beginPath();
    context.moveTo(-7, 0);
    context.lineTo(7, 0);
    context.stroke();
    context.restore();
  });

  // There is no spoon: it bends by itself on a slow sway, and leans away
  // harder as the pointer approaches.
  const spoonX = 74;
  const spoonY = height - 76;
  const sway = Math.sin(time * 0.8) * 0.4;
  const reach = Math.hypot(pointerX - spoonX, pointerY - (spoonY - 40));
  const pointerBend = (1 - Math.min(1, reach / 240)) * (pointerX > spoonX ? -1 : 1);
  const bend = Math.max(-1, Math.min(1, sway + pointerBend));
  context.save();
  context.translate(spoonX, spoonY);
  context.rotate(-0.9);
  context.strokeStyle = withAlpha(frame.accentBright, 0.5);
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(5, -28, 5 + bend * 14, -52);
  context.stroke();
  context.lineWidth = 1.4;
  context.save();
  context.translate(5 + bend * 14, -61);
  context.rotate(bend * 0.5);
  context.beginPath();
  context.ellipse(0, 0, 7.5, 11, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = withAlpha(frame.accentBright, 0.12);
  context.fill();
  context.restore();
  context.restore();
  context.lineWidth = 1;

  // The terminal wakes the visitor once per load, then keeps its cursor lit.
  // It types in the top-left corner, stacked under the build label, well away
  // from the spoon.
  const message = "Wake up, Jack...";
  const typed = message.slice(0, Math.floor((time - typingStartedAt) * 6));
  context.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = withAlpha(frame.accentBright, 0.55);
  context.fillText(typed, 24, 58);
  if (Math.floor(time * 2.2) % 2 === 0) {
    const cursorX = 24 + context.measureText(typed).width + 3;
    context.fillRect(cursorX, 47, 7, 13);
  }

  drawFilmLabel(frame, "BUILD 1999 / ARRAY 120", 22, 32, 0.46);

  context.restore();
  };

  return { draw };
});
