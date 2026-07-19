"use client";

import { ACCENT } from "@/lib/theme";
import useDemoCanvas from "./useDemoCanvas";
import { DemoButton, DemoCaption, DemoFrame } from "./chrome";

// A single perceptron learning a linear boundary, faithful to my Python sin.py.
// Points are labeled by whether they sit above y = 0.3x + 0.2; the perceptron
// trains on every point each step and its guess line snaps toward the truth.
const TARGET = (x: number) => 0.3 * x + 0.2;
const LR = 0.05;
const N = 120;

type PerceptronApi = {
  step: () => void;
  reset: () => void;
};

type PerceptronHud = {
  epoch: number;
  acc: number; // percent classified correctly, as of the last draw
};

export default function Perceptron() {
  const demo = useDemoCanvas<PerceptronApi, PerceptronHud>(
    (ctx, canvas, controls) => {
      let W = 1, H = 1;

      type Pt = { x: number; y: number; label: number };
      let points: Pt[] = [];
      let weights = [0, 0, 0];
      let epochs = 0;
      let accPct = 0;
      let acc = 0; // frame-time accumulator

      const init = () => {
        points = Array.from({ length: N }, () => {
          const x = Math.random() * 2 - 1;
          const y = Math.random() * 2 - 1;
          return { x, y, label: y > TARGET(x) ? 1 : -1 };
        });
        weights = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
        epochs = 0;
      };
      init();

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
      };

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
        accPct = Math.round((correct / points.length) * 100);
      };

      return {
        resize(cssWidth, dpr) {
          W = Math.min(560, Math.max(1, Math.round(cssWidth)));
          H = W;
          canvas.width = Math.round(W * dpr);
          canvas.height = Math.round(H * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        },
        frame(dt) {
          acc += dt;
          while (acc >= 0.25) { train(); acc -= 0.25; } // ~4 epochs/sec
          draw();
        },
        draw,
        hud: () => ({ epoch: epochs, acc: accPct }),
        api: {
          step: () => { train(); controls.renderOnce(); },
          reset: () => { init(); controls.renderOnce(); },
        },
      };
    },
    { initialHud: { epoch: 0, acc: 0 } }
  );

  return (
    <div className="w-full">
      <DemoFrame className="mx-auto max-w-[560px]">
        <canvas ref={demo.canvasRef} className="block w-full touch-none select-none" />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-mono text-xs">
          <span className="rounded-full bg-ink/70 px-3 py-1 text-accent backdrop-blur">epoch {demo.hud.epoch}</span>
          <span className="rounded-full bg-ink/70 px-3 py-1 text-emerald-300 backdrop-blur">{demo.hud.acc}% correct</span>
        </div>
      </DemoFrame>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <DemoButton primary onClick={demo.toggle}>
          {demo.running ? "Pause" : "Train"}
        </DemoButton>
        <DemoButton onClick={() => demo.api.step()}>Step</DemoButton>
        <DemoButton onClick={() => demo.api.reset()}>New data</DemoButton>
      </div>
      <DemoCaption>
        Green line is the true boundary, purple is the perceptron&apos;s guess. Watch it converge.
      </DemoCaption>
    </div>
  );
}
