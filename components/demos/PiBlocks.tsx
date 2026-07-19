"use client";

import { useState } from "react";
import { ACCENT, ACCENT_BRIGHT } from "@/lib/theme";
import useDemoCanvas from "./useDemoCanvas";
import { DemoButton, DemoCaption, DemoFrame } from "./chrome";

// The colliding-blocks computer for pi (faithful to my Python pi-blocks sim).
// A small block, a big block, and a wall. With a mass ratio of 100^(digits-1)
// the number of perfectly elastic collisions spells out the digits of pi.
// Implemented event-driven so collisions are exact (no tunneling).
const DIGIT_OPTIONS = [1, 2, 3] as const;
const INITIAL_DIGITS = 2;

type PiBlocksApi = {
  restart: (digits: number) => void;
};

export default function PiBlocks() {
  const [digits, setDigits] = useState<number>(INITIAL_DIGITS);

  const demo = useDemoCanvas<PiBlocksApi, number>((ctx, canvas, controls) => {
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
    };
    restart(INITIAL_DIGITS);

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
    };

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

    const frame = (realDt0: number) => {
      const realDt = Math.min(0.05, realDt0);
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
    };

    return {
      resize(cssWidth, dpr) {
        W = Math.max(1, Math.round(cssWidth));
        H = Math.round(W * 0.5);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      },
      frame,
      draw,
      hud: () => count,
      api: {
        // Replaying is an explicit action, so it doubles as the
        // reduced-motion opt-in.
        restart: (d) => { restart(d); controls.start(); },
      },
    };
  }, { initialHud: 0 });

  return (
    <div className="w-full">
      <DemoFrame>
        <canvas ref={demo.canvasRef} className="block w-full touch-none select-none" />
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-4 py-1.5 font-mono text-sm text-accent backdrop-blur">
          {demo.hud} collisions
        </div>
      </DemoFrame>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <span className="font-mono text-xs text-white/65">Mass ratio:</span>
        {DIGIT_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDigits(d); demo.api.restart(d); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              digits === d ? "bg-accent text-ink" : "border border-white/15 text-white/70 hover:text-white"
            }`}
          >
            100^{d - 1}
          </button>
        ))}
        <DemoButton onClick={() => demo.api.restart(digits)}>Replay</DemoButton>
      </div>
      <DemoCaption>
        Count the collisions: 3, then 31, then 314. The digits of pi fall out of pure physics.
      </DemoCaption>
    </div>
  );
}
