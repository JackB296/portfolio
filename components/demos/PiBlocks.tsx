"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT, ACCENT_BRIGHT } from "@/lib/theme";

// The colliding-blocks computer for pi (faithful to my Python pi-blocks sim).
// A small block, a big block, and a wall. With a mass ratio of 100^(digits-1)
// the number of perfectly elastic collisions spells out the digits of pi.
// Implemented event-driven so collisions are exact (no tunneling).
const DIGIT_OPTIONS = [1, 2, 3] as const;

export default function PiBlocks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [digits, setDigits] = useState<number>(2);
  const [collisions, setCollisions] = useState(0);
  const digitsRef = useRef(digits);
  const restartRef = useRef<(d: number) => void>(() => {});
  useEffect(() => { digitsRef.current = digits; }, [digits]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 1, H = 1;

    const S1 = 0.6, S2 = 1.2; // block sizes in world units
    const WORLD = 12; // world width in units

    // Simulation state, valid as of `lastT` (sim seconds).
    let m1 = 1, m2 = 1;
    let x1 = 0, v1 = 0, x2 = 0, v2 = 0; // x = left edge, world units
    let lastT = 0, simT = 0, count = 0, done = false;

    const restart = (d: number) => {
      m1 = 1;
      m2 = Math.pow(100, d - 1);
      x1 = 2.2; v1 = 0;
      x2 = 7.5; v2 = -1.2;
      lastT = 0; simT = 0; count = 0; done = false;
      setCollisions(0);
    };
    restart(digitsRef.current);
    restartRef.current = restart;

    // Time until the next collision from the current state, or Infinity.
    const nextEvent = () => {
      let dt = Infinity, type: "bb" | "wall" | null = null;
      const closing = v1 - v2; // gap = x2 - (x1+S1) shrinks at rate (v1 - v2)
      if (closing > 1e-12) {
        const gap = x2 - (x1 + S1);
        const t = gap / closing;
        if (t >= -1e-9 && t < dt) { dt = Math.max(0, t); type = "bb"; }
      }
      if (v1 < -1e-12) {
        const t = (0 - x1) / v1;
        if (t >= -1e-9 && t < dt) { dt = Math.max(0, t); type = "wall"; }
      }
      return { dt, type };
    };

    const resolve = (type: "bb" | "wall") => {
      if (type === "wall") {
        v1 = -v1;
      } else {
        const u1 = v1, u2 = v2;
        v1 = ((m1 - m2) / (m1 + m2)) * u1 + ((2 * m2) / (m1 + m2)) * u2;
        v2 = ((2 * m1) / (m1 + m2)) * u1 + ((m2 - m1) / (m1 + m2)) * u2;
      }
      count++;
      setCollisions(count);
    };

    const resize = () => {
      W = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      H = Math.round(W * 0.5);
      canvas.width = W; canvas.height = H;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const sx = () => (W - 40) / WORLD; // pixels per world unit
    const groundY = () => H - 30;
    const toX = (xu: number) => 30 + xu * sx();

    const draw = () => {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);
      const scale = sx(), gy = groundY();
      // wall + ground
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 0); ctx.lineTo(30, gy); ctx.lineTo(W, gy);
      ctx.stroke();

      // interpolate block positions to the current sim time
      const dtv = simT - lastT;
      const px1 = x1 + v1 * dtv;
      const px2 = x2 + v2 * dtv;

      ctx.fillStyle = ACCENT;
      ctx.fillRect(toX(px1), gy - S1 * scale, S1 * scale, S1 * scale);
      ctx.fillStyle = ACCENT_BRIGHT;
      ctx.fillRect(toX(px2), gy - S2 * scale, S2 * scale, S2 * scale);

      ctx.fillStyle = "rgba(231,233,243,0.65)";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(`${m1} kg`, toX(px1), gy - S1 * scale - 6);
      ctx.fillText(m2 >= 1000 ? `${m2.toExponential(0)} kg` : `${m2} kg`, toX(px2), gy - S2 * scale - 6);
    };

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const realDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!done) {
        simT += realDt * 1.1; // play speed
        let guard = 0;
        while (guard++ < 200000) {
          const ev = nextEvent();
          if (ev.type === null || !isFinite(ev.dt)) { done = true; break; }
          const eventT = lastT + ev.dt;
          if (eventT > simT) break;
          // advance state to the event, resolve it
          x1 += v1 * ev.dt;
          x2 += v2 * ev.dt;
          lastT = eventT;
          resolve(ev.type);
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
        <canvas ref={canvasRef} className="block w-full touch-none select-none" />
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-4 py-1.5 font-mono text-sm text-accent backdrop-blur">
          {collisions} collisions
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <span className="font-mono text-xs text-white/65">Mass ratio:</span>
        {DIGIT_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => { setDigits(d); restartRef.current(d); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              digits === d ? "bg-accent text-ink" : "border border-white/15 text-white/70 hover:text-white"
            }`}
          >
            100^{d - 1}
          </button>
        ))}
        <button
          onClick={() => restartRef.current(digitsRef.current)}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent/50 hover:text-white"
        >
          Replay
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-white/60">
        Count the collisions: 3, then 31, then 314. The digits of pi fall out of pure physics.
      </p>
    </div>
  );
}
