"use client";

import { useEffect, useRef } from "react";
import { GRADE_EVENT } from "@/lib/grades";
import { ACCENT_RGB } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { isHouse } from "@/lib/useHtmlAttr";

const CELL = 16; // CSS px per cell
const STEP_MS = 150; // generation length
const SOUP_DENSITY = 0.12;

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
  if (isHouse()) return HOUSE_PALETTE;

  const styles = getComputedStyle(document.documentElement);
  const bright = cssRgb(styles, "--accent-bright-rgb");
  const accent = cssRgb(styles, "--accent-rgb");
  const dim = cssRgb(styles, "--accent-dim-rgb");
  if (styles.getPropertyValue("--grade-image-filter").includes("grayscale")) {
    return [grayscaleRgb(bright), grayscaleRgb(accent), grayscaleRgb(accent), grayscaleRgb(dim)];
  }
  return [bright, accent, accent, dim];
}

/* ------------------------------------------------------------------ */
/* Pattern library — the classics, as readable "O"/"." stamps.        */
/* ------------------------------------------------------------------ */

const GLIDER = [
  ".O.",
  "..O",
  "OOO",
];

// Lightweight spaceship, travels horizontally.
const LWSS = [
  ".O..O",
  "O....",
  "O...O",
  "OOOO.",
];

// Period-3 oscillator, the showiest of the common ones.
const PULSAR = [
  "..OOO...OOO..",
  ".............",
  "O....O.O....O",
  "O....O.O....O",
  "O....O.O....O",
  "..OOO...OOO..",
  ".............",
  "..OOO...OOO..",
  "O....O.O....O",
  "O....O.O....O",
  "O....O.O....O",
  ".............",
  "..OOO...OOO..",
];

// Period-15 oscillator.
const PENTADECATHLON = [
  "..O....O..",
  "OO.OOOO.OO",
  "..O....O..",
];

// Methuselahs: tiny seeds that boil chaotically for hundreds of generations.
const R_PENTOMINO = [
  ".OO",
  "OO.",
  ".O.",
];

const ACORN = [
  ".O.....",
  "...O...",
  "OO..OOO",
];

// Gosper's glider gun: fires a glider every 30 generations, forever.
const GLIDER_GUN = [
  "........................O...........",
  "......................O.O...........",
  "............OO......OO............OO",
  "...........O...O....OO............OO",
  "OO........O.....O...OO..............",
  "OO........O...O.OO....O.O...........",
  "..........O.....O.......O...........",
  "...........O...O....................",
  "............OO......................",
];

type Pattern = string[];

/* ------------------------------------------------------------------ */

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
    // Stagnation tracking: consecutive low-activity generations, and a
    // cooldown so revival stamps never pile on top of each other.
    let dullStreak = 0;
    let injectCooldown = 0;

    const idx = (x: number, y: number) => y * cols + x;

    /* ---- pattern stamping ---- */

    // Random orientation: identity / mirrored / flipped / transposed.
    function orient(pattern: Pattern): Pattern {
      let p = pattern;
      if (Math.random() < 0.5) p = p.map((row) => row.split("").reverse().join(""));
      if (Math.random() < 0.5) p = [...p].reverse();
      if (Math.random() < 0.5 && p.length !== p[0].length) {
        // transpose only when it changes the silhouette
        const t: string[] = [];
        for (let x = 0; x < p[0].length; x++) {
          t.push(p.map((row) => row[x]).join(""));
        }
        p = t;
      }
      return p;
    }

    function stamp(pattern: Pattern, cx: number, cy: number) {
      const p = orient(pattern);
      for (let y = 0; y < p.length; y++) {
        for (let x = 0; x < p[y].length; x++) {
          if (p[y][x] !== "O") continue;
          const gx = (cx + x + cols) % cols;
          const gy = (cy + y + rows) % rows;
          grid[idx(gx, gy)] = 1;
        }
      }
    }

    function stampRandom(pattern: Pattern, margin = 0.12) {
      const mx = Math.floor(cols * margin);
      const my = Math.floor(rows * margin);
      const x = mx + Math.floor(Math.random() * Math.max(1, cols - 2 * mx - pattern[0].length));
      const y = my + Math.floor(Math.random() * Math.max(1, rows - 2 * my - pattern.length));
      stamp(pattern, x, y);
    }

    function soup(density: number) {
      for (let i = 0; i < grid.length; i++) {
        if (Math.random() < density) grid[i] = 1;
      }
    }

    /* ---- opening presets ---- */

    const PRESETS: [name: string, seed: () => void][] = [
      [
        "primordial soup",
        () => soup(SOUP_DENSITY),
      ],
      [
        "glider gun",
        () => {
          // The gun sits in the upper third and streams gliders forever;
          // thin soup elsewhere keeps the rest of the field breathing.
          soup(0.045);
          // A phone-width grid is narrower than the gun; ships stand in.
          if (cols > GLIDER_GUN[0].length + 8) stamp(GLIDER_GUN, 3, 3);
          else for (let i = 0; i < 2; i++) stampRandom(LWSS);
          for (let i = 0; i < 3; i++) stampRandom(GLIDER);
        },
      ],
      [
        "methuselah bloom",
        () => {
          // Near-empty field; two tiny seeds boil into chaos for minutes.
          soup(0.015);
          stampRandom(R_PENTOMINO, 0.3);
          stampRandom(ACORN, 0.2);
        },
      ],
      [
        "oscillator garden",
        () => {
          soup(0.02);
          const across = Math.max(1, Math.floor(cols / 34));
          for (let i = 0; i < across; i++) {
            stamp(
              PULSAR,
              Math.floor(((i + 0.5) * cols) / across - 6),
              Math.floor(rows * (0.22 + Math.random() * 0.4))
            );
          }
          stampRandom(PENTADECATHLON);
          for (let i = 0; i < 2; i++) stampRandom(GLIDER);
        },
      ],
      [
        "spaceship fleet",
        () => {
          soup(0.03);
          const ships = 4 + Math.floor(Math.random() * 3);
          for (let i = 0; i < ships; i++) stampRandom(LWSS);
          stampRandom(PULSAR);
        },
      ],
    ];

    function seed() {
      grid.fill(0);
      const [, plant] = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      plant();
      dullStreak = 0;
      injectCooldown = 0;
    }

    // When the field goes quiet, drop in something alive rather than wiping
    // the canvas: a methuselah, a few ships, or (rarely) a whole gun.
    function inject() {
      const roll = Math.random();
      if (roll < 0.35) {
        stampRandom(ACORN, 0.2);
      } else if (roll < 0.7) {
        stampRandom(R_PENTOMINO, 0.25);
        stampRandom(GLIDER);
      } else if (roll < 0.9 || cols <= GLIDER_GUN[0].length + 8) {
        stampRandom(LWSS, 0.2);
        stampRandom(LWSS, 0.2);
      } else {
        stampRandom(GLIDER_GUN, 0.15);
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
      let changed = 0;
      let alive = 0;
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
          const was = grid[idx(x, y)] > 0;
          if (was && (n === 2 || n === 3)) {
            next[idx(x, y)] = Math.min(grid[idx(x, y)] + 1, 12);
          } else if (!was && n === 3) {
            next[idx(x, y)] = 1;
          } else {
            next[idx(x, y)] = 0;
          }
          const is = next[idx(x, y)] > 0;
          if (is !== was) changed++;
          if (is) alive++;
        }
      }
      [grid, next] = [next, grid];

      // Boring-field detection. Settled ash (a few blinkers) flips only a
      // handful of cells per generation; healthy soup flips hundreds.
      const cells = cols * rows;
      if (injectCooldown > 0) injectCooldown--;
      if (changed < cells * 0.008 || alive < cells * 0.02) {
        dullStreak++;
      } else {
        dullStreak = 0;
      }
      if (dullStreak > 45 && injectCooldown === 0) {
        inject();
        dullStreak = 0;
        injectCooldown = 90;
      }
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

    // Re-fit when the canvas's own box changes — not just the window. Mounting
    // as the default backdrop can happen before the hero has its final size, so
    // the first measure may read a zero box; the observer re-sizes and redraws
    // the moment layout settles, instead of waiting for a window resize that
    // may never come.
    let lastW = canvas.clientWidth;
    let lastH = canvas.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      resize();
      draw();
    });
    ro.observe(canvas);
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
      ro.disconnect();
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
