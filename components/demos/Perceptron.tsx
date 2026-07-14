"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT } from "@/lib/theme";

// A single perceptron learning a linear boundary, faithful to my Python sin.py.
// Points are labeled by whether they sit above y = 0.3x + 0.2; the perceptron
// trains on every point each step and its guess line snaps toward the truth.
const TARGET = (x: number) => 0.3 * x + 0.2;
const LR = 0.05;
const N = 120;

export default function Perceptron() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(true);
  const [acc, setAcc] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const runningRef = useRef(running);
  const stepRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 1, H = 1;

    type Pt = { x: number; y: number; label: number };
    let points: Pt[] = [];
    let weights = [0, 0, 0];
    let epochs = 0;

    const init = () => {
      points = Array.from({ length: N }, () => {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        return { x, y, label: y > TARGET(x) ? 1 : -1 };
      });
      weights = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
      epochs = 0;
      setEpoch(0);
    };
    init();
    resetRef.current = init;

    const activate = (x: number, y: number) =>
      weights[0] * x + weights[1] * y + weights[2] >= 0 ? 1 : -1;

    const train = () => {
      for (const p of points) {
        const pred = activate(p.x, p.y);
        const err = p.label - pred;
        weights[0] += err * p.x * LR;
        weights[1] += err * p.y * LR;
        weights[2] += err * LR;
      }
      epochs++;
      setEpoch(epochs);
    };
    stepRef.current = train;

    const mapX = (x: number) => ((x + 1) / 2) * W;
    const mapY = (y: number) => H - ((y + 1) / 2) * H;
    const guessY = (x: number) =>
      Math.abs(weights[1]) < 1e-6 ? 0 : -(weights[2] / weights[1]) - (weights[0] / weights[1]) * x;

    const draw = () => {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);

      // Target boundary (the truth) and the perceptron's current guess.
      ctx.strokeStyle = "rgba(52,211,153,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mapX(-1), mapY(TARGET(-1)));
      ctx.lineTo(mapX(1), mapY(TARGET(1)));
      ctx.stroke();

      ctx.strokeStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(mapX(-1), mapY(guessY(-1)));
      ctx.lineTo(mapX(1), mapY(guessY(1)));
      ctx.stroke();

      // Points: green if classified correctly, red if not.
      let correct = 0;
      for (const p of points) {
        const ok = activate(p.x, p.y) === p.label;
        if (ok) correct++;
        ctx.fillStyle = ok ? "#34d399" : "#f87171";
        ctx.beginPath();
        ctx.arc(mapX(p.x), mapY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      setAcc(Math.round((correct / points.length) * 100));
    };

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      W = Math.min(560, w);
      H = W;
      canvas.width = W;
      canvas.height = H;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0, acc2 = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (runningRef.current) {
        acc2 += dt;
        while (acc2 >= 0.25) { train(); acc2 -= 0.25; } // ~4 epochs/sec
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
        <canvas ref={canvasRef} className="block w-full touch-none select-none" />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-mono text-xs">
          <span className="rounded-full bg-ink/70 px-3 py-1 text-accent backdrop-blur">epoch {epoch}</span>
          <span className="rounded-full bg-ink/70 px-3 py-1 text-emerald-300 backdrop-blur">{acc}% correct</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setRunning((v) => !v)}
          className="rounded-full bg-accent px-5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent-bright"
        >
          {running ? "Pause" : "Train"}
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
          New data
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-white/60">
        Green line is the true boundary, purple is the perceptron&apos;s guess. Watch it converge.
      </p>
    </div>
  );
}
