"use client";

// Playground-takeover layers: ambient, touchable versions of the demos drawn
// behind home sections. Cousins of the mini previews (components/home/
// previews.tsx) with three differences: they fill a whole section, they take
// pointer input (forwarded from the section — the canvas itself never
// intercepts events), and they draw in the active grade's accent so they work
// inside every film mode. While a film grade is active they don't run at all:
// one ambient canvas system at a time.

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { accentAlpha } from "@/lib/theme";
import { useFilmModeActive, usePlaygroundEnabled } from "@/lib/playground";

export type PlaygroundKind = "cloth" | "life" | "pi-blocks";

type Pointer = Readonly<{ x: number; y: number; down: boolean; active: boolean }>;

/** Draw one frame. */
type LayerFrame = (
  ctx: CanvasRenderingContext2D,
  t: number,
  pointer: Pointer
) => void;

type LayerCreate = (w: number, h: number) => LayerFrame;

/* -------------------------------- Cloth -------------------------------- */

type ClothPoint = {
  x: number;
  y: number;
  px: number;
  py: number;
  pin: boolean;
};
type Link = { a: number; b: number; rest: number; cut: boolean };

const createCloth: LayerCreate = (w, h) => {
  const gap = 42;
  const cols = Math.max(8, Math.ceil(w / gap) + 1);
  const rows = Math.max(6, Math.ceil(h / (gap * 0.9)) + 1);
  const pts: ClothPoint[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      pts.push({
        x: x * gap,
        y: y * gap * 0.9,
        px: x * gap,
        py: y * gap * 0.9,
        pin: y === 0,
      });
    }
  }
  const links: Link[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x < cols - 1) links.push({ a: i, b: i + 1, rest: gap, cut: false });
      if (y < rows - 1)
        links.push({ a: i, b: i + cols, rest: gap * 0.9, cut: false });
    }
  }
  let lastPointer: Pointer | null = null;

  return (ctx, t, pointer) => {
    for (const p of pts) {
      if (p.pin) continue;
      const vx = (p.x - p.px) * 0.985;
      const vy = (p.y - p.py) * 0.985;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + Math.sin(t * 1.2 + p.y * 0.05) * 0.05;
      p.y += vy + 0.12;
      // A hovering pointer stirs the nearby cloth.
      if (pointer.active && !pointer.down) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 90 * 90 && d2 > 1) {
          const push = 14 / Math.sqrt(d2);
          p.x += dx * push * 0.02;
          p.y += dy * push * 0.02;
        }
      }
    }

    // A pressed drag slices the threads it crosses.
    if (pointer.active && pointer.down && lastPointer?.down) {
      for (const link of links) {
        if (link.cut) continue;
        const a = pts[link.a];
        const b = pts[link.b];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = mx - pointer.x;
        const dy = my - pointer.y;
        if (dx * dx + dy * dy < 26 * 26) {
          link.cut = true;
        }
      }
    }
    lastPointer = pointer;

    for (let iter = 0; iter < 2; iter++) {
      for (const link of links) {
        if (link.cut) continue;
        const a = pts[link.a];
        const b = pts[link.b];
        const ddx = b.x - a.x;
        const ddy = b.y - a.y;
        const d = Math.hypot(ddx, ddy) || 0.001;
        const diff = ((d - link.rest) / d) * 0.5;
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

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = accentAlpha(0.14);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const link of links) {
      if (link.cut) continue;
      const a = pts[link.a];
      const b = pts[link.b];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  };
};

/* --------------------------------- Life --------------------------------- */

const createLife: LayerCreate = (w, h) => {
  const cell = 16;
  const cols = Math.max(10, Math.ceil(w / cell));
  const rows = Math.max(8, Math.ceil(h / cell));
  let grid = new Uint8Array(cols * rows);
  let next = new Uint8Array(cols * rows);
  // A sparse random seed; the visitor paints the rest.
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.08 ? 1 : 0;
  let lastStep = 0;

  return (ctx, t, pointer) => {
    // Painting: the pointer sows live cells under itself.
    if (pointer.active) {
      const cx = Math.floor(pointer.x / cell);
      const cy = Math.floor(pointer.y / cell);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < cols && y >= 0 && y < rows && Math.random() < 0.5) {
            grid[y * cols + x] = 1;
          }
        }
      }
    }

    if (t - lastStep > 0.18) {
      lastStep = t;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const xx = (x + dx + cols) % cols;
              const yy = (y + dy + rows) % rows;
              if (grid[yy * cols + xx]) n++;
            }
          }
          const i = y * cols + x;
          const alive = grid[i]
            ? n === 2 || n === 3
            : n === 3;
          next[i] = alive ? Math.min(250, grid[i] + 1) : 0;
        }
      }
      [grid, next] = [next, grid];
    }

    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const age = grid[y * cols + x];
        if (!age) continue;
        // Newborns glow brightest, elders fade back into the surface.
        const alpha = age === 1 ? 0.35 : age < 5 ? 0.22 : 0.1;
        ctx.fillStyle = accentAlpha(alpha);
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  };
};

/* ------------------------------- π-blocks ------------------------------- */

const createPiBlocks: LayerCreate = (w, h) => {
  // The classic setup, run gently and endlessly: a big block drifts in and
  // shoves a small one against the left wall; collisions flash.
  const floor = h - 24;
  const small = { x: w * 0.3, v: 0, size: 26 };
  const big = { x: w * 0.75, v: -36, size: 54, mass: 100 };
  let flash = 0;

  return (ctx, t, _pointer) => {
    const dt = 1 / 60;
    small.x += small.v * dt;
    big.x += big.v * dt;

    // Elastic block-block collision (mass ratio 100:1).
    if (big.x <= small.x + small.size) {
      big.x = small.x + small.size;
      const m1 = 1;
      const m2 = big.mass;
      const v1 = small.v;
      const v2 = big.v;
      small.v = ((m1 - m2) / (m1 + m2)) * v1 + ((2 * m2) / (m1 + m2)) * v2;
      big.v = ((2 * m1) / (m1 + m2)) * v1 + ((m2 - m1) / (m1 + m2)) * v2;
      flash = 1;
    }
    // Wall bounce.
    if (small.x <= 12) {
      small.x = 12;
      small.v = -small.v;
      flash = 1;
    }
    // Keep the show on stage forever: when both drift right, send the big
    // block back in.
    if (big.x > w * 0.85 && big.v > 0 && small.v >= 0) big.v = -34;
    if (big.x > w - big.size - 4) big.x = w - big.size - 4;

    flash = Math.max(0, flash - dt * 2.5);

    ctx.clearRect(0, 0, w, h);
    // Ground line + wall.
    ctx.strokeStyle = accentAlpha(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floor + 0.5);
    ctx.lineTo(w, floor + 0.5);
    ctx.moveTo(12.5, floor);
    ctx.lineTo(12.5, floor - 120);
    ctx.stroke();

    ctx.fillStyle = accentAlpha(0.12 + flash * 0.25);
    ctx.fillRect(small.x, floor - small.size, small.size, small.size);
    ctx.fillStyle = accentAlpha(0.1 + flash * 0.2);
    ctx.fillRect(big.x, floor - big.size, big.size, big.size);
    void t;
  };
};

const CREATORS: Record<PlaygroundKind, LayerCreate> = {
  cloth: createCloth,
  life: createLife,
  "pi-blocks": createPiBlocks,
};

/* ------------------------------ The layer ------------------------------ */

/**
 * One ambient layer behind a home section. Mounts nothing unless the
 * playground is on and no film mode owns the page. Pointer input is read
 * from the parent section (the canvas is pointer-events-none, so links,
 * buttons, and text selection above it are untouched).
 */
export default function PlaygroundLayer({ kind }: { kind: PlaygroundKind }) {
  const enabled = usePlaygroundEnabled();
  const filmActive = useFilmModeActive();
  const run = enabled && !filmActive;
  return run ? <LayerCanvas kind={kind} /> : null;
}

function LayerCanvas({ kind }: { kind: PlaygroundKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const section = canvas.closest("section");
    let raf = 0;
    let frame: LayerFrame;
    const start = performance.now();
    const pointer = { x: -1e3, y: -1e3, down: false, active: false };

    // The layers default on for every visitor, so they must be cheap: a sim
    // only burns frames while its section is actually on screen.
    let inView = false;

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      frame(ctx, t, { ...pointer });
      raf = requestAnimationFrame(loop);
    };
    const run = () => {
      if (!raf && !reduced && !document.hidden && inView)
        raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frame = CREATORS[kind](w, h);
      if (reduced) frame(ctx, 1.5, { ...pointer });
    };

    // Pointer input comes from the section, not the canvas.
    const toLocal = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onMove = (event: PointerEvent) => toLocal(event);
    const onDown = (event: PointerEvent) => {
      pointer.down = true;
      toLocal(event);
    };
    const onUp = () => {
      pointer.down = false;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.down = false;
    };

    init();

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) run();
        else pause();
      },
      { rootMargin: "100px" }
    );
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? pause() : run());
    document.addEventListener("visibilitychange", onVisibility);
    section?.addEventListener("pointermove", onMove);
    section?.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    section?.addEventListener("pointerleave", onLeave);

    let lastW = canvas.clientWidth;
    let lastH = canvas.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      init();
    });
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      section?.removeEventListener("pointermove", onMove);
      section?.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      section?.removeEventListener("pointerleave", onLeave);
      pause();
    };
  }, [kind, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-playground-layer={kind}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
