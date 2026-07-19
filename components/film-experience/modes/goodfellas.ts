import { createSectionTracker, drawFilmLabel, hash, makeStatefulFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

// One era per page section, hero first — the card reads like the film's
// location titles: "THE ABOUT SECTION. 1963."
const SECTION_YEARS = ["1955", "1963", "1970", "1978", "1979", "MAY 11, 1980"] as const;

const FREEZE_SECONDS = 2.8;

export default makeStatefulFilmVisual(() => {
  // Freeze-frame machine state is per activation, so re-entering the mode
  // never resumes a stale section from the previous visit.
  const sections = createSectionTracker();
  let lastSectionIndex = -1;
  let freezeStartedAt = -Infinity;

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, accentBright } = frame;
  context.save();

  // The Copacabana sign warms up letter by letter; the C always struggles.
  const sign = "COPACABANA";
  const signWidth = Math.min(width * 0.5, 320);
  const letterStep = signWidth / sign.length;
  const signLeft = width / 2 - signWidth / 2;
  const signY = height * 0.16;
  context.strokeStyle = withAlpha(accentBright, 0.25);
  context.beginPath();
  context.roundRect(signLeft - 24, signY - 34, signWidth + 48, 54, 8);
  context.stroke();
  context.font = "600 17px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  for (let letter = 0; letter < sign.length; letter += 1) {
    const on = wrap(time * 0.7, sign.length + 4) > letter;
    const struggling = letter === 0 && hash(Math.floor(time * 8), 3) > 0.6;
    const lit = on && !struggling;
    const x = signLeft + letter * letterStep + letterStep / 2;
    if (lit) {
      const halo = context.createRadialGradient(x, signY - 6, 1, x, signY - 6, 15);
      halo.addColorStop(0, withAlpha(frame.accent, 0.24));
      halo.addColorStop(1, withAlpha(frame.accent, 0));
      context.fillStyle = halo;
      context.fillRect(x - 15, signY - 21, 30, 30);
    }
    context.fillStyle = withAlpha(accentBright, lit ? 0.6 : 0.12);
    context.fillText(sign[letter], x, signY);
  }
  context.textAlign = "left";

  // The pink Cadillac cruises the bottom of the frame, fins and all.
  const carX = wrap(time * 40, width + 280) - 140;
  const carY = height * 0.88;
  context.save();
  context.translate(carX, carY);
  context.fillStyle = withAlpha(accentBright, 0.32);
  context.beginPath();
  context.moveTo(-70, 0);
  context.lineTo(-74, -10);
  context.lineTo(-40, -13);
  context.lineTo(-28, -24);
  context.lineTo(18, -24);
  context.lineTo(34, -13);
  context.lineTo(70, -11);
  context.lineTo(74, -4);
  context.lineTo(70, 0);
  context.closePath();
  context.fill();
  context.fillStyle = withAlpha(frame.accentDim, 0.7);
  for (const wheelX of [-42, 42]) {
    context.beginPath();
    context.arc(wheelX, 0, 9, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = withAlpha(accentBright, 0.7);
  for (const wheelX of [-42, 42]) {
    context.beginPath();
    context.arc(wheelX, 0, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  const braking = hash(Math.floor(time * 1.5), 4) > 0.6;
  context.fillStyle = `rgba(255, 60, 60, ${braking ? 0.8 : 0.3})`;
  context.fillRect(-75, -9, 4, 5);
  context.restore();

  // May 11, 1980: the helicopter rides the Cadillac's tail all day — nose
  // toward the car, tail boom trailing behind the direction of travel.
  const heloX = carX - 150 + Math.sin(time * 0.9) * 12;
  const heloY = carY - height * 0.17 + Math.cos(time * 0.7) * 8;
  const spot = context.createLinearGradient(heloX, heloY, carX, carY);
  spot.addColorStop(0, withAlpha(accentBright, 0.14));
  spot.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = spot;
  context.beginPath();
  context.moveTo(heloX - 5, heloY + 12);
  context.lineTo(carX - 34, carY);
  context.lineTo(carX + 20, carY);
  context.lineTo(heloX + 5, heloY + 12);
  context.closePath();
  context.fill();

  context.save();
  context.translate(heloX, heloY);
  context.rotate(0.03 + Math.sin(time * 0.8) * 0.015);
  const hull = withAlpha(accentBright, 0.5);
  // Fuselage and cockpit bubble facing the car.
  context.fillStyle = hull;
  context.beginPath();
  context.ellipse(2, 0, 15, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = withAlpha(accentBright, 0.26);
  context.beginPath();
  context.ellipse(11, -2, 7, 5.5, 0, 0, Math.PI * 2);
  context.fill();
  // Tail boom tapering back, with fin and spinning tail rotor.
  context.fillStyle = hull;
  context.beginPath();
  context.moveTo(-10, -3.4);
  context.lineTo(-34, -1.6);
  context.lineTo(-34, 1.2);
  context.lineTo(-10, 3.4);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(-31, -1.5);
  context.lineTo(-36, -8);
  context.lineTo(-32.5, -1);
  context.closePath();
  context.fill();
  const tailSpin = time * 26;
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.beginPath();
  context.moveTo(-34 - Math.cos(tailSpin) * 5, -3 - Math.sin(tailSpin) * 5);
  context.lineTo(-34 + Math.cos(tailSpin) * 5, -3 + Math.sin(tailSpin) * 5);
  context.stroke();
  // Skids.
  context.strokeStyle = withAlpha(accentBright, 0.45);
  context.beginPath();
  context.moveTo(-6, 8);
  context.lineTo(-8, 12);
  context.moveTo(8, 8);
  context.lineTo(10, 12);
  context.moveTo(-13, 12);
  context.lineTo(15, 12);
  context.stroke();
  // Rotor mast, blurred main rotor, and its faint disc.
  context.fillStyle = hull;
  context.fillRect(-1.5, -12, 3, 5);
  const rotorSpan = 26 + Math.abs(Math.sin(time * 22)) * 6;
  context.strokeStyle = withAlpha(accentBright, 0.5);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-rotorSpan, -13);
  context.lineTo(rotorSpan, -13);
  context.stroke();
  context.lineWidth = 1;
  context.strokeStyle = withAlpha(accentBright, 0.16);
  context.beginPath();
  context.ellipse(0, -13, rotorSpan, 3.5, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  // Crossing into a new page section freezes the film on a bright frame
  // with that section's location card, then releases.
  const section = sections.sectionAt(frame.scroll);
  if (section.index !== lastSectionIndex) {
    if (lastSectionIndex !== -1) freezeStartedAt = time;
    lastSectionIndex = section.index;
  }
  const holdElapsed = time - freezeStartedAt;
  const frozen = frame.staticFrame || (holdElapsed >= 0 && holdElapsed < FREEZE_SECONDS);
  if (frozen) {
    const hold = frame.staticFrame
      ? 1
      : Math.min(1, holdElapsed * 6) * Math.min(1, (FREEZE_SECONDS - holdElapsed) * 3);
    context.fillStyle = withAlpha(accentBright, 0.09 * hold);
    context.fillRect(0, 0, width, height);
    context.strokeStyle = withAlpha(accentBright, 0.4 * hold);
    context.lineWidth = 2;
    context.strokeRect(width * 0.06, height * 0.08, width * 0.88, height * 0.84);
    const year = SECTION_YEARS[Math.min(section.index, SECTION_YEARS.length - 1)];
    context.fillStyle = withAlpha(accentBright, 0.6 * hold);
    context.font = "600 15px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.letterSpacing = "5px";
    context.fillText(`${section.label}. ${year}.`, width * 0.1, height * 0.86);
    context.letterSpacing = "0px";
    drawFilmLabel(frame, "FREEZE", width * 0.1, height * 0.12, 0.5 * hold);
  }

  drawFilmLabel(frame, "COPACABANA / CONTINUOUS TRACK", 22, 28, 0.44);
  context.restore();
  };

  return { draw };
});
