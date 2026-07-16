import { drawFilmLabel, hash, makeFilmVisual, withAlpha, wrap } from "../shared";

const markers = ["eight-cylinder gauge", "compass", "pole-cats", "chrome sheen", "gear train", "witness me"] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, scrollVelocity, accent, accentBright, accentDim } = frame;
  context.save();

  const horizon = height * 0.43;
  // Sky-to-ground dust haze — the desert's blown grit hanging in the air, not
  // rain. Fury Road's world is drought and sandstorm.
  const dustStorm = context.createLinearGradient(0, 0, 0, height);
  dustStorm.addColorStop(0, withAlpha(accentDim, 0.035));
  dustStorm.addColorStop(0.5, withAlpha(accentBright, 0.13));
  dustStorm.addColorStop(1, withAlpha(accent, 0.035));
  context.fillStyle = dustStorm;
  context.fillRect(0, 0, width, height);

  const speed = 1 + Math.min(4, Math.abs(scrollVelocity) / 20);

  // Ground speed-lines racing past below the horizon.
  context.strokeStyle = withAlpha(accentBright, 0.2);
  for (let index = 0; index < 46; index += 1) {
    const y = horizon + hash(index, 34) * (height - horizon);
    const length = 30 + hash(index, 36) * 90 * speed;
    const x = width - wrap(hash(index, 32) * width + time * (140 + hash(index, 35) * 220) * speed, width + length);
    context.lineWidth = 1 + hash(index, 37) * 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y);
    context.stroke();
  }
  context.lineWidth = 1;

  // The war rig convoy drives back and forth along the bottom of the frame.
  const groundY = height * 0.9;
  const phase = time * 0.16;
  const rigX = width * 0.5 + Math.sin(phase) * width * 0.3;
  const heading = Math.cos(phase) >= 0 ? 1 : -1;
  const rigSpeed = Math.abs(Math.cos(phase));
  const rigScale = Math.min(width, height) / 950 + 0.35;

  // Dust plume boiling up behind the rig.
  for (let index = 0; index < 30; index += 1) {
    const age = wrap(time * (0.6 + hash(index, 38) * 0.5) + hash(index, 39), 1);
    const px = rigX - heading * (110 * rigScale + age * width * 0.24 + hash(index, 40) * 30);
    const py = groundY - 6 + Math.sin(age * 6 + index) * 8 - age * 30;
    const radius = 6 + age * 34 * (0.5 + rigSpeed * 0.6 + speed * 0.15);
    const dust = context.createRadialGradient(px, py, 0, px, py, radius);
    dust.addColorStop(0, withAlpha(accentBright, 0.1 * (1 - age)));
    dust.addColorStop(1, withAlpha(accentBright, 0));
    context.fillStyle = dust;
    context.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  const judder = () => (Math.sin(time * 23 + hash(Math.floor(time * 10), 41) * 9) * 1.6 * (0.4 + rigSpeed));

  // The rig: cab, tank trailer, exhaust stacks, and seven wheels.
  context.save();
  context.translate(rigX, groundY + judder());
  context.scale(heading * rigScale, rigScale);
  context.fillStyle = withAlpha(accentBright, 0.34);
  context.beginPath();
  context.roundRect(-108, -40, 128, 30, 7);
  context.fill();
  context.fillRect(-100, -27, 112, 2);
  context.beginPath();
  context.moveTo(24, -8);
  context.lineTo(24, -48);
  context.lineTo(44, -52);
  context.lineTo(64, -52);
  context.lineTo(74, -34);
  context.lineTo(84, -30);
  context.lineTo(92, -8);
  context.closePath();
  context.fill();
  context.fillRect(40, -68, 5, 18);
  context.fillRect(52, -66, 5, 16);
  const wheelXs = [-96, -74, -52, -14, 8, 40, 72];
  wheelXs.forEach((wheelX) => {
    context.fillStyle = withAlpha(accentBright, 0.42);
    context.beginPath();
    context.arc(wheelX, -8, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = withAlpha(accent, 0.5);
    context.beginPath();
    context.arc(wheelX, -8, 4, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();

  // Biker escort weaving in the rig's wake.
  for (let biker = 0; biker < 3; biker += 1) {
    const trail = 150 + biker * 78 + Math.sin(time * 1.3 + biker * 2.2) * 22;
    const bikerX = rigX - heading * trail * rigScale;
    const bikerY = groundY + judder() * 0.6 + Math.sin(time * 2.1 + biker) * 2;
    context.save();
    context.translate(bikerX, bikerY);
    context.scale(heading * rigScale, rigScale);
    context.fillStyle = withAlpha(accentBright, 0.34);
    for (const wheelX of [-12, 12]) {
      context.beginPath();
      context.arc(wheelX, -7, 7, 0, Math.PI * 2);
      context.fill();
    }
    context.beginPath();
    context.moveTo(-12, -10);
    context.quadraticCurveTo(0, -18, 13, -12);
    context.lineTo(9, -7);
    context.lineTo(-8, -7);
    context.closePath();
    context.fill();
    context.beginPath();
    context.arc(-2, -26, 4.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-7, -22);
    context.quadraticCurveTo(-1, -26, 4, -20);
    context.lineTo(8, -13);
    context.lineTo(-6, -12);
    context.closePath();
    context.fill();
    context.restore();
  }

  context.fillStyle = withAlpha(accentBright, 0.14);
  context.beginPath();
  context.moveTo(width * 0.44, horizon);
  context.lineTo(width * 0.06, height);
  context.lineTo(width * 0.94, height);
  context.lineTo(width * 0.56, horizon);
  context.closePath();
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.42);
  context.setLineDash([18, 20]);
  context.beginPath();
  context.moveTo(width / 2, horizon);
  context.lineTo(width / 2, height);
  context.stroke();
  context.setLineDash([]);

  const gaugeX = 78;
  const gaugeY = height - 78;
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI * 0.78 + index * (Math.PI * 1.44) / 7;
    context.strokeStyle = withAlpha(accentBright, 0.25 + index * 0.035);
    context.lineWidth = 4;
    context.beginPath();
    context.arc(gaugeX, gaugeY, 38, angle, angle + 0.14);
    context.stroke();
  }
  context.strokeStyle = withAlpha(accentBright, 0.48);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(gaugeX, gaugeY);
  context.lineTo(gaugeX + Math.cos(time * 0.7) * 31, gaugeY + Math.sin(time * 0.7) * 31);
  context.stroke();

  for (let gear = 0; gear < 3; gear += 1) {
    const x = width - 62 - gear * 42;
    const y = height - 55 + (gear % 2) * 12;
    context.strokeStyle = withAlpha(accentBright, 0.28);
    context.beginPath();
    context.arc(x, y, 14 + gear * 2, 0, Math.PI * 2);
    context.stroke();
    for (let tooth = 0; tooth < 8; tooth += 1) {
      const angle = tooth * Math.PI / 4 + time * (gear % 2 ? -0.2 : 0.2);
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
      context.lineTo(x + Math.cos(angle) * 21, y + Math.sin(angle) * 21);
      context.stroke();
    }
  }
  const compassX = width - 58;
  const compassY = 76;
  context.strokeStyle = withAlpha(accentBright, 0.38);
  context.beginPath();
  context.arc(compassX, compassY, 22, 0, Math.PI * 2);
  context.moveTo(compassX, compassY - 17);
  context.lineTo(compassX + Math.sin(time * 0.3) * 12, compassY + 13);
  context.lineTo(compassX, compassY + 7);
  context.closePath();
  context.stroke();
  // Pole-cats ride counterweighted poles mounted on chase cars in the rig's wake.
  for (const [trailBase, phasing] of [
    [300, 0],
    [430, 2.2],
  ] as const) {
    const trail = trailBase + Math.sin(time * 0.9 + phasing) * 16;
    const chaseX = rigX - heading * trail * rigScale;
    const chaseY = groundY + judder() * 0.5;
    context.save();
    context.translate(chaseX, chaseY);
    context.scale(heading * rigScale, rigScale);
    context.fillStyle = withAlpha(accentBright, 0.32);
    context.beginPath();
    context.roundRect(-26, -17, 52, 13, 3);
    context.fill();
    for (const wheelX of [-16, 16]) {
      context.fillStyle = withAlpha(accentBright, 0.42);
      context.beginPath();
      context.arc(wheelX, -5, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = withAlpha(accent, 0.5);
      context.beginPath();
      context.arc(wheelX, -5, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    const sway = Math.sin(time * 1.1 + phasing) * 0.35;
    context.save();
    context.translate(chaseX, chaseY - 16 * rigScale);
    context.rotate(sway);
    context.strokeStyle = withAlpha(accentBright, 0.45);
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -height * 0.32);
    context.stroke();
    context.lineWidth = 1;
    context.fillStyle = withAlpha(accentBright, 0.5);
    context.beginPath();
    context.arc(0, -height * 0.32 - 5, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-2, -height * 0.32, 4, 9);
    context.restore();
  }

  // "WITNESS ME" — a rare chrome flash, gone in half a second.
  const witness = wrap(time, 16);
  if (!frame.staticFrame && witness > 15.1 && witness < 15.55) {
    const flash = 1 - (witness - 15.1) / 0.45;
    context.fillStyle = `rgba(214, 232, 255, ${0.16 * flash})`;
    context.fillRect(0, 0, width, height);
    context.font = "700 26px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.letterSpacing = "6px";
    context.fillStyle = `rgba(226, 240, 255, ${0.8 * flash})`;
    context.fillText("WITNESS ME", width / 2, height * 0.42);
    context.letterSpacing = "0px";
    context.textAlign = "left";
    for (let fleck = 0; fleck < 26; fleck += 1) {
      context.fillStyle = `rgba(210, 230, 255, ${0.5 * flash})`;
      context.fillRect(width * 0.3 + hash(fleck) * width * 0.4, height * 0.3 + hash(fleck, 2) * height * 0.3, 2, 2);
    }
  }

  drawFilmLabel(frame, "8-CYL / CONTACT ROAD", 22, 28, 0.47);
  context.restore();
});
