import { drawFilmLabel, hash, makeStatefulFilmVisual, withAlpha, wrap } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

export default makeStatefulFilmVisual(() => {
  // The pianoforte presses scattered keys on the recording's attacks — like a
  // player, not a spectrum analyzer. Presses are short holds on random keys.
  const whitePressUntil = new Array<number>(14).fill(0);
  const blackPressUntil = new Array<number>(13).fill(0);
  let previousLevels = new Array<number>(14).fill(0);
  let pressCounter = 0;
  let lastPressTick = -1;

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, pointerX, pointerY, accentBright, accentDim } = frame;
  context.save();

  const stage = context.createRadialGradient(width / 2, height * 0.4, 10, width / 2, height * 0.4, Math.max(width, height) * 0.68);
  stage.addColorStop(0, withAlpha(accentBright, 0.13));
  stage.addColorStop(1, withAlpha(accentDim, 0.025));
  context.fillStyle = stage;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = withAlpha(accentBright, 0.22);
  context.lineWidth = 1;
  const staffTop = height * 0.27;
  for (let staff = 0; staff < 3; staff += 1) {
    for (let line = 0; line < 5; line += 1) {
      const y = staffTop + staff * 104 + line * 12;
      context.beginPath(); context.moveTo(width * 0.18, y); context.lineTo(width * 0.82, y); context.stroke();
    }
  }
  context.fillStyle = withAlpha(accentBright, 0.4);
  for (let index = 0; index < 42; index += 1) {
    const x = width * 0.2 + hash(index, 71) * width * 0.58;
    const staff = index % 3;
    const y = staffTop + staff * 104 + (index % 5) * 12;
    context.beginPath(); context.ellipse(x, y, 5, 3.5, -0.3, 0, Math.PI * 2); context.fill();
    context.fillRect(x + 4, y - 20, 1, 20);
  }

  const candleXs = [44, 84, 124];
  candleXs.forEach((x, index) => {
    const y = height - 106 - (index % 2) * 14;
    const flame = 8 + Math.sin(time * 2.1 + index) * 2;
    const glow = context.createRadialGradient(x, y - 20, 0, x, y - 20, 48);
    glow.addColorStop(0, withAlpha(accentBright, 0.26)); glow.addColorStop(1, withAlpha(accentBright, 0));
    context.fillStyle = glow; context.fillRect(x - 48, y - 68, 96, 96);
    context.fillStyle = withAlpha(accentBright, 0.44); context.fillRect(x - 3, y, 6, 34);
    context.beginPath(); context.ellipse(x, y - 9, 4, flame, 0, 0, Math.PI * 2); context.fill();
  });

  // Candlelight follows the pointer: a flickering glow shedding embers.
  const flicker =
    0.82 +
    0.18 * Math.sin(time * 9.7) * Math.sin(time * 4.3 + 1.7) +
    (hash(Math.floor(time * 14), 76) - 0.5) * 0.1;
  const glowRadius = 130 * flicker;
  const candleGlow = context.createRadialGradient(
    pointerX, pointerY, 2,
    pointerX, pointerY, glowRadius
  );
  candleGlow.addColorStop(0, withAlpha(accentBright, 0.3 * flicker));
  candleGlow.addColorStop(0.4, withAlpha(accentBright, 0.12 * flicker));
  candleGlow.addColorStop(1, withAlpha(accentBright, 0));
  context.fillStyle = candleGlow;
  context.fillRect(pointerX - glowRadius, pointerY - glowRadius, glowRadius * 2, glowRadius * 2);

  context.fillStyle = withAlpha(accentBright, 0.75 * flicker);
  context.beginPath();
  context.ellipse(
    pointerX,
    pointerY - 4,
    2.4,
    5 + flicker * 3,
    Math.sin(time * 3.1) * 0.18,
    0,
    Math.PI * 2
  );
  context.fill();

  for (let index = 0; index < 9; index += 1) {
    const life = wrap(time * (0.5 + hash(index, 77) * 0.4) + hash(index, 78), 1);
    const emberX = pointerX + Math.sin(time * 1.3 + index * 2.4) * (6 + life * 18);
    const emberY = pointerY - 8 - life * 70;
    context.fillStyle = withAlpha(accentBright, 0.55 * (1 - life));
    context.fillRect(emberX, emberY, 1.6, 1.6);
  }

  // The pianoforte plays itself in the lower-right corner. The recording
  // decides WHEN keys strike (attacks and loudness from the analyser); a
  // scattered pick decides WHICH, so it reads as hands, not a wave. With
  // sound off the keyboard rests.
  const keyWidth = 16;
  const keyboardLeft = width - 14 * keyWidth - 26;
  const keyboardTop = height - 108;
  const levels = frame.staticFrame ? [] : frame.musicLevels(14);
  const loudness = levels.reduce((sum, level) => sum + level, 0) / 14;

  const pressRandomKey = (strength: number) => {
    pressCounter += 1;
    const hold = time + 0.16 + Math.min(0.3, strength * 0.3);
    if (hash(pressCounter, 93) < 0.28) {
      const slot = Math.floor(hash(pressCounter, 94) * 13);
      if (slot % 7 !== 2 && slot % 7 !== 6) {
        blackPressUntil[slot] = hold;
        return;
      }
    }
    whitePressUntil[Math.floor(hash(pressCounter, 95) * 14)] = hold;
  };
  levels.forEach((level, band) => {
    if (level - (previousLevels[band] ?? 0) > 0.06 && level > 0.16) pressRandomKey(level);
  });
  if (levels.length) previousLevels = levels;
  const pressTick = Math.floor(time * 7);
  if (pressTick !== lastPressTick) {
    lastPressTick = pressTick;
    if (loudness > 0.04 && hash(pressTick, 91) < loudness * 1.7) {
      pressRandomKey(0.3 + loudness);
    }
  }

  for (let key = 0; key < 14; key += 1) {
    const active = time < whitePressUntil[key];
    context.fillStyle = withAlpha(accentBright, active ? 0.34 : 0.06);
    context.fillRect(keyboardLeft + key * keyWidth, keyboardTop + (active ? 3 : 0), keyWidth - 2, 34);
    context.strokeStyle = withAlpha(accentBright, 0.35);
    context.strokeRect(keyboardLeft + key * keyWidth, keyboardTop + (active ? 3 : 0), keyWidth - 2, 34);
  }
  for (let key = 0; key < 13; key += 1) {
    if (key % 7 === 2 || key % 7 === 6) continue;
    const active = time < blackPressUntil[key];
    context.fillStyle = withAlpha(accentDim, active ? 1 : 0.8);
    context.fillRect(keyboardLeft + key * keyWidth + keyWidth * 0.65, keyboardTop + (active ? 3 : 0), keyWidth * 0.68, 19);
    if (active) {
      context.fillStyle = withAlpha(accentBright, 0.3);
      context.fillRect(keyboardLeft + key * keyWidth + keyWidth * 0.65, keyboardTop + 3, keyWidth * 0.68, 3);
    }
  }
  for (let note = 0; note < 5; note += 1) {
    const drift = wrap(hash(note) + time * 0.25, 1);
    context.fillStyle = withAlpha(accentBright, (1 - drift) * (0.1 + loudness * 1.6));
    context.beginPath();
    context.ellipse(
      keyboardLeft + hash(note, 2) * keyWidth * 14,
      keyboardTop - 10 - drift * height * 0.24,
      3.5, 2.5, -0.3, 0, Math.PI * 2
    );
    context.fill();
  }

  drawFilmLabel(frame, "MOVEMENT COUNT / 04", 22, 30, 0.47);
  drawFilmLabel(frame, "MANUSCRIPT 1787 / STAGE 1984", width - 22, 30, 0.42, "right");
  context.restore();
  };

  return { draw };
});
