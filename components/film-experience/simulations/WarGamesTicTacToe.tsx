"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  WarGamesKeyframes,
  WarGamesMuteButton,
  alphaFrom,
  fitCanvas,
  paintCrt,
  useWarGamesAudio,
  withAlpha,
} from "@/components/film-experience/simulations/WarGamesShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// The tic-tac-toe simulation. It keeps this path (the film record's dynamic
// import target since the launcher was built); the audio, keyframe and canvas
// kit it shares with the other two WarGames games lives in ./simulations.
//
// The film's thesis as a game: you play WOPR while it is still learning, it
// closes the gap round by round, and then you hand it the board and watch it
// play itself until the futility counter proves the point. Tic-tac-toe never
// stops being tic-tac-toe — it just stops being winnable.

type Mark = "X" | "O";
type Cell = Mark | null;
type Line = readonly [number, number, number];

const WINNING_LINES: readonly Line[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** Three operator rounds; WOPR's play sharpens each time. */
const ROUNDS = [
  { skill: 0.2, label: "naive" },
  { skill: 0.6, label: "learning" },
  { skill: 1, label: "perfect" },
] as const;

const WIN_POINTS = 300;
const DRAW_POINTS = 200;

/** Self-play: games per second at each throttle notch, and the target. */
const THROTTLE_RATES = [10, 22, 40, 70, 110] as const;
const TARGET_GAMES = 400;
/** Slots in the lattice WOPR runs its games across. */
const SLOT_COLS = 6;
const SLOT_ROWS = 3;
const SLOTS = SLOT_COLS * SLOT_ROWS;
/** Strain: notches above this heat the tube; a fault forces a cooldown. */
const SAFE_THROTTLE = 2;
const FAULT_COOLDOWN_MS = 1200;
const REPLY_DELAY_MS = 380;
const SCORE_ID = "wargames-tic-tac-toe";

type Phase = "operator" | "between" | "selfplay" | "fault" | "paused" | "learned";
type Outcome = "win" | "loss" | "draw";

const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);

function winningLine(board: readonly Cell[]): { mark: Mark; line: Line } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line };
  }
  return null;
}

// Memoized minimax: the same position is reached thousands of times once
// self-play is racing, so the table is what makes a hundred-games-per-second
// lattice affordable. Terminal scores use the ABSOLUTE number of marks on the
// board rather than search depth, so a position's value is a pure function of
// the position — which is what makes memoizing by position sound — while still
// ranking faster wins above slower ones.
const MEMO = new Map<string, number>();

function key(board: readonly Cell[], machineTurn: boolean) {
  let out = machineTurn ? "O" : "X";
  for (const cell of board) out += cell ?? ".";
  return out;
}

function filled(board: readonly Cell[]) {
  let count = 0;
  for (const cell of board) if (cell) count += 1;
  return count;
}

function score(board: Cell[], machineTurn: boolean): number {
  const found = winningLine(board);
  if (found) {
    const plies = filled(board);
    return found.mark === "O" ? 10 - plies : plies - 10;
  }
  if (board.every(Boolean)) return 0;

  const memoKey = key(board, machineTurn);
  const cached = MEMO.get(memoKey);
  if (cached !== undefined) return cached;

  let best = machineTurn ? -Infinity : Infinity;
  for (let index = 0; index < 9; index += 1) {
    if (board[index]) continue;
    board[index] = machineTurn ? "O" : "X";
    const candidate = score(board, !machineTurn);
    board[index] = null;
    best = machineTurn ? Math.max(best, candidate) : Math.min(best, candidate);
  }
  MEMO.set(memoKey, best);
  return best;
}

/** Every move that ties for optimal — the source of self-play's variety. */
function optimalMoves(board: readonly Cell[], machineTurn: boolean): number[] {
  const working = [...board];
  let best = machineTurn ? -Infinity : Infinity;
  let moves: number[] = [];
  for (let index = 0; index < 9; index += 1) {
    if (working[index]) continue;
    working[index] = machineTurn ? "O" : "X";
    const candidate = score(working, !machineTurn);
    working[index] = null;
    const better = machineTurn ? candidate > best : candidate < best;
    if (better) {
      best = candidate;
      moves = [index];
    } else if (candidate === best) {
      moves.push(index);
    }
  }
  return moves;
}

const pick = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

/**
 * WOPR's reply at a given skill. At skill 1 it is the memoized optimum. Below
 * that it still takes a win on the board and (from 0.5) still blocks yours —
 * it plays like something that has learned the rules but not yet the futility.
 */
function machineReply(board: readonly Cell[], skill: number): number {
  const open = board.map((cell, index) => (cell ? -1 : index)).filter((i) => i >= 0);
  if (open.length === 0) return -1;

  const immediate = (mark: Mark) => {
    for (const index of open) {
      const trial = [...board];
      trial[index] = mark;
      if (winningLine(trial)) return index;
    }
    return -1;
  };

  const win = immediate("O");
  if (win >= 0) return win;
  if (skill >= 0.5) {
    const block = immediate("X");
    if (block >= 0) return block;
  }
  if (Math.random() < skill) return pick(optimalMoves(board, true));
  return pick(open);
}

/** One self-play game as a move list; perfect on both sides, so always a draw. */
function perfectGame(): number[] {
  const board = emptyBoard();
  const moves: number[] = [];
  let machineTurn = false;
  for (let turn = 0; turn < 9; turn += 1) {
    const options = optimalMoves(board, machineTurn);
    const index = pick(options);
    board[index] = machineTurn ? "O" : "X";
    moves.push(index);
    machineTurn = !machineTurn;
    if (winningLine(board)) break;
  }
  return moves;
}

type Slot = { moves: number[]; step: number; flash: number };

const newSlot = (): Slot => ({ moves: perfectGame(), step: 0, flash: 0 });

function DrawSeeker() {
  const [phase, setPhase] = useState<Phase>("operator");
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [thinking, setThinking] = useState(false);
  const [scoreValue, setScoreValue] = useState(0);
  const [games, setGames] = useState(0);
  const [throttle, setThrottle] = useState(1);
  const [strain, setStrain] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useWarGamesAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const replyTimerRef = useRef(0);
  const faultTimerRef = useRef(0);
  const phaseRef = useRef<Phase>("operator");
  const throttleRef = useRef(1);
  const strainRef = useRef(0);
  const gamesRef = useRef(0);
  const scoreRef = useRef(0);
  const slotsRef = useRef<Slot[]>([]);
  const ghostsRef = useRef<{ index: number; mark: Mark }[]>([]);
  const boardRectRef = useRef({ x: 0, y: 0, size: 0 });
  const shakeUntilRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    throttleRef.current = throttle;
  }, [throttle]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const clearTimers = useCallback(() => {
    if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
    if (faultTimerRef.current) window.clearTimeout(faultTimerRef.current);
    replyTimerRef.current = 0;
    faultTimerRef.current = 0;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // The floating score note retires itself so reduced motion (which has no
  // fade-out animation) doesn't leave it pinned to the stage.
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 1400);
    return () => window.clearTimeout(timer);
  }, [note]);

  const settle = useCallback(
    (next: Cell[], result: Outcome, found: Line | null) => {
      setOutcome(result);
      setLine(found);
      setThinking(false);
      setPhase("between");
      // Every mark played stays on the tube as a ghost for the games after it.
      ghostsRef.current = [
        ...ghostsRef.current,
        ...next.flatMap((mark, index) => (mark ? [{ index, mark }] : [])),
      ].slice(-54);
      const gained = result === "win" ? WIN_POINTS : result === "draw" ? DRAW_POINTS : 0;
      if (gained > 0) {
        scoreRef.current += gained;
        setScoreValue(scoreRef.current);
        setNote({ id: performance.now(), text: `+${gained}` });
      }
      if (result === "win") audio.play({ freq: 660, slideTo: 990, duration: 0.3, gain: 0.06 });
      else if (result === "draw") audio.play({ freq: 330, duration: 0.35, gain: 0.05 });
      else {
        audio.play({ freq: 180, slideTo: 90, duration: 0.4, gain: 0.06 });
        shakeUntilRef.current = performance.now() + 320;
      }
      window.requestAnimationFrame(() => primaryRef.current?.focus());
    },
    [audio]
  );

  const resolve = useCallback(
    (next: Cell[]): boolean => {
      const found = winningLine(next);
      if (found) {
        settle(next, found.mark === "X" ? "win" : "loss", found.line);
        return true;
      }
      if (next.every(Boolean)) {
        settle(next, "draw", null);
        return true;
      }
      return false;
    },
    [settle]
  );

  const choose = useCallback(
    (index: number) => {
      if (phaseRef.current !== "operator" || board[index] || thinking) return;
      audio.unlock();
      const next = [...board];
      next[index] = "X";
      setBoard(next);
      audio.play({ freq: 520, duration: 0.09, gain: 0.05 });
      if (resolve(next)) return;

      setThinking(true);
      const skill = ROUNDS[round].skill;
      const reply = () => {
        const answered = [...next];
        const move = machineReply(answered, skill);
        if (move >= 0) answered[move] = "O";
        setBoard(answered);
        setThinking(false);
        audio.play({ freq: 300, duration: 0.09, gain: 0.05 });
        resolve(answered);
      };
      if (reducedRef.current) reply();
      else replyTimerRef.current = window.setTimeout(reply, REPLY_DELAY_MS);
    },
    [audio, board, resolve, round, thinking]
  );

  const startRound = useCallback((index: number) => {
    clearTimers();
    setBoard(emptyBoard());
    setOutcome(null);
    setLine(null);
    setThinking(false);
    setRound(index);
    setPhase("operator");
  }, [clearTimers]);

  const beginSelfPlay = useCallback(() => {
    clearTimers();
    slotsRef.current = Array.from({ length: SLOTS }, newSlot);
    gamesRef.current = 0;
    strainRef.current = 0;
    setGames(0);
    setStrain(0);
    setThrottle(1);
    setPhase("selfplay");
    audio.play({ freq: 220, slideTo: 440, duration: 0.35, gain: 0.05 });
    window.requestAnimationFrame(() => primaryRef.current?.focus());
  }, [audio, clearTimers]);

  const restart = useCallback(() => {
    clearTimers();
    ghostsRef.current = [];
    scoreRef.current = 0;
    gamesRef.current = 0;
    strainRef.current = 0;
    setScoreValue(0);
    setGames(0);
    setStrain(0);
    setThrottle(1);
    setNote(null);
    startRound(0);
  }, [clearTimers, startRound]);

  const nudgeThrottle = useCallback(
    (delta: number) => {
      if (phaseRef.current !== "selfplay") return;
      audio.unlock();
      setThrottle((value) => {
        const next = Math.min(THROTTLE_RATES.length, Math.max(1, value + delta));
        if (next !== value) {
          audio.play({ freq: 380 + next * 90, duration: 0.07, gain: 0.04 });
        }
        return next;
      });
    },
    [audio]
  );

  const togglePause = useCallback(() => {
    setPhase((value) => {
      if (value === "selfplay") return "paused";
      if (value === "paused") return "selfplay";
      return value;
    });
  }, []);

  const learned = useCallback(() => {
    setPhase("learned");
    scoreRef.current += 500;
    setScoreValue(scoreRef.current);
    recordSimulationScore(SCORE_ID, scoreRef.current);
    audio.play({ freq: 523, duration: 0.3, gain: 0.06 });
    audio.play({ freq: 392, duration: 0.5, gain: 0.06, delay: 0.16 });
    window.requestAnimationFrame(() => primaryRef.current?.focus());
  }, [audio]);

  // Cache the operator board's position inside the stage so the canvas can
  // ghost previous games exactly under the live one.
  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      const grid = boardRef.current;
      if (!stage || !grid) return;
      const a = stage.getBoundingClientRect();
      const b = grid.getBoundingClientRect();
      boardRectRef.current = { x: b.left - a.left, y: b.top - a.top, size: b.width };
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase]);

  // One rAF loop owns the whole stage: the CRT wash, the ghost marks under the
  // operator board, and the self-play lattice with its strain and faults.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let { width, height } = fitCanvas(canvas);
    const resize = () => {
      const next = fitCanvas(canvas);
      width = next.width;
      height = next.height;
    };
    window.addEventListener("resize", resize);

    let last = performance.now();
    let carry = 0;

    // Sampled once: the grade cannot change while a simulation dialog is open,
    // and reading CSS custom properties inside a frame forces a style recalc
    // of the whole page — which is enough to starve the loop on its own.
    const palette = getLiveThemePalette();
    const acc = alphaFrom(palette);

    const paintGhosts = () => {
      const { x, y, size } = boardRectRef.current;
      if (size <= 0) return;
      const cell = size / 3;
      context.strokeStyle = acc(0.12);
      context.lineWidth = 1;
      for (const ghost of ghostsRef.current) {
        const cx = x + (ghost.index % 3) * cell + cell / 2;
        const cy = y + Math.floor(ghost.index / 3) * cell + cell / 2;
        const r = cell * 0.22;
        context.beginPath();
        if (ghost.mark === "X") {
          context.moveTo(cx - r, cy - r);
          context.lineTo(cx + r, cy + r);
          context.moveTo(cx + r, cy - r);
          context.lineTo(cx - r, cy + r);
        } else {
          context.arc(cx, cy, r, 0, Math.PI * 2);
        }
        context.stroke();
      }
    };

    const paintLattice = (now: number) => {
      const slots = slotsRef.current;
      const padX = 10;
      const padY = 10;
      const cellW = (width - padX * 2) / SLOT_COLS;
      const cellH = (height - padY * 2) / SLOT_ROWS;
      const size = Math.min(cellW, cellH) * 0.82;
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const col = i % SLOT_COLS;
        const row = Math.floor(i / SLOT_COLS);
        const ox = padX + col * cellW + (cellW - size) / 2;
        const oy = padY + row * cellH + (cellH - size) / 2;
        const unit = size / 3;

        const fresh = Math.max(0, 1 - (now - slot.flash) / 420);
        context.strokeStyle = acc(0.16 + fresh * 0.5);
        context.lineWidth = 1;
        for (let g = 1; g < 3; g += 1) {
          context.beginPath();
          context.moveTo(ox + g * unit, oy);
          context.lineTo(ox + g * unit, oy + size);
          context.moveTo(ox, oy + g * unit);
          context.lineTo(ox + size, oy + g * unit);
          context.stroke();
        }

        context.lineWidth = 1.6;
        for (let m = 0; m < slot.step; m += 1) {
          const index = slot.moves[m];
          const isX = m % 2 === 0;
          const cx = ox + (index % 3) * unit + unit / 2;
          const cy = oy + Math.floor(index / 3) * unit + unit / 2;
          const r = unit * 0.26;
          // Newest mark burns brightest, then decays into the phosphor.
          const age = slot.step - m;
          context.strokeStyle =
            age <= 1 ? palette.bright : acc(Math.max(0.25, 0.85 - age * 0.08));
          context.beginPath();
          if (isX) {
            context.moveTo(cx - r, cy - r);
            context.lineTo(cx + r, cy + r);
            context.moveTo(cx + r, cy - r);
            context.lineTo(cx - r, cy + r);
          } else {
            context.arc(cx, cy, r, 0, Math.PI * 2);
          }
          context.stroke();
        }

        if (fresh > 0) {
          context.fillStyle = withAlpha(palette.bright, fresh * 0.16);
          context.fillRect(ox - 3, oy - 3, size + 6, size + 6);
          context.fillStyle = withAlpha(palette.bright, fresh);
          context.font = `${Math.round(size * 0.2)}px monospace`;
          context.textAlign = "center";
          context.fillText("DRAW", ox + size / 2, oy + size + unit * 0.34);
          context.textAlign = "left";
        }
      }
    };

    const advance = (dt: number) => {
      const live = phaseRef.current === "selfplay";
      if (!live) return;
      const rate = THROTTLE_RATES[throttleRef.current - 1];
      // Nine reveals per game, spread round-robin across the lattice.
      carry += (rate * 9 * dt) / 1000;
      let steps = Math.floor(carry);
      carry -= steps;
      steps = Math.min(steps, 400);
      const slots = slotsRef.current;
      const now = performance.now();
      let completed = 0;
      for (let s = 0; s < steps; s += 1) {
        const slot = slots[s % slots.length];
        slot.step += 1;
        if (slot.step >= slot.moves.length) {
          completed += 1;
          slot.flash = now;
          slot.moves = perfectGame();
          slot.step = 0;
        }
      }
      if (completed > 0) {
        gamesRef.current = Math.min(TARGET_GAMES, gamesRef.current + completed);
        scoreRef.current += completed * 5 * throttleRef.current;
        setGames(gamesRef.current);
        setScoreValue(scoreRef.current);
        if (gamesRef.current >= TARGET_GAMES) {
          learned();
          return;
        }
      }
      // Strain: pushing past the safe notch heats the tube; backing off cools it.
      const over = throttleRef.current - SAFE_THROTTLE;
      const before = Math.round(strainRef.current * 100);
      strainRef.current = Math.max(
        0,
        Math.min(1, strainRef.current + (over > 0 ? over * 0.1 : -0.4) * (dt / 1000))
      );
      // Only re-render when the gauge would actually move a whole percent.
      const after = Math.round(strainRef.current * 100);
      if (after !== before) setStrain(strainRef.current);
      if (strainRef.current >= 1) {
        strainRef.current = 0;
        setStrain(0);
        // A fault drops the tube to the safe notch, not to a standstill: the
        // run keeps making progress while the operator decides to push again.
        setThrottle(SAFE_THROTTLE);
        setPhase("fault");
        shakeUntilRef.current = now + 400;
        audio.play({ freq: 140, slideTo: 70, duration: 0.5, gain: 0.06 });
        faultTimerRef.current = window.setTimeout(() => {
          faultTimerRef.current = 0;
          setPhase((value) => (value === "fault" ? "selfplay" : value));
        }, FAULT_COOLDOWN_MS);
      }
    };

    const paint = (now: number) => {
      paintCrt(context, width, height, reducedRef.current ? 0 : now, palette);
      const live = phaseRef.current;
      if (live === "operator" || live === "between") {
        paintGhosts();
      } else {
        paintLattice(now);
        if (live === "fault") {
          // Thermal fault: the tube tears into bright bands for the cooldown.
          context.fillStyle = acc(0.1);
          for (let i = 0; i < 6; i += 1) {
            const y = ((now / 6) + i * (height / 6)) % height;
            context.fillRect(0, y, width, 4);
          }
        }
      }
    };

    if (reducedMotion) {
      // No motion loop. A slow beat redraws the frozen frame — the CRT sweep is
      // pinned, nothing animates — so the lattice keeps up with the counter and
      // the stage can never be caught blank by a paint that landed before the
      // dialog was laid out.
      const redraw = () => {
        if (document.hidden) return;
        if (phaseRef.current === "selfplay") advance(250);
        resize();
        paint(0);
      };
      redraw();
      const interval = window.setInterval(redraw, 250);
      // A resize re-fits (and so clears) the canvas; with no loop to cover for
      // it, the reduced-motion path has to repaint on the same event.
      window.addEventListener("resize", redraw);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("resize", redraw);
        window.removeEventListener("resize", resize);
      };
    }

    let frame = 0;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(60, now - last);
      last = now;
      if (!document.hidden) {
        advance(dt);
        paint(now);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [audio, learned, phase, reducedMotion]);

  const status = useMemo(() => {
    if (phase === "learned")
      return `A strange game. ${TARGET_GAMES} games, no winner — ${scoreValue} points banked.`;
    if (phase === "fault") return "Thermal fault. The tube is cooling; throttle reset.";
    if (phase === "paused") return "Self-play held. The counter is frozen.";
    if (phase === "selfplay")
      return `WOPR is playing itself. Push the throttle to learn faster — past notch ${SAFE_THROTTLE} the tube strains.`;
    if (phase === "between") {
      if (outcome === "win") return "Operator wins. WOPR logs the pattern and adjusts.";
      if (outcome === "loss") return "Simulation wins. It has seen that shape before.";
      return "Draw confirmed. No winning move remained.";
    }
    if (thinking) return "WOPR is computing a reply…";
    if (board.every((cell) => !cell))
      return `Game ${round + 1} of ${ROUNDS.length}. You are X — take a cell. WOPR plays ${ROUNDS[round].label}.`;
    return "Draw-seeking simulation in progress.";
  }, [board, outcome, phase, round, scoreValue, thinking]);

  const roundsLeft = round + 1 < ROUNDS.length;
  const inSelfPlay = phase === "selfplay" || phase === "paused" || phase === "fault";
  const shaking = !reducedMotion && (outcome === "loss" || phase === "fault");

  return (
    <div
      data-sim-state={phase}
      data-ttt-round={round + 1}
      data-ttt-score={scoreValue}
      data-ttt-games={games}
      data-ttt-throttle={throttle}
      data-simulation-moves={board.filter(Boolean).length}
      className="flex flex-col gap-3"
    >
      <WarGamesKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          game <span className="text-accent">{round + 1}</span>/{ROUNDS.length}
        </span>
        <span>
          wopr <span className="text-accent">{inSelfPlay || phase === "learned" ? "self-play" : ROUNDS[round].label}</span>
        </span>
        <span>
          score{" "}
          <span key={scoreValue} className={reducedMotion ? "text-accent" : "wg-anim-pop text-accent"}>
            {scoreValue}
          </span>
        </span>
        {(inSelfPlay || phase === "learned") && (
          <>
            <span>
              no winning move <span className="text-accent-bright">{games}</span>/{TARGET_GAMES}
            </span>
            <span aria-label={`Throttle notch ${throttle} of ${THROTTLE_RATES.length}`}>
              throttle{" "}
              <span className="text-accent">
                {"▮".repeat(throttle)}
                <span className="text-white/25">{"▯".repeat(THROTTLE_RATES.length - throttle)}</span>
              </span>
            </span>
          </>
        )}
        <span className="ml-auto flex gap-2">
          <WarGamesMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "selfplay" || phase === "paused") && (
            <button
              type="button"
              onClick={togglePause}
              className="border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* Stage: CRT canvas, with the operator board laid over it. */}
      <div
        ref={stageRef}
        className="relative h-56 overflow-hidden border border-accent/25 sm:h-72"
        style={{ animation: shaking ? "wg-shake 320ms ease-in-out" : undefined }}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {!inSelfPlay && phase !== "learned" && (
          <div className="absolute inset-0 grid place-items-center p-2">
            <div
              ref={boardRef}
              role="group"
              aria-label="Tic-tac-toe board"
              className="grid aspect-square h-full max-h-full grid-cols-3"
            >
              {board.map((mark, index) => {
                const won = line?.includes(index) ?? false;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Cell ${index + 1} ${mark ?? "empty"}`}
                    disabled={Boolean(mark) || phase !== "operator" || thinking}
                    onClick={() => choose(index)}
                    className={`border border-accent/30 text-xl transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-2xl ${
                      won
                        ? "bg-accent/25 text-accent-bright"
                        : mark
                          ? "text-accent"
                          : "text-accent hover:bg-accent/10 disabled:text-white/40"
                    } disabled:cursor-default`}
                  >
                    <span className={mark && !reducedMotion ? "wg-anim-pop" : undefined}>
                      {mark ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "learned" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4 text-center">
            <p className={reducedMotion ? "" : "wg-anim-rise"}>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-white/50">
                Winner: none
              </span>
              <span className="mt-2 block text-sm normal-case leading-relaxed text-accent-bright sm:text-base">
                The only winning move is not to play.
              </span>
            </p>
          </div>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}

        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-[11px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "wg-anim-float"
            }`}
          >
            {note.text}
          </p>
        )}
      </div>

      {/* Strain gauge — self-play only. Labelled, not colour-only. */}
      {inSelfPlay && (
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-white/45">
          <span className="shrink-0">tube strain {Math.round(strain * 100)}%</span>
          <div className="h-1.5 flex-1 bg-white/10" aria-hidden>
            <div
              className={strain > 0.7 ? "h-full bg-accent-bright" : "h-full bg-accent/80"}
              style={{ width: `${Math.round(strain * 100)}%` }}
            />
          </div>
          {phase === "fault" && (
            <span className={`shrink-0 text-accent-bright ${reducedMotion ? "" : "wg-anim-blink"}`}>
              fault
            </span>
          )}
        </div>
      )}

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "operator" && (
          <button
            type="button"
            onClick={beginSelfPlay}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Let it play itself
          </button>
        )}

        {phase === "between" && (
          <>
            {roundsLeft && (
              <button
                ref={primaryRef}
                type="button"
                onClick={() => startRound(round + 1)}
                className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Play game {round + 2}
              </button>
            )}
            <button
              ref={roundsLeft ? undefined : primaryRef}
              type="button"
              onClick={beginSelfPlay}
              className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Let it play itself
            </button>
          </>
        )}

        {inSelfPlay && (
          <>
            <button
              ref={primaryRef}
              type="button"
              onClick={() => nudgeThrottle(1)}
              disabled={throttle >= THROTTLE_RATES.length || phase !== "selfplay"}
              className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Push throttle
            </button>
            <button
              type="button"
              onClick={() => nudgeThrottle(-1)}
              disabled={throttle <= 1 || phase !== "selfplay"}
              className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Ease off
            </button>
          </>
        )}

        {phase === "learned" && (
          <button
            ref={primaryRef}
            type="button"
            onClick={restart}
            className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Run it again
          </button>
        )}

        <button
          type="button"
          onClick={restart}
          className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Reset simulation
        </button>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function WarGamesTicTacToe({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="wargames-simulation-title"
      gameId="wargames-tic-tac-toe"
      eyebrow="Draw-seeking simulation"
      title="JXN-83 tic-tac-toe simulation"
      startLabel="Play a game"
      stage
      howToPlay={{
        objective:
          "Play WOPR through three games as it sharpens, then hand it the board and run it to the futility count.",
        controls: [
          { keys: "click", does: "place your mark on a cell of the board" },
          { keys: "self-play", does: "hand the board over and let WOPR play itself" },
          { keys: "throttle", does: "push or ease how many games a second it runs" },
          { keys: "pause", does: "hold the self-play run where it is" },
        ],
        tip: "Pointer and Tab only — the board has no hotkeys. Past the second throttle notch the tube heats, and a fault forces a cooldown, so the fastest run is the one that keeps strain off the gauge.",
      }}
      reference={{
        quote: "Shall we play a game?",
        scene: "WarGames (1983) · WOPR playing itself to a standstill",
      }}
      onClose={onClose}
    >
      <DrawSeeker />
    </SimulationShell>
  );
}
