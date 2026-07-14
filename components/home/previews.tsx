"use client";

// Miniature live versions of the demos, rendered behind their project cards
// on hover. Each is a stripped-down cousin of the real thing: same math,
// tiny footprint, and the real demo's own colors (blue-gray raycaster walls,
// pale cloth threads, yellow bird and green pipes). Under
// prefers-reduced-motion each draws a single static frame.

import { useEffect, useRef } from "react";

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) => void;

/** Shared canvas scaffold: DPR sizing, rAF loop, reduced-motion still frame. */
function useMiniCanvas(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      draw(ctx, w, h, (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      draw(ctx, w, h, 1.5);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  return ref;
}

function MiniCanvas({ draw }: { draw: DrawFn }) {
  const ref = useMiniCanvas(draw);
  return <canvas ref={ref} aria-hidden="true" className="h-full w-full" />;
}

/* ------------------------------ Raycaster ------------------------------ */

const MAP = [
  "########",
  "#....#.#",
  "#.##...#",
  "#..#.#.#",
  "#.#....#",
  "#...##.#",
  "#.#....#",
  "########",
];

const drawRaycaster: DrawFn = (ctx, w, h, t) => {
  ctx.clearRect(0, 0, w, h);
  const px = 3.5 + Math.sin(t * 0.21) * 1.1;
  const py = 3.5 + Math.cos(t * 0.17) * 1.1;
  const heading = t * 0.35;
  const fov = Math.PI / 3;
  const colW = 5;
  const cols = Math.ceil(w / colW);
  for (let i = 0; i < cols; i++) {
    const angle = heading - fov / 2 + (i / cols) * fov;
    const dx = Math.cos(angle) * 0.04;
    const dy = Math.sin(angle) * 0.04;
    let x = px;
    let y = py;
    let dist = 0;
    for (let s = 0; s < 250; s++) {
      x += dx;
      y += dy;
      dist += 0.04;
      if (MAP[Math.floor(y) & 7][Math.floor(x) & 7] === "#") break;
    }
    const corrected = dist * Math.cos(angle - heading);
    const wallH = Math.min(h, h / (corrected * 1.6));
    // Blue-gray distance shading, same scheme as the real Raycaster demo.
    const g = Math.round(Math.max(38, 200 - corrected * 34));
    ctx.fillStyle = `rgb(${g}, ${g}, ${Math.min(255, g + 18)})`;
    ctx.fillRect(i * colW, (h - wallH) / 2, colW - 1, wallH);
  }
};

export function MiniRaycaster() {
  return <MiniCanvas draw={drawRaycaster} />;
}

/* -------------------------------- Cloth -------------------------------- */

type ClothState = {
  pts: { x: number; y: number; px: number; py: number; pin: boolean }[];
  cols: number;
  rows: number;
  gap: number;
};
const clothStates = new WeakMap<CanvasRenderingContext2D, ClothState>();

const drawCloth: DrawFn = (ctx, w, h, t) => {
  let s = clothStates.get(ctx);
  if (!s) {
    const cols = 18;
    const rows = 11;
    const gap = w / (cols - 1);
    const pts = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        pts.push({ x: x * gap, y: y * gap * 0.8 + 6, px: x * gap, py: y * gap * 0.8 + 6, pin: y === 0 });
      }
    }
    s = { pts, cols, rows, gap };
    clothStates.set(ctx, s);
  }
  const { pts, cols, rows, gap } = s;

  for (const p of pts) {
    if (p.pin) continue;
    const vx = (p.x - p.px) * 0.985;
    const vy = (p.y - p.py) * 0.985;
    p.px = p.x;
    p.py = p.y;
    p.x += vx + Math.sin(t * 1.4 + p.y * 0.06) * 0.06;
    p.y += vy + 0.11;
  }
  for (let iter = 0; iter < 2; iter++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        for (const [nx, ny] of [
          [x + 1, y],
          [x, y + 1],
        ]) {
          if (nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          const rest = nx !== x ? gap : gap * 0.8;
          const a = pts[i];
          const b = pts[j];
          const ddx = b.x - a.x;
          const ddy = b.y - a.y;
          const d = Math.hypot(ddx, ddy) || 0.001;
          const diff = ((d - rest) / d) * 0.5;
          if (!a.pin) {
            a.x += ddx * diff;
            a.y += ddy * diff;
          }
          if (!b.pin) {
            b.x -= ddx * diff;
            b.y -= ddy * diff;
          }
        }
      }
    }
  }
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(191, 219, 254, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p = pts[y * cols + x];
      if (x < cols - 1) {
        const q = pts[y * cols + x + 1];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      if (y < rows - 1) {
        const q = pts[(y + 1) * cols + x];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
    }
  }
  ctx.stroke();
};

export function MiniCloth() {
  return <MiniCanvas draw={drawCloth} />;
}

/* -------------------------------- Flappy ------------------------------- */

type FlappyState = { birds: { y: number; vy: number; phase: number }[] };
const flappyStates = new WeakMap<CanvasRenderingContext2D, FlappyState>();

const drawFlappy: DrawFn = (ctx, w, h, t) => {
  let s = flappyStates.get(ctx);
  if (!s) {
    s = {
      birds: Array.from({ length: 5 }, (_, i) => ({
        y: h * 0.3 + i * 9,
        vy: 0,
        phase: i * 1.7,
      })),
    };
    flappyStates.set(ctx, s);
  }
  ctx.clearRect(0, 0, w, h);

  // Two scrolling pipe pairs; the gap drifts so the flock has to work.
  // Flappy's real palette: green pipes, yellow bird.
  const speed = 60;
  const pipeW = 16;
  const spacing = w / 2 + 40;
  ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
  const gaps: { x: number; center: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const x = spacing - ((t * speed + k * spacing) % (spacing * 2)) + w - spacing / 2;
    if (x < -pipeW || x > w) continue;
    const center = h / 2 + Math.sin(t * 0.4 + k * 2.1) * h * 0.18;
    const half = h * 0.17;
    ctx.fillRect(x, 0, pipeW, center - half);
    ctx.fillRect(x, center + half, pipeW, h - center - half);
    gaps.push({ x, center });
  }

  // Birds seek the nearest gap ahead: flap when below its center.
  for (const bird of s.birds) {
    const target = gaps.find((g) => g.x > w * 0.18) ?? { center: h / 2 };
    bird.vy += 0.14;
    if (bird.y > target.center + 12 + Math.sin(bird.phase) * 8) bird.vy = -2.4;
    bird.y += bird.vy;
    bird.y = Math.max(6, Math.min(h - 6, bird.y));
    const wing = Math.sin(t * 14 + bird.phase) * 3;
    ctx.fillStyle = "rgba(253, 224, 71, 0.95)";
    ctx.beginPath();
    ctx.arc(w * 0.22, bird.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(253, 224, 71, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.22 - 4, bird.y);
    ctx.lineTo(w * 0.22 - 9, bird.y - wing);
    ctx.stroke();
  }
};

export function MiniFlappy() {
  return <MiniCanvas draw={drawFlappy} />;
}
