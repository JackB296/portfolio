import { drawFilmLabel, makeStatefulFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

export default makeStatefulFilmVisual(() => {
  // The boot engages by itself on the first drawn frame after activation —
  // committing the film is the invitation. A gap in draw calls means the tab
  // was hidden, which re-plays the boot on return; reduced-motion static
  // frames render the settled post-boot room instead of a half-drawn install.
  let lastFrameAt = -Infinity;
  let bootPhase: "engaging" | "done" = "engaging";
  let engageStartedAt = 0;

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, pointerX, pointerY, accentBright } = frame;
  if (frame.staticFrame) {
    bootPhase = "done";
  } else if (time - lastFrameAt > 1) {
    bootPhase = "engaging";
    engageStartedAt = time;
  }
  lastFrameAt = time;
  context.save();

  // The voice: a warm waveform breathing at the center, leaning toward the pointer.
  context.strokeStyle = withAlpha(accentBright, 0.32);
  context.lineWidth = 2;
  context.beginPath();
  const centerY = height * 0.55;
  const attention = 8 + (Math.abs(pointerY - centerY) / Math.max(height, 1)) * 18;
  for (let x = 0; x <= width; x += 4) {
    const proximity = 1 - Math.min(1, Math.abs(x - pointerX) / 220);
    const wave = Math.sin(x * 0.035 + time * 1.8) * (attention + proximity * 20);
    const y = centerY + wave * Math.sin(x * 0.009 + time * 0.3);
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.lineWidth = 1;

  // The earpiece resting in the lower right, listening.
  const budX = width - 90;
  const budY = height - 84;
  const bud = context.createRadialGradient(budX, budY, 1, budX, budY, 15);
  bud.addColorStop(0, withAlpha(accentBright, 0.6));
  bud.addColorStop(1, withAlpha(frame.accentDim, 0.2));
  context.fillStyle = bud;
  context.beginPath();
  context.ellipse(budX, budY, 10, 13, 0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = withAlpha(accentBright, 0.25);
  context.beginPath();
  context.ellipse(budX + 4, budY + 9, 4, 6, 0.5, 0, Math.PI * 2);
  context.fill();
  for (let arc = 0; arc < 3; arc += 1) {
    const spread = wrap(time * 0.5 + arc / 3, 1);
    context.strokeStyle = withAlpha(accentBright, 0.4 * (1 - spread));
    context.beginPath();
    context.arc(budX, budY, 17 + spread * 36, -0.9, 0.9);
    context.stroke();
  }

  // OS1: the install floods the whole screen from below the hero copy,
  // counts up, then hands the room back to the voice.
  const bootX = width / 2;
  const bootY = height * 0.78;

  if (bootPhase === "engaging") {
    const progress = Math.min(1, (time - engageStartedAt) / 2.8);
    if (progress >= 1) bootPhase = "done";
    const grow = Math.min(1, progress / 0.55);
    const fade = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
    const iris = 34 + grow * Math.hypot(width, height) * 0.62;
    const wash = context.createRadialGradient(bootX, bootY, iris * 0.08, bootX, bootY, iris);
    wash.addColorStop(0, withAlpha(accentBright, 0.55 * fade));
    wash.addColorStop(0.7, withAlpha(accentBright, 0.28 * fade));
    wash.addColorStop(1, withAlpha(accentBright, 0.04 * fade));
    context.fillStyle = wash;
    context.beginPath();
    context.arc(bootX, bootY, iris, 0, Math.PI * 2);
    context.fill();
    for (let ring = 0; ring < 5; ring += 1) {
      const spin = time * (1.4 + ring * 0.2) + ring * 2;
      context.strokeStyle = withAlpha(accentBright, (0.5 - ring * 0.07) * fade);
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(bootX, bootY, iris * (0.72 + ring * 0.06), spin, spin + Math.PI * 1.1);
      context.stroke();
    }
    context.lineWidth = 1;
    const counter = Math.floor(Math.min(1, progress / 0.7) * 100);
    const textY = bootY + (height * 0.5 - bootY) * grow;
    context.font = "600 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.letterSpacing = "2px";
    context.fillStyle = withAlpha(accentBright, 0.85 * fade);
    context.fillText(`INSTALLING INDIVIDUALITY ... ${counter}%`, bootX, textY);
    context.letterSpacing = "0px";
    context.textAlign = "left";
  }

  // Theodore's day job, resting in the lower left: a handwritten sheet half
  // out of its envelope, the last line still being written. Ambient — it
  // breathes on the same slow lift as the voice and settles flat when the
  // frame is static. Skipped on short or narrow viewports where it would
  // crowd the hero rather than sit behind it.
  const letterX = 84;
  // Clears the cinematic control bar that sits along the bottom edge.
  const letterY = height - 152;
  if (width > 420 && letterY > 200) {
    const breath = frame.staticFrame ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.7);
    const w = 92;
    const h = 58;
    context.save();
    context.translate(letterX, letterY);

    // The sheet, riding just above the envelope's mouth.
    context.save();
    context.translate(0, -breath * 3);
    context.fillStyle = withAlpha(frame.accentDim, 0.12);
    context.strokeStyle = withAlpha(accentBright, 0.3);
    context.beginPath();
    context.rect(-w * 0.34, -h * 0.66, w * 0.68, h * 0.76);
    context.fill();
    context.stroke();
    // Longhand: four ruled strokes, the last one still under the nib.
    for (let line = 0; line < 4; line += 1) {
      const y = -h * 0.5 + line * 9;
      const span = w * 0.56;
      const written = line < 3 ? span * (0.92 - line * 0.08) : span * (0.24 + breath * 0.4);
      context.strokeStyle = withAlpha(accentBright, line < 3 ? 0.26 : 0.44);
      context.beginPath();
      context.moveTo(-w * 0.28, y);
      for (let x = 2; x <= written; x += 4) {
        context.lineTo(-w * 0.28 + x, y + Math.sin(x * 0.55 + line * 1.7) * 0.9);
      }
      context.stroke();
      // The letter cursor: it waits at the end of the line being written.
      if (line === 3) {
        context.strokeStyle = withAlpha(
          accentBright,
          frame.staticFrame ? 0.4 : 0.15 + 0.5 * (wrap(time * 0.9, 1) < 0.5 ? 1 : 0)
        );
        context.beginPath();
        context.moveTo(-w * 0.28 + written + 3, y - 4);
        context.lineTo(-w * 0.28 + written + 3, y + 2);
        context.stroke();
      }
    }
    context.restore();

    // The envelope: the body, then the flap folded open across it.
    context.strokeStyle = withAlpha(accentBright, 0.36);
    context.beginPath();
    context.rect(-w / 2, -h * 0.16, w, h * 0.5);
    context.stroke();
    context.strokeStyle = withAlpha(accentBright, 0.22);
    context.beginPath();
    context.moveTo(-w / 2, -h * 0.16);
    context.lineTo(0, h * 0.16);
    context.lineTo(w / 2, -h * 0.16);
    context.stroke();
    // The seal, warm where the two edges meet.
    context.fillStyle = withAlpha(accentBright, 0.18 + breath * 0.14);
    context.beginPath();
    context.arc(0, h * 0.16, 3.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawFilmLabel(frame, "OS CALIBRATION / 2013", 22, 30, 0.47);
  context.restore();
  };

  return { draw };
});
