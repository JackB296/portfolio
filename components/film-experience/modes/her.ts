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

  drawFilmLabel(frame, "OS CALIBRATION / 2013", 22, 30, 0.47);
  context.restore();
  };

  return { draw };
});
