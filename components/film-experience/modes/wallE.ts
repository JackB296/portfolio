import { drawFilmLabel, makeFilmVisual, withAlpha, wrap } from "../shared";

export default makeFilmVisual((frame) => {
  const { context, width, height, time, pointerX, pointerY, accentBright } = frame;
  context.save();

  // The Axiom passes deep in the background, windows lit.
  const shipX = wrap(time * 12, width + 300) - 150;
  const shipY = height * 0.28;
  context.save();
  context.translate(shipX, shipY);
  context.rotate(-0.06);
  context.fillStyle = withAlpha(frame.accentDim, 0.5);
  context.beginPath();
  context.moveTo(-90, 10);
  context.quadraticCurveTo(-70, -16, 0, -18);
  context.quadraticCurveTo(80, -16, 96, 2);
  context.lineTo(80, 12);
  context.closePath();
  context.fill();
  context.fillStyle = withAlpha(accentBright, 0.22);
  context.beginPath();
  context.ellipse(-20, -20, 30, 8, -0.05, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = withAlpha(accentBright, 0.5);
  for (let porthole = 0; porthole < 12; porthole += 1) {
    context.fillRect(-70 + porthole * 13, -6 + Math.sin(porthole) * 1.5, 3, 2);
  }
  const thrust = 0.5 + 0.5 * Math.sin(time * 6);
  context.fillStyle = withAlpha(accentBright, 0.3 * thrust);
  context.beginPath();
  context.ellipse(-96, 4, 10 + thrust * 6, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // EVE patrols the whole frame, leaning into her motion, blinking, and
  // sweeping her scan beam across whatever she passes over.
  const eveX = width * (0.5 + 0.34 * Math.sin(time * 0.13));
  const eveY = height * (0.34 + 0.16 * Math.sin(time * 0.09 + 1.7)) + Math.sin(time * 1.1) * 6;
  const lean = Math.cos(time * 0.13) * 0.12;
  context.save();
  context.translate(eveX, eveY);
  context.rotate(lean);
  context.fillStyle = withAlpha(accentBright, 0.14);
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.beginPath();
  context.ellipse(0, 0, 15, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = withAlpha(frame.accentDim, 0.7);
  context.beginPath();
  context.ellipse(0, -7, 9.5, 6.5, 0, 0, Math.PI * 2);
  context.fill();
  const blink = wrap(time, 3.7) > 3.55 ? 0.1 : 1;
  context.fillStyle = `rgba(140, 220, 255, ${0.75 * blink})`;
  for (const side of [-1, 1]) {
    context.save();
    context.translate(side * 3.8, -7);
    context.scale(1, 0.55 * blink + 0.05);
    context.beginPath();
    context.arc(0, 0, 2.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.save();
  context.translate(0, 18);
  context.rotate(Math.sin(time * 0.7) * 0.8 - lean);
  const scan = context.createLinearGradient(0, 0, 0, height * 0.4);
  scan.addColorStop(0, withAlpha(accentBright, 0.24));
  scan.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = scan;
  context.beginPath();
  context.moveTo(-3, 0);
  context.lineTo(-height * 0.11, height * 0.4);
  context.lineTo(height * 0.11, height * 0.4);
  context.lineTo(3, 0);
  context.closePath();
  context.fill();
  context.restore();
  context.restore();

  // The boot, with the sprout that makes the trip worth it.
  const bootX = width - 92;
  const bootY = height - 104;
  context.fillStyle = withAlpha(frame.accentDim, 0.45);
  context.strokeStyle = withAlpha(accentBright, 0.5);
  context.beginPath();
  context.moveTo(bootX - 14, bootY);
  context.lineTo(bootX - 14, bootY - 26);
  context.lineTo(bootX - 4, bootY - 26);
  context.lineTo(bootX - 2, bootY - 12);
  context.lineTo(bootX + 18, bootY - 10);
  context.quadraticCurveTo(bootX + 24, bootY - 4, bootX + 20, bootY);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(bootX - 14, bootY - 20);
  context.lineTo(bootX - 5, bootY - 20);
  context.stroke();
  const sway = Math.sin(time * 0.7) * 2;
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(bootX - 9, bootY - 26);
  context.quadraticCurveTo(bootX - 11 + sway, bootY - 48, bootX - 7 + sway, bootY - 60);
  context.stroke();
  context.lineWidth = 1;
  context.fillStyle = withAlpha(accentBright, 0.4);
  context.beginPath();
  context.ellipse(bootX - 16 + sway, bootY - 52, 8, 3.5, -0.5, 0, Math.PI * 2);
  context.ellipse(bootX - 3 + sway, bootY - 58, 8, 3.5, 0.5, 0, Math.PI * 2);
  context.fill();

  // Hal the cockroach patrols the bottom edge and hides from the pointer.
  const dash = Math.floor(time * 0.7);
  const roachX = wrap(dash * 60 + Math.min(1, wrap(time * 0.7, 1) * 3) * 60, width + 40) - 20;
  const roachY = height - 26;
  if (Math.hypot(roachX - pointerX, roachY - pointerY) > 90) {
    context.fillStyle = withAlpha(accentBright, 0.55);
    context.beginPath();
    context.ellipse(roachX, roachY, 7, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(roachX + 6, roachY - 2, 2.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = withAlpha(accentBright, 0.45);
    for (let leg = 0; leg < 3; leg += 1) {
      const wiggle = Math.sin(time * 18 + leg) * 2;
      context.beginPath();
      context.moveTo(roachX - 2 + leg * 3, roachY + 3);
      context.lineTo(roachX - 4 + leg * 4, roachY + 8 + wiggle);
      context.stroke();
      context.beginPath();
      context.moveTo(roachX + 8, roachY - 4);
      context.lineTo(roachX + 12 + leg * 2, roachY - 8 - leg + wiggle * 0.5);
      context.stroke();
    }
  }

  context.strokeStyle = withAlpha(accentBright, 0.38);
  for (let bar = 0; bar < 5; bar += 1) context.strokeRect(22 + bar * 13, 21, 9, 14);
  drawFilmLabel(frame, "CHARGE 700 / JB113", 22, 52, 0.46);
  drawFilmLabel(frame, "PLANT STATUS / CLEAN PATH", width - 22, 28, 0.42, "right");
  context.restore();
});
