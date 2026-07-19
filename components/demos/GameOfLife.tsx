"use client";

import useDemoCanvas from "./useDemoCanvas";
import { DemoButton, DemoCaption, DemoFrame } from "./chrome";

// Conway's Game of Life, faithful to the original life.py: toroidal wrap,
// random 20% seed, and age based coloring (newborn, young, old).
const CELL = 11;
const DEFAULT_SPEED = 12; // generations per second

type GameOfLifeApi = {
  step: () => void;
  reset: () => void;
  setSpeed: (genPerSec: number) => void;
};

export default function GameOfLife() {
  const demo = useDemoCanvas<GameOfLifeApi>((ctx, canvas, controls) => {
    let W = 1, H = 1;
    let cols = 0, rows = 0;
    let grid: Uint8Array = new Uint8Array(0);
    let age: Int16Array = new Int16Array(0);
    // The single source of truth for speed; the (uncontrolled) slider
    // writes through api.setSpeed.
    let genPerSec = DEFAULT_SPEED;
    let acc = 0;

    const seed = () => {
      grid = new Uint8Array(cols * rows);
      age = new Int16Array(cols * rows);
      for (let i = 0; i < grid.length; i++) {
        if (Math.random() < 0.2) { grid[i] = 1; age[i] = 1; }
      }
    };

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

    const draw = () => {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          if (!grid[idx]) continue;
          const a = age[idx];
          ctx.fillStyle = a === 1 ? "#34d399" : a < 5 ? "#38bdf8" : "#f472b6";
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    };

    // Click / drag to toggle (paint) cells; renderOnce keeps the stroke
    // visible even while paused.
    let painting = false;
    const paint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * cols);
      const y = Math.floor(((e.clientY - r.top) / r.height) * rows);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const idx = y * cols + x;
      grid[idx] = 1;
      age[idx] = 1;
      controls.renderOnce();
    };

    return {
      resize(cssWidth, dpr) {
        W = Math.max(1, Math.round(cssWidth));
        H = Math.round(W * 0.62);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.floor(W / CELL);
        rows = Math.floor(H / CELL);
        seed();
      },
      frame(dt) {
        acc += dt;
        const interval = 1 / genPerSec;
        while (acc >= interval) { step(); acc -= interval; }
        draw();
      },
      draw,
      pointer: {
        down: (e) => { painting = true; paint(e); },
        move: (e) => { if (painting) paint(e); },
        up: () => { painting = false; },
      },
      api: {
        step: () => { step(); controls.renderOnce(); },
        reset: () => { seed(); controls.renderOnce(); },
        setSpeed: (next) => { genPerSec = next; },
      },
    };
  });

  return (
    <div className="w-full">
      <DemoFrame>
        <canvas ref={demo.canvasRef} className="block w-full touch-none select-none" />
      </DemoFrame>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <DemoButton primary onClick={demo.toggle}>
          {demo.running ? "Pause" : "Play"}
        </DemoButton>
        <DemoButton onClick={() => demo.api.step()}>Step</DemoButton>
        <DemoButton onClick={() => demo.api.reset()}>Reset</DemoButton>
        <label className="flex items-center gap-2 font-mono text-xs text-white/50">
          Speed
          <input
            type="range"
            min={1}
            max={30}
            defaultValue={DEFAULT_SPEED}
            onChange={(e) => demo.api.setSpeed(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
      </div>
      <DemoCaption>
        Click or drag on the grid to draw cells. Green is newborn, blue is young, pink is old.
      </DemoCaption>
    </div>
  );
}
