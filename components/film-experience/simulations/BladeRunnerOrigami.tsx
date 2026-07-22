"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { BleepsToggle, useBladeRunnerBleeps } from "@/components/film-experience/simulations/BladeRunnerBleeps";

// Gaff's unicorn, one crease at a time. A visible sheet of paper morphs as
// folds land: twelve shared vertices interpolate from a flat square toward the
// finished unicorn, one feature per crease. The crease window drifts and
// shrinks as the figure sharpens, the sweep quickens, and three slipped
// creases tear the sheet.
const FOLDS = 6;
const MAX_MISSES = 3;
const FOLD_ANIM_MS = 380;
const SHAKE_MS = 300;
const SCORE_ID = "blade-runner-origami";

const FOLD_NAMES = ["Diagonal base", "Body fold", "Neck raise", "Head and horn", "Foreleg", "Hind leg and tail"] as const;

// Where the beat window sits for each fold, and how wide it is. It drifts and
// tightens — the telegraph band shows the player where the next release lands.
const WINDOWS = [
  { center: 0.5, half: 0.11 },
  { center: 0.42, half: 0.1 },
  { center: 0.6, half: 0.09 },
  { center: 0.35, half: 0.08 },
  { center: 0.66, half: 0.07 },
  { center: 0.5, half: 0.06 },
] as const;

const sweepMsFor = (fold: number) => 1600 - fold * 120;

/** Triangle wave 0→1→0 so the marker sweeps back and forth. */
function sweepAt(elapsedMs: number, periodMs: number) {
  const t = ((elapsedMs % periodMs) + periodMs) / periodMs % 1;
  return t < 0.5 ? t * 2 : (1 - t) * 2;
}

// The paper, in 100-unit space (y down). Twelve semantic vertices shared by
// every stage: [tailTip, rumpTop, backMid, witherTop, neckTop, hornTip,
// noseTip, chestFront, forelegHoof, bellyMid, hindlegHoof, rumpBottom].
type Point = readonly [number, number];
const SQUARE: readonly Point[] = [
  [15, 75], [15, 45], [15, 15], [45, 15], [70, 15], [85, 15],
  [85, 45], [85, 75], [70, 85], [50, 85], [30, 85], [15, 85],
];
const UNICORN: readonly Point[] = [
  [12, 60], [24, 46], [38, 42], [52, 38], [62, 26], [74, 8],
  [76, 28], [58, 48], [56, 80], [44, 58], [26, 82], [18, 62],
];
// Which vertices snap to their final position on each fold (fold 1 pulls the
// whole sheet 35% in — the base crease; later folds finish one feature each).
const FOLD_GROUPS: ReadonlyArray<readonly number[]> = [
  [], // fold 1: global 35% crease
  [1, 2, 3, 7, 9, 11], // body
  [4], // neck
  [5, 6], // head + horn
  [8], // foreleg
  [0, 10], // hind leg + tail
];
// The crease line each fold scores into the sheet (unit space).
const CREASES: ReadonlyArray<readonly [Point, Point]> = [
  [[15, 15], [85, 85]],
  [[15, 48], [85, 62]],
  [[52, 38], [64, 22]],
  [[62, 26], [76, 26]],
  [[58, 48], [56, 78]],
  [[44, 58], [26, 80]],
];

function vertexAt(folds: number, index: number): Point {
  let weight = 0;
  if (folds >= 1) weight = 0.35;
  for (let fold = 2; fold <= folds; fold += 1) {
    if (FOLD_GROUPS[fold - 1].includes(index)) weight = 1;
  }
  const [sx, sy] = SQUARE[index];
  const [ux, uy] = UNICORN[index];
  return [sx + (ux - sx) * weight, sy + (uy - sy) * weight];
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

type Phase = "folding" | "complete" | "torn";

function FoldTheUnicorn() {
  const [folds, setFolds] = useState(0);
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<Phase>("folding");
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const reducedMotion = useReducedMotion();
  const { play, muted, toggleMuted } = useBladeRunnerBleeps();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const foldButtonRef = useRef<HTMLButtonElement>(null);
  // Animation state lives in refs so the single rAF loop drives the marker and
  // the paper without re-rendering: sweep clock, fold morph, shake, crease
  // flash, and the finished figure's light catch.
  const startRef = useRef(0);
  const sweepValRef = useRef(0);
  const foldAnimRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const shakeUntilRef = useRef(0);
  const creaseFlashRef = useRef<{ fold: number; until: number } | null>(null);
  const doneAtRef = useRef(0);
  const flashTimerRef = useRef(0);

  const done = phase === "complete";
  const torn = phase === "torn";
  const active = phase === "folding";
  const beatWindow = WINDOWS[Math.min(folds, FOLDS - 1)];

  useEffect(() => {
    startRef.current = performance.now();
    window.requestAnimationFrame(() => foldButtonRef.current?.focus());
    return () => window.clearTimeout(flashTimerRef.current);
  }, []);

  const drawPaper = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number, now: number, inkSoft: string) => {
      context.fillStyle = inkSoft;
      context.fillRect(0, 0, width, height);

      const size = Math.min(width, height) * 0.92;
      const originX = (width - size) / 2;
      const originY = (height - size) / 2;
      const px = (point: Point): Point => [originX + (point[0] / 100) * size, originY + (point[1] / 100) * size];

      // Wobble-on-miss: a decaying shake around the paper.
      let dx = 0;
      let dy = 0;
      if (!reducedMotion && now < shakeUntilRef.current) {
        const left = shakeUntilRef.current - now;
        const amp = 4 * (left / SHAKE_MS);
        dx = Math.sin(left * 0.09) * amp;
        dy = Math.cos(left * 0.13) * amp * 0.6;
      }

      // Which vertex set to draw: mid-morph between stages, or the landed stage.
      const anim = foldAnimRef.current;
      let verts: Point[];
      if (!reducedMotion && anim && now - anim.start < FOLD_ANIM_MS) {
        const t = easeOut((now - anim.start) / FOLD_ANIM_MS);
        verts = SQUARE.map((_, i) => {
          const [ax, ay] = vertexAt(anim.from, i);
          const [bx, by] = vertexAt(anim.to, i);
          return [ax + (bx - ax) * t, ay + (by - ay) * t] as Point;
        });
      } else {
        verts = SQUARE.map((_, i) => vertexAt(folds, i));
      }

      const tracePaper = (offsetY: number) => {
        context.beginPath();
        const [firstX, firstY] = px(verts[0]);
        context.moveTo(firstX + dx, firstY + dy + offsetY);
        for (let i = 1; i < verts.length; i += 1) {
          const [x, y] = px(verts[i]);
          context.lineTo(x + dx, y + dy + offsetY);
        }
        context.closePath();
      };

      const paintPaper = (offsetY: number) => {
        tracePaper(offsetY);
        context.fillStyle = accentAlpha(done ? 0.16 : 0.11);
        context.fill();
        context.strokeStyle = accentAlpha(0.85);
        context.lineWidth = 1.5;
        context.lineJoin = "round";
        context.stroke();
        // Landed creases score the sheet.
        for (let f = 0; f < Math.min(folds, CREASES.length); f += 1) {
          const [[x0, y0], [x1, y1]] = CREASES[f];
          const [ax, ay] = px([x0, y0]);
          const [bx, by] = px([x1, y1]);
          context.beginPath();
          context.moveTo(ax + dx, ay + dy + offsetY);
          context.lineTo(bx + dx, by + dy + offsetY);
          const flashing =
            creaseFlashRef.current && creaseFlashRef.current.fold === f && now < creaseFlashRef.current.until;
          context.strokeStyle = accentAlpha(flashing ? 0.95 : 0.25);
          context.lineWidth = flashing ? 2 : 1;
          context.stroke();
        }
      };

      if (torn) {
        // The sheet tears down the middle; the halves shear apart.
        const mid = width / 2;
        context.save();
        context.beginPath();
        context.rect(0, 0, mid, height);
        context.clip();
        paintPaper(-5);
        context.restore();
        context.save();
        context.beginPath();
        context.rect(mid, 0, width - mid, height);
        context.clip();
        paintPaper(5);
        context.restore();
        // Jagged tear line.
        context.beginPath();
        for (let i = 0; i <= 8; i += 1) {
          const y = originY + (i / 8) * size;
          const x = mid + (i % 2 === 0 ? -4 : 4);
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = "rgba(255, 255, 255, 0.55)";
        context.lineWidth = 1.5;
        context.stroke();
        return;
      }

      paintPaper(0);

      if (done) {
        // The light catch: a sheen band sweeps the finished figure, and the
        // horn keeps a small pulsing glint.
        const [hornX, hornY] = px(UNICORN[5]);
        if (reducedMotion) {
          context.beginPath();
          context.arc(hornX, hornY, 2.6, 0, Math.PI * 2);
          context.fillStyle = accentAlpha(1);
          context.fill();
          return;
        }
        const p = ((now - doneAtRef.current) % 2600) / 2600;
        context.save();
        tracePaper(0);
        context.clip();
        context.translate(p * (width + 160) - 80, 0);
        context.rotate(-0.35);
        context.fillStyle = accentAlpha(0.28);
        context.fillRect(0, -height, 26, height * 3);
        context.restore();
        context.beginPath();
        context.arc(hornX, hornY, 2.2 + Math.sin(now / 300) * 1.1, 0, Math.PI * 2);
        context.fillStyle = accentAlpha(0.95);
        context.fill();
      }
    },
    [done, folds, reducedMotion, torn]
  );

  // The one rAF loop: marker sweep + paper redraw. Under reduced motion the
  // marker parks inside the current window (every deliberate press lands) and
  // the paper draws once per state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const palette = getLiveThemePalette();

    if (reducedMotion) {
      sweepValRef.current = beatWindow.center;
      if (markerRef.current) markerRef.current.style.left = `${beatWindow.center * 100}%`;
      foldAnimRef.current = null;
      drawPaper(context, width, height, performance.now(), palette.inkSoft);
      return;
    }

    const periodMs = sweepMsFor(Math.min(folds, FOLDS - 1));
    let frame = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        if (active) {
          const value = sweepAt(now - startRef.current, periodMs);
          sweepValRef.current = value;
          if (markerRef.current) markerRef.current.style.left = `${(value * 100).toFixed(2)}%`;
        }
        drawPaper(context, width, height, now, palette.inkSoft);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [active, beatWindow.center, drawPaper, folds, reducedMotion]);

  const fold = useCallback(() => {
    if (!active) return;
    const inWindow = Math.abs(sweepValRef.current - beatWindow.center) <= beatWindow.half;
    window.clearTimeout(flashTimerRef.current);
    if (!inWindow) {
      play("miss");
      shakeUntilRef.current = performance.now() + SHAKE_MS;
      setFlash("miss");
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 300);
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      if (nextMisses >= MAX_MISSES) {
        setPhase("torn");
        play("lose");
      }
      return;
    }
    play("hit");
    creaseFlashRef.current = { fold: folds, until: performance.now() + 450 };
    foldAnimRef.current = { from: folds, to: folds + 1, start: performance.now() };
    setFlash("hit");
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 300);
    const next = folds + 1;
    setFolds(next);
    startRef.current = performance.now();
    if (next >= FOLDS) {
      setPhase("complete");
      doneAtRef.current = performance.now();
      play("win");
      recordSimulationScore(SCORE_ID, FOLDS + (MAX_MISSES - misses) * 2);
    }
  }, [active, beatWindow, folds, misses, play]);

  const restart = useCallback(() => {
    setFolds(0);
    setMisses(0);
    setPhase("folding");
    setFlash(null);
    foldAnimRef.current = null;
    creaseFlashRef.current = null;
    shakeUntilRef.current = 0;
    startRef.current = performance.now();
    window.requestAnimationFrame(() => foldButtonRef.current?.focus());
  }, []);

  const status = useMemo(() => {
    if (done) return `Unicorn folded. ${misses} slipped crease${misses === 1 ? "" : "s"} — the light catches the horn.`;
    if (torn) return "The sheet tore. Smooth a new one and start again.";
    if (flash === "hit") return `Crease lands — ${FOLD_NAMES[Math.min(folds, FOLDS) - 1]} holds. The window ${folds < FOLDS ? "drifts and tightens" : "closes"}.`;
    if (flash === "miss") return `Slipped. The paper wobbles — ${MAX_MISSES - misses} slip${MAX_MISSES - misses === 1 ? "" : "s"} left before it tears.`;
    return `Fold ${folds + 1} of ${FOLDS} — ${FOLD_NAMES[folds]}. Release inside the lit window.`;
  }, [done, flash, folds, misses, torn]);

  const simState = done ? "done" : torn ? "torn" : "folding";

  return (
    <div data-sim-state={simState} data-folds={folds} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em]">
        <p className="text-white/45">
          {active ? (
            <>
              Fold {folds + 1}/{FOLDS} · <span className="text-accent">{FOLD_NAMES[folds]}</span>
            </>
          ) : done ? (
            "Figure complete"
          ) : (
            "Sheet torn"
          )}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-white/60">
            slips{" "}
            <span aria-hidden className="tracking-[0.2em]">
              {Array.from({ length: MAX_MISSES }, (_, i) => (i < misses ? "✕" : "·")).join("")}
            </span>
            <span className="sr-only">
              {misses} of {MAX_MISSES}
            </span>
          </span>
          <BleepsToggle muted={muted} onToggle={toggleMuted} />
        </div>
      </div>

      <canvas ref={canvasRef} aria-hidden className="h-64 w-full border border-accent/25 bg-ink/60 sm:h-80" />

      <div className="relative h-5 w-full border border-accent/25 bg-ink/60" aria-hidden>
        {/* The telegraphed beat window for the current crease. */}
        {active && (
          <div
            className="absolute inset-y-0 animate-pulse bg-accent/25"
            style={{ left: `${(beatWindow.center - beatWindow.half) * 100}%`, width: `${beatWindow.half * 2 * 100}%` }}
          />
        )}
        <div
          ref={markerRef}
          className={`absolute inset-y-0 w-0.5 -translate-x-1/2 ${flash === "miss" ? "bg-white/60" : "bg-accent"}`}
          style={{ left: reducedMotion ? `${beatWindow.center * 100}%` : "0%" }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {active ? (
          <button
            ref={foldButtonRef}
            type="button"
            onClick={fold}
            className="border border-accent/40 px-4 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Fold
          </button>
        ) : (
          <button
            ref={foldButtonRef}
            type="button"
            onClick={restart}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {done ? "Fold another" : "Smooth a new sheet"}
          </button>
        )}
        <span className="text-white/40">
          creases {folds}/{FOLDS}
        </span>
      </div>

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function BladeRunnerOrigami({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="blade-runner-origami-title"
      gameId="blade-runner-origami"
      eyebrow="Paper tell"
      title="Origami tell"
      startLabel="Start folding"
      stage
      howToPlay={{
        objective:
          "Land all six creases by folding while the sweeping marker sits inside the lit window.",
        controls: [
          { keys: "click", does: "press fold as the marker crosses the lit band" },
          { keys: "Enter / Space", does: "fold from the keyboard — the button holds focus from the start" },
        ],
        tip: "The window drifts and narrows with every crease while the sweep quickens; three slipped creases tear the sheet. Under reduced motion the marker parks inside the window, so every deliberate press lands.",
      }}
      reference={{
        quote: "It's too bad she won't live.",
        scene: "Blade Runner · Gaff's paper unicorn",
      }}
      onClose={onClose}
    >
      <FoldTheUnicorn />
    </SimulationShell>
  );
}
