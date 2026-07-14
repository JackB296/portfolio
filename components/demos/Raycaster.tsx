"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_BRIGHT, accentAlpha } from "@/lib/theme";

// The exact map from the original engine.py (# = wall, . = floor).
const MAP = [
  "#################",
  "#..........#....#",
  "#.......#.......#",
  "#....#..........#",
  "#.........#.....#",
  "#......####.....#",
  "#....#....#.....#",
  "#....#....#.....#",
  "#....#....#.....#",
  "#....#....#.....#",
  "#....######.....#",
  "#..#....####....#",
  "#.......####....#",
  "#..#........#...#",
  "#........#......#",
  "#################",
];
const COLS = MAP[0].length;
const ROWS = MAP.length;
const FOV = Math.PI / 3;
const RAY_COUNT = 150;
const TURN = Math.PI / 36; // matches engine.py (math.pi / 36 per frame)

const isWall = (cx: number, cy: number) => {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
  return MAP[Math.floor(cy)][Math.floor(cx)] === "#";
};

export default function Raycaster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // Player in cell-space coordinates.
    let px = 2.5;
    let py = 2.5;
    let dir = 0; // facing east

    let tile = 18;
    let W = 612;
    let H = 288;

    const resize = () => {
      const cssW = Math.max(1, canvas.getBoundingClientRect().width);
      tile = Math.max(6, Math.floor(cssW / (2 * COLS)));
      W = 2 * COLS * tile;
      H = ROWS * tile;
      canvas.width = W;
      canvas.height = H;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (startedRef.current && ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
        e.preventDefault();
      keys.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Drag to turn (bonus over the original).
    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      if (!startedRef.current) setStarted(true);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dir += (e.clientX - lastX) * 0.005;
      lastX = e.clientX;
    };
    const onUp = () => (dragging = false);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.67); // frames elapsed (~1 at 60fps)
      last = now;

      // --- Movement: W/S forward/back, A/D turn (faithful to engine.py) ---
      const speed = 0.045 * dt;
      const turn = TURN * dt;
      let move = 0;
      if (keys.has("w") || keys.has("arrowup")) move += 1;
      if (keys.has("s") || keys.has("arrowdown")) move -= 1;
      if (keys.has("a") || keys.has("arrowleft")) dir -= turn;
      if (keys.has("d") || keys.has("arrowright")) dir += turn;
      if (move !== 0) {
        const nx = px + Math.cos(dir) * speed * move;
        const ny = py + Math.sin(dir) * speed * move;
        if (!isWall(nx, py)) px = nx;
        if (!isWall(px, ny)) py = ny;
      }

      // --- Right half: ceiling / floor ---
      ctx.fillStyle = "#11131f";
      ctx.fillRect(W / 2, 0, W / 2, H / 2);
      ctx.fillStyle = "#070810";
      ctx.fillRect(W / 2, H / 2, W / 2, H / 2);

      // --- Left half: 2D map ---
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.fillStyle = MAP[y][x] === "#" ? "#2a2f4a" : "#0b0d16";
          ctx.fillRect(x * tile, y * tile, tile - 1, tile - 1);
        }
      }

      // --- Raycast ---
      const stripW = W / 2 / RAY_COUNT;
      for (let i = 0; i < RAY_COUNT; i++) {
        const angle = dir - FOV / 2 + (i / (RAY_COUNT - 1)) * FOV;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // March the ray through cell-space until it hits a wall.
        let dist = 0;
        let hx = px;
        let hy = py;
        const stepLen = 0.02;
        for (let s = 0; s < 1200; s++) {
          hx = px + cos * dist;
          hy = py + sin * dist;
          if (isWall(hx, hy)) break;
          dist += stepLen;
        }

        // 3D strip (right half), grayscale shaded by distance (faithful formula).
        const lineH = Math.min(H * 2.2, (H * 0.5) / Math.max(dist, 0.0001));
        const y0 = (H - lineH) / 2;
        const shade = Math.max(0.05, 1 / (1 + dist * dist * 0.12));
        const g = Math.round(210 * shade);
        ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 18)})`;
        ctx.fillRect(W / 2 + i * stripW, y0, stripW + 1, lineH);

        // Ray line on the 2D map.
        if (i % 2 === 0) {
          ctx.strokeStyle = accentAlpha(0.18);
          ctx.beginPath();
          ctx.moveTo(px * tile, py * tile);
          ctx.lineTo(hx * tile, hy * tile);
          ctx.stroke();
        }
      }

      // --- Player on the 2D map ---
      ctx.fillStyle = ACCENT_BRIGHT;
      ctx.beginPath();
      ctx.arc(px * tile, py * tile, Math.max(3, tile * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px * tile, py * tile);
      ctx.lineTo((px + Math.cos(dir) * 1.2) * tile, (py + Math.sin(dir) * 1.2) * tile);
      ctx.stroke();
      ctx.lineWidth = 1;

      // Divider between the 2D and 3D panes.
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(W / 2 - 1, 0, 2, H);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
      <canvas
        ref={canvasRef}
        className="block w-full touch-none select-none"
        style={{ imageRendering: "pixelated", aspectRatio: `${2 * COLS} / ${ROWS}` }}
      />
      {!started && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-ink/55 text-center backdrop-blur-[1px]">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Raycasting Engine
          </p>
          <p className="mt-3 max-w-xs px-6 text-sm text-white/70">
            <b className="text-white">W/S</b> move · <b className="text-white">A/D</b> turn ·{" "}
            <b className="text-white">drag</b> to look. Left pane = 2D map &amp; rays, right = the 3D view.
          </p>
          <p className="mt-4 text-xs text-white/65">Click to start</p>
        </div>
      )}
    </div>
  );
}
