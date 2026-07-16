import { drawFilmLabel, makeFilmVisual, pageSectionAt, withAlpha } from "../shared";

const markers = ["chapter numbers", "record player", "falcon circuit", "townhouse", "family archive", "storybook bands"] as const;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

export default makeFilmVisual(markers, (frame) => {
  const { context, width, height, time, scroll, accent, accentBright, accentDim } = frame;
  context.save();

  // Flat storybook color bands, dead symmetric.
  const bandHeight = height * 0.09;
  context.fillStyle = withAlpha(accentBright, 0.13);
  context.fillRect(0, 0, width, bandHeight);
  context.fillStyle = withAlpha(accent, 0.1);
  context.fillRect(0, height - bandHeight, width, bandHeight);
  const paper = context.createLinearGradient(0, bandHeight, 0, height - bandHeight);
  paper.addColorStop(0, withAlpha(accentBright, 0.05));
  paper.addColorStop(1, withAlpha(accentDim, 0.03));
  context.fillStyle = paper;
  context.fillRect(0, bandHeight, width, height - bandHeight * 2);

  // The double-rule chapter frame.
  const center = width / 2;
  const frameWidth = Math.min(width * 0.6, 560);
  const frameTop = height * 0.2;
  const frameHeight = height * 0.56;
  context.strokeStyle = withAlpha(accentBright, 0.3);
  context.lineWidth = 2;
  context.strokeRect(center - frameWidth / 2, frameTop, frameWidth, frameHeight);
  context.lineWidth = 1;
  context.strokeRect(
    center - frameWidth / 2 + 9,
    frameTop + 9,
    frameWidth - 18,
    frameHeight - 18
  );

  // The chapter tracks the page section under the reader in deadpan snaps.
  const section = pageSectionAt(scroll);
  const chapter = Math.min(ROMAN.length - 1, section.index);
  context.fillStyle = withAlpha(accentBright, 0.5);
  context.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.letterSpacing = "6px";
  context.fillText(`CHAPTER ${ROMAN[chapter]}`, center, height * 0.42);
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.letterSpacing = "3px";
  context.fillStyle = withAlpha(accentBright, 0.32);
  context.fillText(section.label, center, height * 0.42 + 26);
  context.textAlign = "left";
  context.letterSpacing = "0px";

  // Mordecai banks a slow, unhurried circuit above the chapter frame.
  const orbit = time * 0.5;
  const falconX = center + Math.cos(orbit) * frameWidth * 0.42;
  const falconY = frameTop - 34 + Math.sin(orbit) * 20;
  const bank = Math.cos(orbit) * 0.35;
  context.save();
  context.translate(falconX, falconY);
  context.rotate(bank);
  context.strokeStyle = withAlpha(accentBright, 0.6);
  context.lineWidth = 2;
  context.lineCap = "round";
  const flap = Math.sin(time * 5) * 5;
  context.beginPath();
  context.moveTo(-14, -flap * 0.6);
  context.quadraticCurveTo(-6, -5, 0, 0);
  context.quadraticCurveTo(6, -5, 14, -flap * 0.6);
  context.stroke();
  context.fillStyle = withAlpha(accentBright, 0.55);
  context.beginPath();
  context.ellipse(0, 1, 4.5, 2.2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.lineWidth = 1;

  // Margot's record player spinning in the corner.
  const deckX = width * 0.12;
  const deckY = height * 0.78;
  const deckRadius = 32;
  context.strokeStyle = withAlpha(accentDim, 0.55);
  context.strokeRect(deckX - deckRadius - 12, deckY - deckRadius - 7, deckRadius * 2 + 40, deckRadius * 2 + 15);
  context.fillStyle = withAlpha(accentDim, 0.3);
  context.beginPath();
  context.arc(deckX, deckY, deckRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.35);
  for (let groove = 1; groove < 4; groove += 1) {
    context.beginPath();
    context.arc(deckX, deckY, (deckRadius * groove) / 4, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = withAlpha(accentBright, 0.6);
  context.beginPath();
  context.arc(deckX, deckY, 2.5, 0, Math.PI * 2);
  context.fill();
  const spin = time * 2.4;
  context.fillStyle = withAlpha(accentBright, 0.45);
  context.beginPath();
  context.arc(deckX + Math.cos(spin) * deckRadius * 0.7, deckY + Math.sin(spin) * deckRadius * 0.7, 1.6, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(accentBright, 0.55);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(deckX + deckRadius + 18, deckY - deckRadius * 0.65);
  context.lineTo(deckX + deckRadius * 0.45, deckY + deckRadius * 0.35);
  context.stroke();
  context.lineWidth = 1;
  context.fillStyle = withAlpha(accentBright, 0.5);
  context.beginPath();
  context.arc(deckX + deckRadius + 18, deckY - deckRadius * 0.65, 3.5, 0, Math.PI * 2);
  context.fill();

  drawFilmLabel(frame, "THE FAMILY ARCHIVE", center, height * 0.08, 0.48, "center");
  context.restore();
});
