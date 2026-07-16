import { drawFilmLabel, makeFilmVisual, withAlpha, wrap } from "../shared";

const markers = ["2013", "OS calibration", "earpiece", "warm waveform", "OS boot", "letter cursor"] as const;

// The boot idles as an invitation and only engages on a real click (the
// canvas is pointer-events: none, so clicks are read from the window and
// hit-tested against the iris). A gap in draw calls means the mode was just
// (re)activated, which re-arms the sequence.
let lastFrameAt = -Infinity;
let bootPhase: "idle" | "engaging" | "done" = "idle";
let engageStartedAt = 0;
let pendingClick: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (event) => {
    pendingClick = { x: event.clientX, y: event.clientY };
  });
}

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, pointerX, pointerY, accentBright } = frame;
  if (time - lastFrameAt > 1) bootPhase = "idle";
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

  // OS1: an iris waits below the hero copy. Click it and the install floods
  // the whole screen, counts up, then hands the room back to the voice.
  const bootX = width / 2;
  const bootY = height * 0.78;
  const click = pendingClick;
  pendingClick = null;
  if (
    bootPhase === "idle" &&
    !frame.staticFrame &&
    click &&
    Math.hypot(click.x - bootX, click.y - bootY) < 96
  ) {
    bootPhase = "engaging";
    engageStartedAt = time;
  }

  if (bootPhase === "idle") {
    const breathe = 1 + Math.sin(time * 1.1) * 0.06;
    const iris = 34 * breathe;
    for (let ring = 0; ring < 5; ring += 1) {
      const spin = time * (0.6 + ring * 0.13) + ring * 2;
      context.strokeStyle = withAlpha(accentBright, 0.55 - ring * 0.08);
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(bootX, bootY, iris * (0.5 + ring * 0.16), spin, spin + Math.PI * 1.2);
      context.stroke();
    }
    context.lineWidth = 1;
    const core = context.createRadialGradient(bootX, bootY, 0, bootX, bootY, 20);
    core.addColorStop(0, withAlpha(accentBright, 0.7));
    core.addColorStop(1, withAlpha(accentBright, 0));
    context.fillStyle = core;
    context.fillRect(bootX - 20, bootY - 20, 40, 40);
    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.fillStyle = withAlpha(accentBright, 0.4 + 0.2 * Math.sin(time * 1.4));
    context.fillText("OS ONE — CLICK TO INITIALIZE", bootX, bootY + iris + 28);
    context.textAlign = "left";
  } else if (bootPhase === "engaging") {
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
});
