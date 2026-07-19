"use client";

import { ACCENT_BRIGHT } from "@/lib/theme";
import useDemoCanvas from "./useDemoCanvas";
import { DemoButton, DemoCaption, DemoFrame } from "./chrome";

// Faithful to the original cloth.py: a 32x24 grid of point masses linked by
// sticks, integrated with Verlet, pinned every other node on the top row,
// and cut by dragging the mouse across the threads (segment intersection).
const COLS = 32;
const ROWS = 24;
const DRAG = 0.01;
const ITERATIONS = 5;

type Particle = { x: number; y: number; px: number; py: number; pinned: boolean };
type Stick = { a: number; b: number; len: number; active: boolean };

// Do segments p1p2 and p3p4 intersect? (mirrors the orientation test in cloth.py)
function intersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
) {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => {
    const v = (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
    return v === 0 ? 0 : v > 0 ? 1 : 2;
  };
  const o1 = o(ax, ay, bx, by, cx, cy);
  const o2 = o(ax, ay, bx, by, dx, dy);
  const o3 = o(cx, cy, dx, dy, ax, ay);
  const o4 = o(cx, cy, dx, dy, bx, by);
  return o1 !== o2 && o3 !== o4;
}

type ClothApi = {
  reset: () => void;
};

export default function ClothSim() {
  const demo = useDemoCanvas<ClothApi>((ctx, canvas, controls) => {
    let W = 640;
    let H = 460;
    let spacing = 18;
    let particles: Particle[] = [];
    let sticks: Stick[] = [];

    const idx = (i: number, j: number) => i * ROWS + j;

    const build = () => {
      particles = [];
      sticks = [];
      spacing = Math.min(W / (COLS + 1), (H * 0.85) / ROWS);
      const startX = (W - (COLS - 1) * spacing) / 2;
      const startY = H * 0.08;
      for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
          const x = startX + i * spacing;
          const y = startY + j * spacing;
          const pinned = j === 0 && i % 2 === 0;
          particles.push({ x, y, px: x, py: y, pinned });
          if (i > 0) sticks.push({ a: idx(i, j), b: idx(i - 1, j), len: spacing, active: true });
          if (j > 0) sticks.push({ a: idx(i, j), b: idx(i, j - 1), len: spacing, active: true });
        }
      }
    };

    // Pointer = the cutting blade.
    let down = false;
    let mx = 0, my = 0, pmx = 0, pmy = 0;
    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * W;
      my = ((e.clientY - r.top) / r.height) * H;
    };

    const frame = (dt0: number) => {
      const dt = Math.min(0.02, dt0);
      const gravity = 981 * (spacing / 25); // scaled from the original (spacing 25)

      // Verlet integration
      for (const p of particles) {
        if (p.pinned) continue;
        const nx = p.x + (p.x - p.px) * (1 - DRAG);
        const ny = p.y + (p.y - p.py) * (1 - DRAG) + gravity * dt * dt;
        p.px = p.x; p.py = p.y;
        p.x = nx; p.y = ny;
        if (p.y > H) p.y = H;
        if (p.x < 0) p.x = 0;
        if (p.x > W) p.x = W;
      }

      // Constraint relaxation
      for (let k = 0; k < ITERATIONS; k++) {
        for (const s of sticks) {
          if (!s.active) continue;
          const pa = particles[s.a], pb = particles[s.b];
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const dlen = Math.hypot(dx, dy) || 0.0001;
          const f = ((s.len - dlen) / dlen) * 0.5;
          const ox = dx * f, oy = dy * f;
          if (!pa.pinned) { pa.x += ox; pa.y += oy; }
          if (!pb.pinned) { pb.x -= ox; pb.y -= oy; }
        }
      }

      // Render
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (const s of sticks) {
        if (!s.active) continue;
        const pa = particles[s.a], pb = particles[s.b];
        const strain = Math.min(1, Math.abs(Math.hypot(pa.x - pb.x, pa.y - pb.y) - s.len) / 10);
        const r = Math.round(190 + strain * 60);
        const g = Math.round(195 - strain * 90);
        const b = Math.round(225 - strain * 30);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.55 + strain * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.fillStyle = ACCENT_BRIGHT;
      for (const p of particles) {
        if (!p.pinned) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    return {
      resize(cssWidth, dpr) {
        W = Math.max(1, Math.round(cssWidth));
        H = Math.round(W * 0.68);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
      },
      frame,
      pointer: {
        // Cutting needs the sim running, so a press is also the
        // reduced-motion opt-in.
        down: (e) => { down = true; toLocal(e); pmx = mx; pmy = my; controls.start(); },
        move: (e) => {
          pmx = mx; pmy = my;
          toLocal(e);
          if (!down) return;
          for (const s of sticks) {
            if (!s.active) continue;
            const pa = particles[s.a], pb = particles[s.b];
            if (intersect(pmx, pmy, mx, my, pa.x, pa.y, pb.x, pb.y)) s.active = false;
          }
        },
        up: () => { down = false; },
      },
      api: {
        reset: () => { build(); controls.renderOnce(); },
      },
    };
  });

  return (
    <div className="w-full">
      <DemoFrame>
        <canvas ref={demo.canvasRef} className="block w-full touch-none select-none" />
      </DemoFrame>
      <div className="mt-4 flex items-center justify-center gap-3">
        <DemoButton onClick={() => demo.api.reset()}>Reset cloth</DemoButton>
      </div>
      <DemoCaption>
        Click and drag across the cloth to slice through the threads.
      </DemoCaption>
    </div>
  );
}
