import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

const markers = ["12 markers", "seven-part bloom", "mirrored time", "heptapod shadow", "shell hover", "twelve clocks"] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, pointerX, pointerY, accentBright, accentDim } = frame;
  context.save();

  const fog = context.createRadialGradient(width / 2, height * 0.48, 10, width / 2, height * 0.48, Math.max(width, height) * 0.7);
  fog.addColorStop(0, withAlpha(accentBright, 0.11));
  fog.addColorStop(1, withAlpha(accentDim, 0.015));
  context.fillStyle = fog;
  context.fillRect(0, 0, width, height);

  // A heptapod behind the glass: seven limbs, barely there in the mist.
  const podX = width * 0.1;
  const podY = height * 0.28;
  context.fillStyle = withAlpha(accentDim, 0.3);
  context.beginPath();
  context.ellipse(podX, podY, 30, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(accentDim, 0.28);
  context.lineWidth = 5;
  context.lineCap = "round";
  for (let limb = 0; limb < 7; limb += 1) {
    const angle = Math.PI * (0.15 + (limb / 6) * 0.7) + Math.sin(time * 0.3 + limb) * 0.03;
    context.beginPath();
    context.moveTo(podX + Math.cos(angle) * 20, podY + Math.sin(angle) * 18);
    context.quadraticCurveTo(
      podX + Math.cos(angle) * 60,
      podY + Math.sin(angle) * 70,
      podX + Math.cos(angle) * 68 + Math.sin(time * 0.4 + limb) * 5,
      height * 0.94
    );
    context.stroke();
  }
  context.lineWidth = 1;

  const centerX = width / 2 + (pointerX - width / 2) * 0.025;
  const centerY = height * 0.48 + (pointerY - height / 2) * 0.025;
  context.lineCap = "round";
  for (let layer = 0; layer < 7; layer += 1) {
    const radius = Math.min(width, height) * (0.13 + layer * 0.012);
    const start = time * 0.018 + layer * 0.57;
    context.strokeStyle = withAlpha(accentBright, 0.13 + layer * 0.025);
    context.lineWidth = 3 + hash(layer, 2) * 7;
    context.beginPath();
    context.arc(centerX, centerY, radius, start, start + Math.PI * (1.33 + hash(layer, 8) * 0.45));
    context.stroke();
  }
  context.lineWidth = 1;

  context.fillStyle = withAlpha(accentBright, 0.5);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(width, height) * 0.23;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    context.beginPath();
    context.arc(x, y, index % 3 === 0 ? 3 : 1.5, 0, Math.PI * 2);
    context.fill();
  }

  // The shell hangs over the right horizon, dead still except a slow breath.
  const shellX = width * 0.84;
  const shellY = height * 0.38 + Math.sin(time * 0.4) * 2;
  context.save();
  context.translate(shellX, shellY);
  context.rotate(0.06);
  const hull = context.createLinearGradient(0, -82, 0, 82);
  hull.addColorStop(0, withAlpha(accentBright, 0.3));
  hull.addColorStop(1, withAlpha(accentDim, 0.12));
  context.fillStyle = hull;
  context.beginPath();
  context.ellipse(0, 0, 27, 82, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.4);
  context.beginPath();
  context.ellipse(0, 0, 27, 82, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = withAlpha(accentBright, 0.5);
  context.fillRect(-5, 56, 10, 6);
  context.restore();
  context.fillStyle = withAlpha(accentDim, 0.2);
  for (let bank = 0; bank < 5; bank += 1) {
    const bx = shellX - 90 + wrap(hash(bank) * 180 + time * 6, 180);
    context.beginPath();
    context.ellipse(bx, height * 0.52 + hash(bank, 2) * 10, 34 + hash(bank, 3) * 22, 7, 0, 0, Math.PI * 2);
    context.fill();
  }

  // Twelve landing sites, twelve clocks, hands ticking in unison.
  const clockY = height - 88;
  const clockGap = 24;
  const clockStart = width - 24 - 11 * clockGap;
  for (let site = 0; site < 12; site += 1) {
    const cx = clockStart + site * clockGap;
    context.strokeStyle = withAlpha(accentBright, 0.3);
    context.beginPath();
    context.arc(cx, clockY, 7, 0, Math.PI * 2);
    context.stroke();
    const hourAngle = hash(site, 7) * Math.PI * 2 + time * 0.02;
    const minuteAngle = Math.floor(time) * (Math.PI / 30) + hash(site, 8);
    context.strokeStyle = withAlpha(accentBright, 0.5);
    context.beginPath();
    context.moveTo(cx, clockY);
    context.lineTo(cx + Math.cos(hourAngle) * 3.5, clockY + Math.sin(hourAngle) * 3.5);
    context.stroke();
    context.strokeStyle = withAlpha(accentBright, 0.32);
    context.beginPath();
    context.moveTo(cx, clockY);
    context.lineTo(cx + Math.cos(minuteAngle) * 5.5, clockY + Math.sin(minuteAngle) * 5.5);
    context.stroke();
  }

  drawFilmLabel(frame, "12 MARKERS / MIRRORED TIME", 20, 30, 0.45);
  context.restore();
});
