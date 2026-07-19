"use client";

import { useEffect, useRef } from "react";
import { GRADE_EVENT } from "@/lib/grades";
import { ACCENT_RGB } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

const CELL = 16; // CSS px per cell
const STEP_MS = 150; // generation length
const SEED_DENSITY = 0.12;

type CellPalette = readonly [newborn: string, young: string, mature: string, elder: string];

// The House Grade keeps the original demo's age ramp. Named film grades use
// their CSS accent tokens so the same living pattern takes on the film's look.
const HOUSE_PALETTE: CellPalette = [
  ACCENT_RGB,
  "56, 189, 248",
  "167, 139, 250",
  "244, 114, 182",
];

function cssRgb(styles: CSSStyleDeclaration, property: string) {
  return styles.getPropertyValue(property).trim().replace(/\s+/g, ", ");
}

function grayscaleRgb(triplet: string) {
  const [red, green, blue] = triplet.split(",").map(Number);
  const luminance = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
  return `${luminance}, ${luminance}, ${luminance}`;
}

function getCellPalette(): CellPalette {
  if (!document.documentElement.dataset.grade) return HOUSE_PALETTE;

  const styles = getComputedStyle(document.documentElement);
  const bright = cssRgb(styles, "--accent-bright-rgb");
  const accent = cssRgb(styles, "--accent-rgb");
  const dim = cssRgb(styles, "--accent-dim-rgb");
  if (styles.getPropertyValue("--grade-image-filter").includes("grayscale")) {
    return [grayscaleRgb(bright), grayscaleRgb(accent), grayscaleRgb(accent), grayscaleRgb(dim)];
  }
  return [bright, accent, accent, dim];
}

/**
 * Conway's Game of Life as the hero backdrop, in bright age-based colors.
 * The same automaton as the /game-of-life demo, tuned to sit behind text:
 * sparse seed, age-colored cells, and cells born under the cursor.
 * Honors prefers-reduced-motion by rendering a single static generation.
 */
export default function LifeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    // Cell age: 0 = dead, otherwise generations alive (capped for fading).
    let grid = new Uint8Array(0);
    let next = new Uint8Array(0);
    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let inView = true;
    let palette = getCellPalette();

    const idx = (x: number, y: number) => y * cols + x;

    function seed() {
      grid.fill(0);
      for (let i = 0; i < grid.length; i++) {
        if (Math.random() < SEED_DENSITY) grid[i] = 1;
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(8, Math.ceil(w / CELL));
      rows = Math.max(8, Math.ceil(h / CELL));
      grid = new Uint8Array(cols * rows);
      next = new Uint8Array(cols * rows);
      seed();
    }

    function step() {
      for (let y = 0; y < rows; y++) {
        const up = (y - 1 + rows) % rows;
        const dn = (y + 1) % rows;
        for (let x = 0; x < cols; x++) {
          const lf = (x - 1 + cols) % cols;
          const rt = (x + 1) % cols;
          const n =
            (grid[idx(lf, up)] ? 1 : 0) +
            (grid[idx(x, up)] ? 1 : 0) +
            (grid[idx(rt, up)] ? 1 : 0) +
            (grid[idx(lf, y)] ? 1 : 0) +
            (grid[idx(rt, y)] ? 1 : 0) +
            (grid[idx(lf, dn)] ? 1 : 0) +
            (grid[idx(x, dn)] ? 1 : 0) +
            (grid[idx(rt, dn)] ? 1 : 0);
          const alive = grid[idx(x, y)] > 0;
          if (alive && (n === 2 || n === 3)) {
            next[idx(x, y)] = Math.min(grid[idx(x, y)] + 1, 12);
          } else if (!alive && n === 3) {
            next[idx(x, y)] = 1;
          } else {
            next[idx(x, y)] = 0;
          }
        }
      }
      [grid, next] = [next, grid];
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.clientWidth, canvas!.clientHeight);
      const [newborn, young, mature, elder] = palette;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const age = grid[idx(x, y)];
          if (!age) continue;
          if (age === 1) {
            ctx!.fillStyle = `rgba(${newborn}, 0.2)`;
            ctx!.fillRect(x * CELL - 1, y * CELL - 1, CELL + 2, CELL + 2);
            ctx!.fillStyle = `rgba(${newborn}, 0.95)`;
          } else if (age <= 4) {
            ctx!.fillStyle = `rgba(${young}, 0.75)`;
          } else if (age <= 8) {
            ctx!.fillStyle = `rgba(${mature}, 0.6)`;
          } else {
            ctx!.fillStyle = `rgba(${elder}, 0.55)`;
          }
          ctx!.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }

    function frame(t: number) {
      if (!running) return;
      if (last === 0) last = t;
      acc += t - last;
      last = t;
      if (acc >= STEP_MS) {
        // Catch up at most one generation per frame; drop extra backlog.
        step();
        acc = acc % STEP_MS;
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced || !inView) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    if (reduced) {
      // A settled, still frame: run a few generations, draw once.
      for (let i = 0; i < 6; i++) step();
      draw();
    } else {
      draw();
      start();
    }

    // Cells are born under the cursor.
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const rect = canvas!.getBoundingClientRect();
      const cx = Math.floor((e.clientX - rect.left) / CELL);
      const cy = Math.floor((e.clientY - rect.top) / CELL);
      for (let i = 0; i < 3; i++) {
        const x = cx + Math.floor(Math.random() * 3) - 1;
        const y = cy + Math.floor(Math.random() * 3) - 1;
        if (x >= 0 && x < cols && y >= 0 && y < rows && !grid[idx(x, y)]) {
          grid[idx(x, y)] = 1;
        }
      }
    };

    // Pause off-screen and when the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        draw();
      }, 150);
    };
    const onGradeChange = () => {
      palette = getCellPalette();
      draw();
    };

    // Listen on the whole hero section so cells spawn even when the pointer
    // is over the text content (which sits in a sibling stacking layer).
    const heroEl = canvas.closest("section") ?? canvas;
    heroEl.addEventListener("pointermove", onPointerMove as EventListener);
    window.addEventListener("resize", onResize);
    window.addEventListener(GRADE_EVENT, onGradeChange);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      clearTimeout(resizeTimer);
      heroEl.removeEventListener("pointermove", onPointerMove as EventListener);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(GRADE_EVENT, onGradeChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-full w-full scale-[1.02] blur-[3px]"
    />
  );
}
