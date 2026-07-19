"use client";

import { useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Mark = "X" | "O";
type Cell = Mark | null;

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);

function winner(board: readonly Cell[]) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function minimax(board: Cell[], machineTurn: boolean): number {
  const result = winner(board);
  if (result === "O") return 10;
  if (result === "X") return -10;
  if (board.every(Boolean)) return 0;

  let score = machineTurn ? -Infinity : Infinity;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index]) continue;
    board[index] = machineTurn ? "O" : "X";
    const candidate = minimax(board, !machineTurn);
    board[index] = null;
    score = machineTurn ? Math.max(score, candidate) : Math.min(score, candidate);
  }
  return score;
}

function machineMove(board: readonly Cell[]) {
  let bestIndex = -1;
  let bestScore = -Infinity;
  const order = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const index of order) {
    if (board[index]) continue;
    const candidate = [...board];
    candidate[index] = "O";
    const score = minimax(candidate, false);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }
  return bestIndex;
}

type WarGamesSimulationProps = {
  onClose: () => void;
};

export default function WarGamesSimulation({ onClose }: WarGamesSimulationProps) {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const outcome = winner(board);
  const complete = Boolean(outcome) || board.every(Boolean);
  const moves = board.filter(Boolean).length;

  const status = useMemo(() => {
    if (outcome === "X") return "Operator path wins.";
    if (outcome === "O") return "Simulation path wins. Reset to compare another sequence.";
    if (complete) return "Draw confirmed. No winning path remains.";
    return moves === 0 ? "Choose a cell. You are X." : "Draw-seeking simulation in progress.";
  }, [complete, moves, outcome]);

  useFocusTrap(dialogRef, true, onClose, closeRef);

  const choose = (index: number) => {
    if (board[index] || complete) return;
    const next = [...board];
    next[index] = "X";
    if (!winner(next) && next.some((cell) => !cell)) {
      const reply = machineMove(next);
      if (reply >= 0) next[reply] = "O";
    }
    setBoard(next);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wargames-simulation-title"
        className="w-full max-w-sm border border-accent/40 bg-ink/95 p-4 font-mono text-accent shadow-2xl shadow-black/60"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Draw-seeking simulation</p>
            <h2 id="wargames-simulation-title" className="mt-1 text-sm uppercase tracking-[0.12em]">
              JXN-83 tic-tac-toe simulation
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close simulation" className="px-2 py-1 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            esc
          </button>
        </div>

        <div className="mx-auto grid aspect-square w-full max-w-[15rem] grid-cols-3" data-simulation-moves={moves}>
          {board.map((mark, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Cell ${index + 1} ${mark ?? "empty"}`}
              disabled={Boolean(mark) || complete}
              onClick={() => choose(index)}
              className="border border-accent/30 text-2xl text-accent transition-colors hover:bg-accent/10 disabled:cursor-default disabled:text-white/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {mark ?? ""}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
          <p role="status" className="text-white/55">{status}</p>
          <button type="button" onClick={() => setBoard(emptyBoard())} className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Reset simulation
          </button>
        </div>
      </div>
    </div>
  );
}
