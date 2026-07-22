"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { createMatrixSimAudio, type MatrixSimAudio } from "@/components/film-experience/simulations/MatrixSimAudio";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette, withAlpha } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// A volley telegraphs (arming), then the tracer flies in (charging); the lean
// window is the final stretch of its flight. Dodge inside the window to
// survive; each survival tightens the window and speeds the tracer. Leaning
// early — or during the telegraph — is as fatal as not leaning at all.
const SCORE_ID = "matrix-bullet-time";
const FEINT_MS = 340;
const DODGE_MS = 850;
const SHAKE_MS = 420;
const FLASH_MS = 220;

type Phase = "arming" | "charging" | "dodging" | "hit" | "paused";
type Direction = "right" | "left" | "above";

type VolleyCfg = Readonly<{
  dir: Direction;
  armingMs: number;
  chargeMs: number;
  windowFrac: number;
  feint: boolean;
}>;

function volleyConfig(round: number, reducedMotion: boolean): VolleyCfg {
  const dir = (["right", "left", "above"] as const)[round % 3];
  if (reducedMotion) {
    // Reduced motion keeps generous, fixed windows and no feints: the trial
    // stays playable as a discrete track instead of a squeeze.
    return { dir, armingMs: 1200, chargeMs: 2600, windowFrac: 0.6, feint: false };
  }
  return {
    dir,
    armingMs: 700,
    chargeMs: Math.max(650, 1500 - round * 90),
    windowFrac: Math.max(0.18, 0.32 - round * 0.015),
    feint: round >= 4 && round % 3 === 2,
  };
}

/** Feint volleys stall mid-flight: raw elapsed → effective tracer elapsed. */
function tracerElapsed(raw: number, cfg: VolleyCfg) {
  if (!cfg.feint) return raw;
  const half = cfg.chargeMs * 0.5;
  if (raw <= half) return raw;
  if (raw <= half + FEINT_MS) return half;
  return raw - FEINT_MS;
}

/** "rgb(r, g, b)" → "rgba(r, g, b, a)" for canvas fades. */
type Judgement = { id: number; text: string; perfect: boolean };

function BulletTime() {
  const [phase, setPhase] = useState<Phase>("arming");
  const [round, setRound] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [windowState, setWindowState] = useState<"out" | "in">("out");
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [hitReason, setHitReason] = useState("");
  const [muted, setMuted] = useState(false);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const leanRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const t0Ref = useRef(0);
  const pausedElapsedRef = useRef(0);
  const pausedPhaseRef = useRef<"arming" | "charging">("arming");
  const hiddenAtRef = useRef<number | null>(null);
  const leanPRef = useRef(0);
  const inWindowRef = useRef(false);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const shakeUntilRef = useRef(0);
  const flashUntilRef = useRef(0);
  const audioRef = useRef<MatrixSimAudio | null>(null);

  const cfg = useMemo(() => volleyConfig(round, reducedMotion), [round, reducedMotion]);
  const mult = Math.min(4, 1 + Math.floor(streak / 3));

  const audio = () => (audioRef.current ??= createMatrixSimAudio());
  useEffect(() => () => audioRef.current?.dispose(), []);

  // A hidden tab shifts the volley clock: coming back is not an instant loss.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
      } else if (hiddenAtRef.current !== null) {
        t0Ref.current += performance.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const toHit = useCallback((reason: string) => {
    setHitReason(reason);
    setPhase("hit");
    shakeUntilRef.current = performance.now() + SHAKE_MS;
    flashUntilRef.current = performance.now() + FLASH_MS;
    audioRef.current?.fail();
    if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
    window.requestAnimationFrame(() => restartRef.current?.focus());
  }, []);

  const lean = useCallback(() => {
    audio().unlock();
    if (phase === "arming") {
      toHit("Leaned before the shot even fired.");
      return;
    }
    if (phase !== "charging") return;
    const p = Math.min(
      1,
      tracerElapsed(performance.now() - t0Ref.current, cfg) / cfg.chargeMs
    );
    if (p < 1 - cfg.windowFrac) {
      toHit("Leaned too early — the tracer caught you.");
      return;
    }
    const perfect = p >= 1 - cfg.windowFrac * 0.45;
    const gained = (perfect ? 150 : 100) * mult;
    streakRef.current += 1;
    scoreRef.current += gained;
    setStreak(streakRef.current);
    setScore(scoreRef.current);
    setJudgement({ id: performance.now(), text: `${perfect ? "perfect" : "clean"} +${gained}`, perfect });
    leanPRef.current = p;
    audioRef.current?.clear();
    setPhase("dodging");
  }, [cfg, mult, phase, toHit]);

  const restart = useCallback(() => {
    streakRef.current = 0;
    scoreRef.current = 0;
    setStreak(0);
    setScore(0);
    setJudgement(null);
    setHitReason("");
    pausedElapsedRef.current = 0;
    setWindowState("out");
    setRound(0);
    setPhase("arming");
  }, []);

  const togglePause = useCallback(() => {
    if (phase === "arming" || phase === "charging") {
      pausedElapsedRef.current = performance.now() - t0Ref.current;
      pausedPhaseRef.current = phase;
      setPhase("paused");
    } else if (phase === "paused") {
      setPhase(pausedPhaseRef.current);
    }
  }, [phase]);

  // The volley engine: one rAF loop per active phase. It advances the state
  // machine (arming → charging → hit on timeout, dodging → next volley) and
  // renders the stage. Reduced motion renders a discrete DOM track instead of
  // the animated canvas.
  useEffect(() => {
    if (phase === "arming" || phase === "charging") {
      t0Ref.current = performance.now() - pausedElapsedRef.current;
      pausedElapsedRef.current = 0;
      if (phase === "arming") {
        inWindowRef.current = false;
        setWindowState("out");
        window.requestAnimationFrame(() => leanRef.current?.focus());
      }
    } else if (phase === "dodging") {
      t0Ref.current = performance.now();
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const palette = getLiveThemePalette();

    let w = 0;
    let h = 0;
    let cx = 0;
    let gy = 0;
    const size = () => {
      if (!canvas) return;
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      cx = w * 0.5;
      gy = h * 0.78;
    };
    size();
    window.addEventListener("resize", size);

    const path = (): [number, number, number, number] => {
      switch (cfg.dir) {
        case "right":
          return [w + 12, h * 0.42, cx + 8, gy - 34];
        case "left":
          return [-12, h * 0.42, cx - 8, gy - 34];
        case "above":
          return [cx + w * 0.2, -12, cx, gy - 38];
      }
    };

    const drawFigure = (leanAngle: number, now: number) => {
      if (!context) return;
      const bob = reducedMotion || leanAngle !== 0 ? 0 : Math.sin(now / 320) * 1.5;
      context.save();
      context.translate(cx, gy + bob);
      context.rotate(leanAngle);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      // torso
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, -30);
      context.stroke();
      // arms swept back
      context.beginPath();
      context.moveTo(0, -24);
      context.lineTo(-9, -14 + leanAngle * 10);
      context.moveTo(0, -24);
      context.lineTo(9, -14 - leanAngle * 6);
      context.stroke();
      // head
      context.beginPath();
      context.arc(0, -37, 6, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      // ground
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, gy + 6);
      context.lineTo(w, gy + 6);
      context.stroke();
    };

    const drawBackdrop = () => {
      if (!context) return;
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, w, h);
      // faint receding grid for the rooftop
      context.strokeStyle = accentAlpha(0.08);
      context.lineWidth = 1;
      for (let i = 1; i <= 5; i += 1) {
        const y = gy + 6 + i * 9;
        if (y > h) break;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(w, y);
        context.stroke();
      }
    };

    const drawTracer = (p: number, ghost = false) => {
      if (!context || p < 0) return;
      const [x0, y0, x1, y1] = path();
      const x = x0 + (x1 - x0) * p;
      const y = y0 + (y1 - y0) * p;
      // trail
      const trail = ghost ? 3 : 6;
      for (let i = 1; i <= trail; i += 1) {
        const tp = p - i * 0.02;
        if (tp < 0) break;
        const tx = x0 + (x1 - x0) * tp;
        const ty = y0 + (y1 - y0) * tp;
        context.fillStyle = accentAlpha((ghost ? 0.2 : 0.4) * (1 - i / (trail + 1)));
        context.beginPath();
        context.arc(tx, ty, 2.4, 0, Math.PI * 2);
        context.fill();
      }
      // air-warp ripples
      if (!ghost) {
        context.strokeStyle = accentAlpha(0.22);
        context.lineWidth = 1;
        for (let i = 1; i <= 3; i += 1) {
          context.beginPath();
          context.arc(x, y, 5 + i * 6, 0, Math.PI * 2);
          context.stroke();
        }
      }
      // core
      context.fillStyle = ghost ? accentAlpha(0.5) : palette.bright;
      context.beginPath();
      context.arc(x, y, 3.2, 0, Math.PI * 2);
      context.fill();
    };

    const drawLens = (strength: number) => {
      if (!context) return;
      context.strokeStyle = accentAlpha(0.18 + strength * 0.2);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, gy - 26, 44 + strength * 8, 0, Math.PI * 2);
      context.stroke();
    };

    let frame = 0;

    const render = (now: number, p: number, leanAngle: number, ghosts: boolean) => {
      if (!context || !canvas || reducedMotion) return;
      context.save();
      if (now < shakeUntilRef.current) {
        context.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      }
      drawBackdrop();
      drawFigure(leanAngle, now);
      if (ghosts) {
        drawTracer(p - 0.05, true);
        drawTracer(p - 0.1, true);
      }
      drawTracer(p);
      if (inWindowRef.current && phase === "charging") {
        drawLens(Math.sin(now / 120) * 0.5 + 0.5);
      }
      if (phase === "dodging") drawLens(1);
      if (now < flashUntilRef.current) {
        context.fillStyle = accentAlpha(0.16);
        context.fillRect(0, 0, w, h);
      }
      context.restore();
    };

    // Static frame for reduced motion / terminal states.
    const renderStatic = (p: number, leanAngle = 0) => {
      if (!context || !canvas) return;
      drawBackdrop();
      drawFigure(leanAngle, 0);
      if (p >= 0) drawTracer(p);
    };

    const stop = () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };

    if (phase === "hit") {
      // Brief impact shake, then a still frame.
      if (reducedMotion) {
        renderStatic(1);
        return stop;
      }
      const step = () => {
        const now = performance.now();
        render(now, 1, 0, false);
        if (now < shakeUntilRef.current || now < flashUntilRef.current) {
          frame = window.requestAnimationFrame(step);
        }
      };
      frame = window.requestAnimationFrame(step);
      return stop;
    }

    if (phase === "paused") {
      const p =
        pausedPhaseRef.current === "charging"
          ? Math.min(1, tracerElapsed(pausedElapsedRef.current, cfg) / cfg.chargeMs)
          : -1;
      renderStatic(reducedMotion ? -1 : p);
      return stop;
    }

    const step = () => {
      const now = performance.now();
      if (document.hidden) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      const raw = now - t0Ref.current;

      if (phase === "arming") {
        if (barRef.current) barRef.current.style.width = "0%";
        if (!reducedMotion) {
          render(now, -1, 0, false);
          // muzzle telegraph at the spawn edge
          const context2 = canvas?.getContext("2d");
          if (context2) {
            const [x0, y0] = path();
            const pulse = (raw % 350) / 350;
            context2.strokeStyle = accentAlpha(0.5 * (1 - pulse));
            context2.lineWidth = 2;
            context2.beginPath();
            context2.arc(
              Math.min(Math.max(x0, 8), w - 8),
              Math.min(Math.max(y0, 8), h - 8),
              4 + pulse * 16,
              0,
              Math.PI * 2
            );
            context2.stroke();
          }
        } else {
          renderStatic(-1);
        }
        if (raw >= cfg.armingMs) {
          setPhase("charging");
          return;
        }
      } else if (phase === "charging") {
        const p = Math.min(1, tracerElapsed(raw, cfg) / cfg.chargeMs);
        const inWin = p >= 1 - cfg.windowFrac;
        if (inWin !== inWindowRef.current) {
          inWindowRef.current = inWin;
          setWindowState(inWin ? "in" : "out");
          if (inWin) audioRef.current?.whoosh();
        }
        if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
        if (reducedMotion) renderStatic(p);
        else render(now, p, 0, false);
        if (p >= 1) {
          toHit("The tracer arrived. No lean.");
          return;
        }
      } else if (phase === "dodging") {
        const t = Math.min(1, raw / (reducedMotion ? 500 : DODGE_MS));
        const p = leanPRef.current + t * 0.4; // slow-mo pass over the lean
        if (reducedMotion) renderStatic(Math.min(1.15, p), -0.5);
        else render(now, p, -t * 0.85, true);
        if (t >= 1) {
          setRound((r) => r + 1);
          setPhase("arming");
          return;
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return stop;
  }, [cfg, phase, reducedMotion, toHit]);

  const status = useMemo(() => {
    if (phase === "hit")
      return `${hitReason} ${score} points over ${round} volley${round === 1 ? "" : "s"}.`;
    if (phase === "paused") return "Held. The volley is frozen.";
    if (phase === "dodging") return "Dodged. The world slows around you.";
    if (phase === "arming")
      return `Volley ${round + 1} — tracer from ${cfg.dir === "above" ? "above" : `the ${cfg.dir}`}. Wait for it…`;
    return windowState === "in"
      ? "Now — lean!"
      : "Tracer inbound. Lean at the last instant; too early is fatal.";
  }, [cfg.dir, hitReason, phase, round, score, windowState]);

  return (
    <div
      data-sim-state={phase}
      data-bullet-round={round}
      data-bullet-streak={streak}
      data-bullet-score={score}
      data-bullet-window={windowState}
      className="flex flex-col gap-3"
    >
      <style>{`
        @keyframes matrix-bullet-judge { 0% { opacity: 0; transform: translateY(6px) scale(0.9); } 20% { opacity: 1; transform: translateY(0) scale(1.1); } 100% { opacity: 0; transform: translateY(-22px) scale(1); } }
        @keyframes matrix-bullet-pop { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
      `}</style>

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          volley <span className="text-accent">{round + 1}</span>
        </span>
        <span>
          streak{" "}
          <span className={mult > 1 ? "text-accent-bright" : "text-accent"}>x{mult}</span>{" "}
          ({streak})
        </span>
        <span>
          score{" "}
          <span
            key={score}
            className="inline-block text-accent"
            style={reducedMotion ? undefined : { animation: "matrix-bullet-pop 240ms ease-out" }}
          >
            {score}
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              audio().setMuted(next);
              audio().unlock();
            }}
            aria-pressed={muted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {muted ? "unmute" : "mute"}
          </button>
          {phase !== "hit" && phase !== "dodging" && (
            <button
              type="button"
              onClick={togglePause}
              className="border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* Stage */}
      <div className="relative h-52 overflow-hidden border border-accent/25 bg-ink-soft sm:h-72">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {judgement && (
          <p
            key={judgement.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-6 z-20 text-center text-xs uppercase tracking-[0.24em] ${
              judgement.perfect ? "text-accent-bright" : "text-accent"
            }`}
            style={{
              animation: reducedMotion ? undefined : "matrix-bullet-judge 1100ms ease-out forwards",
            }}
          >
            {judgement.text}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
        {phase === "hit" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/60">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm uppercase tracking-[0.24em] text-accent-bright">hit</p>
              <p className="text-[11px] normal-case text-white/70">
                {round} volley{round === 1 ? "" : "s"} cleared · {score} points
              </p>
              <button
                ref={restartRef}
                type="button"
                onClick={restart}
                className="border border-accent/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Jack back in
              </button>
            </div>
          </div>
        )}
        {phase !== "hit" && phase !== "paused" && (
          <button
            ref={leanRef}
            type="button"
            onClick={lean}
            aria-label="Lean"
            className="absolute inset-0 z-10 touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            {windowState === "in" && phase === "charging" && (
              <span className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs uppercase tracking-[0.3em] text-accent-bright">
                lean now
              </span>
            )}
          </button>
        )}
      </div>

      {/* Reduced-motion / at-a-glance track: where the tracer is, and the
          window zone at the far end. */}
      <div className="relative h-2 w-full overflow-hidden border border-accent/25 bg-white/5" aria-hidden>
        <div
          className={`absolute inset-y-0 right-0 ${windowState === "in" ? "bg-accent/40" : "bg-accent/15"}`}
          style={{ width: `${cfg.windowFrac * 100}%` }}
        />
        <div ref={barRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
        click / tap the stage, or space — streaks raise the multiplier, windows tighten
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function MatrixBulletTime({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="matrix-bullet-time-title"
      gameId="matrix-bullet-time"
      eyebrow="Reflex trial"
      title="Bullet-time"
      startLabel="Enter the loop"
      stage
      howToPlay={{
        objective: "Lean out of every tracer's path — one hit ends the run.",
        controls: [
          { keys: "click", does: "lean back; the whole stage is the control" },
          { keys: "Space", does: "lean from the keyboard — the stage takes focus each volley" },
          { keys: "pause", does: "freeze the volley mid-flight" },
        ],
        tip: "Only the last stretch of the tracer's flight counts. Leaning during the muzzle telegraph, or anywhere before the window opens, is as fatal as not leaning at all — and from the fifth volley on some tracers stall mid-flight to bait an early lean.",
      }}
      reference={{
        quote: "Dodge this.",
        scene: "The Matrix (1999) · the rooftop lean-back that named a technique",
      }}
      onClose={onClose}
    >
      <BulletTime />
    </SimulationShell>
  );
}
