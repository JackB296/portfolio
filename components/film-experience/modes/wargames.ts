import { drawFilmLabel, hash, makeStatefulFilmVisual, withAlpha } from "../shared";
import type { FilmFrame } from "@/lib/filmExperienceTypes";

export default makeStatefulFilmVisual(() => {
  // Joshua types from the moment the mode activates, not page load.
  let lastFrameAt = -Infinity;
  let typingStartedAt = 0;

  const draw = (frame: FilmFrame) => {
  const { context, width, height, time, accentBright } = frame;
  if (time - lastFrameAt > 1) typingStartedAt = time;
  lastFrameAt = time;
  const typingTime = time - typingStartedAt;
  context.save();

  context.strokeStyle = withAlpha(accentBright, 0.12);
  for (let x = 0; x < width; x += 28) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y < height; y += 28) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }

  // Joshua types its greeting once per load, then leaves the cursor lit.
  const lines = ["GREETINGS PROFESSOR FALKEN.", "SHALL WE PLAY A GAME?"];
  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  let budget = Math.floor(typingTime * 9);
  let cursorX = 24;
  let cursorY = 64;
  lines.forEach((line, index) => {
    const shown = line.slice(0, Math.max(0, budget));
    budget -= line.length + 3;
    context.fillStyle = withAlpha(accentBright, 0.5);
    context.fillText(shown, 24, 64 + index * 20);
    if (shown.length > 0 && shown.length < line.length) {
      cursorX = 24 + context.measureText(shown).width + 3;
      cursorY = 64 + index * 20;
    } else if (shown.length === line.length) {
      cursorX = 24 + context.measureText(shown).width + 3;
      cursorY = 64 + index * 20;
    }
  });
  if (Math.floor(time * 2.5) % 2 === 0) {
    context.fillStyle = withAlpha(accentBright, 0.5);
    context.fillRect(cursorX, cursorY - 11, 8, 13);
  }
  if (typingTime > 9) {
    context.fillStyle = withAlpha(accentBright, 0.28);
    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("> HOW ABOUT A NICE GAME OF CHESS?", 24, 64 + lines.length * 20);
  }

  // The WOPR globe: wireframe vector world, 125 dots, trajectories arcing out.
  const globeX = width * 0.34;
  const globeY = height * 0.48;
  const radius = Math.min(width, height) * 0.22;
  context.strokeStyle = withAlpha(accentBright, 0.32);
  context.lineWidth = 1;
  context.beginPath();
  context.arc(globeX, globeY, radius, 0, Math.PI * 2);
  context.stroke();
  for (let latitude = -2; latitude <= 2; latitude += 1) {
    context.beginPath();
    context.ellipse(globeX, globeY, radius, radius * Math.abs(latitude / 3), 0, 0, Math.PI * 2);
    context.stroke();
  }
  for (let longitude = 0; longitude < 4; longitude += 1) {
    context.beginPath();
    context.ellipse(globeX, globeY, radius * (0.18 + longitude * 0.2), radius, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = withAlpha(accentBright, 0.52);
  for (let dot = 0; dot < 125; dot += 1) {
    const angle = hash(dot, 81) * Math.PI * 2;
    const distance = Math.sqrt(hash(dot, 82)) * radius * 0.96;
    context.fillRect(globeX + Math.cos(angle) * distance, globeY + Math.sin(angle) * distance, 1.2, 1.2);
  }
  context.strokeStyle = withAlpha(accentBright, 0.45);
  for (let arc = 0; arc < 6; arc += 1) {
    const angle = time * 0.08 + arc * Math.PI / 3;
    context.beginPath();
    context.moveTo(globeX + Math.cos(angle) * radius * 0.3, globeY + Math.sin(angle) * radius * 0.3);
    context.quadraticCurveTo(width * 0.58, height * (0.22 + arc * 0.09), width * 0.76, height * (0.16 + arc * 0.12));
    context.stroke();
  }

  // DEFCON steps down as the reader descends the page.
  const root = typeof document === "undefined" ? null : document.documentElement;
  const travel = root ? Math.max(1, root.scrollHeight - window.innerHeight) : 1;
  const depth = root ? Math.min(1, frame.scroll / travel) : 0;
  const activeLevel = Math.min(4, Math.floor(depth * 5));
  const ladderX = width - 150;
  const ladderY = height * 0.26;
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  for (let level = 0; level < 5; level += 1) {
    const boxY = ladderY + level * 31;
    const on = level === activeLevel;
    const alarm = on && activeLevel === 4 && Math.floor(time * 4) % 2 === 0;
    context.strokeStyle = withAlpha(accentBright, on ? 0.6 : 0.2);
    context.fillStyle = withAlpha(accentBright, on ? (alarm ? 0.04 : 0.16) : 0.02);
    context.fillRect(ladderX, boxY, 110, 23);
    context.strokeRect(ladderX, boxY, 110, 23);
    context.fillStyle = withAlpha(accentBright, on ? 0.8 : 0.3);
    context.fillText(`DEFCON ${5 - level}`, ladderX + 55, boxY + 15);
  }
  context.textAlign = "left";

  // The acoustic coupler, carrier tone shivering.
  const modemX = width * 0.32;
  const modemY = height - 96;
  context.strokeStyle = withAlpha(accentBright, 0.45);
  context.fillStyle = withAlpha(accentBright, 0.06);
  context.beginPath();
  context.roundRect(modemX - 48, modemY - 10, 96, 27, 5);
  context.fill();
  context.stroke();
  for (const side of [-1, 1]) {
    context.beginPath();
    context.ellipse(modemX + side * 30, modemY - 12, 13, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.strokeStyle = withAlpha(accentBright, 0.4);
  context.beginPath();
  context.moveTo(modemX - 30, modemY - 20);
  context.quadraticCurveTo(modemX, modemY - 36, modemX + 30, modemY - 20);
  context.stroke();
  for (let bar = 0; bar < 16; bar += 1) {
    const level = Math.abs(Math.sin(bar * 1.3 + time * 8)) * (hash(bar + Math.floor(time * 3), 4) > 0.3 ? 10 : 3);
    context.fillStyle = withAlpha(accentBright, 0.45);
    context.fillRect(modemX - 38 + bar * 5, modemY + 26 - level, 2.5, Math.max(level, 1));
  }
  drawFilmLabel(frame, "CONNECT 300", modemX - 38, modemY + 42, 0.3);

  // Joshua's games, on 8-inch floppy.
  const diskX = width - 76;
  const diskY = height * 0.62;
  context.save();
  context.translate(diskX, diskY);
  context.rotate(Math.sin(time * 0.4) * 0.04);
  context.fillStyle = withAlpha(accentBright, 0.05);
  context.strokeStyle = withAlpha(accentBright, 0.5);
  context.fillRect(-32, -35, 64, 70);
  context.strokeRect(-32, -35, 64, 70);
  context.beginPath();
  context.arc(0, 7, 10, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(0, 7, 2.8, 0, Math.PI * 2);
  context.stroke();
  context.strokeRect(-5, 24, 10, 10);
  context.fillStyle = withAlpha(accentBright, 0.1);
  context.fillRect(-26, -31, 52, 20);
  context.strokeStyle = withAlpha(accentBright, 0.3);
  context.strokeRect(-26, -31, 52, 20);
  context.font = "6px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = withAlpha(accentBright, 0.55);
  context.fillText("GAMES:", -22, -24);
  context.fillText("TIC-TAC-TOE / G.T.W.", -22, -16);
  const writing = Math.floor(time * 3) % 3 === 0;
  context.fillStyle = `rgba(255, 90, 90, ${writing ? 0.8 : 0.2})`;
  context.beginPath();
  context.arc(25, 28, 2.6, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // The only winning move: the board stays.
  const boardX = width - 120;
  const boardY = height - 120;
  const cell = 26;
  context.strokeStyle = withAlpha(accentBright, 0.45);
  context.beginPath();
  for (let line = 1; line < 3; line += 1) {
    context.moveTo(boardX + line * cell, boardY);
    context.lineTo(boardX + line * cell, boardY + cell * 3);
    context.moveTo(boardX, boardY + line * cell);
    context.lineTo(boardX + cell * 3, boardY + line * cell);
  }
  context.stroke();
  drawFilmLabel(frame, "JXN-83 / 1983 / CPU 8080", 22, 28, 0.5);
  drawFilmLabel(frame, "WOPR / SIMULATION 22%", width - 22, 28, 0.44, "right");
  drawFilmLabel(frame, "TIC-TAC-TOE", boardX + cell * 1.5, boardY - 10, 0.44, "center");
  context.restore();
  };

  return { draw };
});
