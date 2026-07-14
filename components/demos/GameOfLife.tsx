"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT } from "@/lib/theme";

// Conway's Game of Life, faithful to the original life.py: toroidal wrap,
// random 20% seed, and age based coloring (newborn, young, old).
const CELL = 11;

export default function GameOfLife() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(12); // generations per second
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const stepRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let cols = 0, rows = 0;
    let grid: Uint8Array = new Uint8Array(0);
    let age: Int16Array = new Int16Array(0);

    const seed = () => {
      grid = new Uint8Array(cols * rows);
      age = new Int16Array(cols * rows);
      for (let i = 0; i < grid.length; i++) {
        if (Math.random() < 0.2) { grid[i] = 1; age[i] = 1; }
      }
    };

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      const h = Math.round(w * 0.62);
      canvas.width = w;
      canvas.height = h;
      cols = Math.floor(w / CELL);
      rows = Math.floor(h / CELL);
      seed();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resetRef.current = seed;

    const at = (x: number, y: number) => grid[((y + rows) % rows) * cols + ((x + cols) % cols)];

    const step = () => {
      const next = new Uint8Array(grid.length);
      const nextAge = new Int16Array(grid.length);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              if (dx || dy) n += at(x + dx, y + dy);
          const idx = y * cols + x;
          const alive = grid[idx] === 1;
          if (alive && (n === 2 || n === 3)) { next[idx] = 1; nextAge[idx] = age[idx] + 1; }
          else if (!alive && n === 3) { next[idx] = 1; nextAge[idx] = 1; }
          else { next[idx] = 0; nextAge[idx] = 0; }
        }
      }
      grid = next;
      age = nextAge;
    };
    stepRef.current = step;

    const draw = () => {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          if (!grid[idx]) continue;
          const a = age[idx];
          ctx.fillStyle = a === 1 ? "#34d399" : a < 5 ? ACCENT : "#f472b6";
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    };

    // Click / drag to toggle (paint) cells.
    let painting = false;
    const paint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * cols);
      const y = Math.floor(((e.clientY - r.top) / r.height) * rows);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const idx = y * cols + x;
      grid[idx] = 1;
      age[idx] = 1;
    };
    const onDown = (e: PointerEvent) => { painting = true; paint(e); };
    const onMove = (e: PointerEvent) => { if (painting) paint(e); };
    const onUp = () => (painting = false);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (runningRef.current) {
        acc += dt;
        const interval = 1 / speedRef.current;
        while (acc >= interval) { step(); acc -= interval; }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
        <canvas ref={canvasRef} className="block w-full touch-none select-none" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setRunning((v) => !v)}
          className="rounded-full bg-accent px-5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent-bright"
        >
          {running ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => stepRef.current()}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent/50 hover:text-white"
        >
          Step
        </button>
        <button
          onClick={() => resetRef.current()}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent/50 hover:text-white"
        >
          Reset
        </button>
        <label className="flex items-center gap-2 font-mono text-xs text-white/50">
          Speed
          <input
            type="range"
            min={1}
            max={30}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-white/60">
        Click or drag on the grid to draw cells. Green is newborn, blue is young, pink is old.
      </p>
    </div>
  );
}
