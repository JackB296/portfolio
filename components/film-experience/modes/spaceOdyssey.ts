import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

const markers = ["1968", "2001", "9000 serial", "JB-35", "mission grid", "rendezvous"] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, pointerX, pointerY, scrollVelocity, accent, accentBright, accentDim } = frame;
  context.save();

  context.fillStyle = withAlpha(accentBright, 0.45);
  for (let index = 0; index < 92; index += 1) {
    const size = 0.5 + hash(index, 7) * 1.7;
    context.fillRect(hash(index, 2) * width, hash(index, 4) * height, size, size);
  }

  const centerX = width * 0.5;
  const centerY = height * 0.48;
  context.translate(centerX, centerY);
  context.rotate(time * 0.12);
  context.strokeStyle = withAlpha(accentBright, 0.26);
  context.lineWidth = 1;
  for (let radius = 60; radius < Math.min(width, height) * 0.44; radius += 52) {
    context.beginPath();
    context.ellipse(0, 0, radius * 1.55, radius * 0.37, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);

  // The Star Gate: light bars rush past while the page is in motion.
  const rush = Math.min(1, Math.abs(scrollVelocity) / 26);
  if (rush > 0.02) {
    for (let bar = 0; bar < 18; bar += 1) {
      const progress = wrap(hash(bar) + time * (0.2 + hash(bar, 2) * 0.16), 1);
      const side = hash(bar, 3) > 0.5 ? 1 : -1;
      const y = centerY + side * (6 + progress * height * 0.5);
      const span = progress * width * 0.4 * (0.4 + rush * 0.6);
      context.strokeStyle = withAlpha(
        hash(bar, 4) > 0.75 ? accentBright : accent,
        (0.06 + progress * 0.4) * rush
      );
      context.lineWidth = 1 + progress * 2;
      context.beginPath();
      context.moveTo(centerX - span, y);
      context.lineTo(centerX + span, y);
      context.stroke();
    }
    context.lineWidth = 1;
  }

  const slabWidth = Math.max(26, Math.min(54, width * 0.05));
  const slabHeight = Math.max(130, Math.min(270, height * 0.31));
  context.fillStyle = "rgba(0,0,0,0.3)";
  context.strokeStyle = withAlpha(accentBright, 0.52);
  context.lineWidth = 1;
  context.fillRect(centerX - slabWidth / 2, centerY - slabHeight / 2, slabWidth, slabHeight);
  context.strokeRect(centerX - slabWidth / 2, centerY - slabHeight / 2, slabWidth, slabHeight);

  // Station V waltzing on the left: a double wheel with spokes.
  const stationX = width * 0.16;
  const stationY = height * 0.3;
  context.save();
  context.translate(stationX, stationY);
  context.rotate(time * 0.12);
  context.strokeStyle = withAlpha(accentBright, 0.34);
  context.beginPath();
  context.ellipse(0, 0, 58, 21, 0, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = withAlpha(accentBright, 0.2);
  context.beginPath();
  context.ellipse(0, 0, 44, 16, 0, 0, Math.PI * 2);
  context.stroke();
  for (let spoke = 0; spoke < 6; spoke += 1) {
    const angle = (spoke * Math.PI) / 3;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(angle) * 58, Math.sin(angle) * 21);
    context.stroke();
  }
  context.fillStyle = withAlpha(accentBright, 0.4);
  context.beginPath();
  context.arc(0, 0, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // HAL's eye: concentric lens rings, and the specular glint watches the pointer.
  const halX = width - 84;
  const halY = 88;
  const halRadius = 26;
  context.strokeStyle = withAlpha(accentDim, 0.6);
  context.beginPath();
  context.arc(halX, halY, halRadius + 5, 0, Math.PI * 2);
  context.stroke();
  const lens = context.createRadialGradient(halX, halY, 0, halX, halY, halRadius);
  lens.addColorStop(0, `rgba(255, 236, 205, ${0.75 + Math.sin(time * 0.7) * 0.1})`);
  lens.addColorStop(0.22, withAlpha(accentBright, 0.65));
  lens.addColorStop(0.7, withAlpha(accent, 0.28));
  lens.addColorStop(1, withAlpha(accentDim, 0.05));
  context.fillStyle = lens;
  context.beginPath();
  context.arc(halX, halY, halRadius, 0, Math.PI * 2);
  context.fill();
  for (let ring = 1; ring < 4; ring += 1) {
    context.strokeStyle = withAlpha(accentBright, 0.22 - ring * 0.04);
    context.beginPath();
    context.arc(halX, halY, (halRadius * ring) / 4, 0, Math.PI * 2);
    context.stroke();
  }
  const gaze = Math.atan2(pointerY - halY, pointerX - halX);
  context.fillStyle = "rgba(255, 255, 255, 0.65)";
  context.beginPath();
  context.arc(halX + Math.cos(gaze) * halRadius * 0.35, halY + Math.sin(gaze) * halRadius * 0.35, 2.6, 0, Math.PI * 2);
  context.fill();

  // The zero-g pen tumbles along, easing away from the pointer.
  let penX = width * 0.72 + Math.sin(time * 0.26) * width * 0.1;
  let penY = height * 0.66 + Math.sin(time * 0.2 + 2) * height * 0.08;
  const clearance = Math.hypot(penX - pointerX, penY - pointerY);
  if (clearance < 120) {
    penX += ((penX - pointerX) / Math.max(clearance, 1)) * (120 - clearance) * 0.5;
    penY += ((penY - pointerY) / Math.max(clearance, 1)) * (120 - clearance) * 0.5;
  }
  context.save();
  context.translate(penX, penY);
  context.rotate(time * 0.4);
  context.strokeStyle = withAlpha(accentBright, 0.5);
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-14, 0);
  context.lineTo(10, 0);
  context.stroke();
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(10, 0);
  context.lineTo(16, 0);
  context.stroke();
  context.restore();
  context.lineWidth = 1;

  context.strokeStyle = withAlpha(accentBright, 0.23);
  context.beginPath();
  context.moveTo(0, height * 0.78);
  context.lineTo(width, height * 0.78);
  context.moveTo(centerX, 0);
  context.lineTo(centerX, height);
  context.stroke();
  drawFilmLabel(frame, "MISSION GRID / JB-35", 22, 30, 0.5);
  context.restore();
});
