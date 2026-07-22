"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  BatmanChip,
  BatmanKeyframes,
  BatmanMuteButton,
  useBatmanAudio,
  useCanvasAutoSize,
} from "@/components/film-experience/simulations/TheBatmanShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// The walk out of the dark, as a stealth stage rather than a single button.
//
// Three levels of platform. Each has sweeping lights on their own periods and,
// later, cameras that blink on a duty cycle. You move one cell at a time and a
// step takes time to commit — the light can find you mid-move. Under turn play
// standing still is not safe either: a cell you are holding can be swept, and
// the shadow map tells you in advance. A limited "hold the dark" burns a charge
// to survive one beat. Reach the far end and you arrive on your own terms.

const SCORE_ID = "the-batman-vengeance";
const COMMIT_MS = 620;
const IMMUNE_MS = 1150;
const ALERT_LIMIT = 4;
/** Reduced motion turns the sweep into turns: one tick per action, same maths. */
const TICK_MS = 620;

type Sweep = Readonly<{ period: number; offset: number; width: number }>;
type Camera = Readonly<{ cell: number; period: number; duty: number; offset: number }>;
type Stage = Readonly<{
  id: string;
  title: string;
  cells: number;
  sweeps: readonly Sweep[];
  cameras: readonly Camera[];
  charges: number;
}>;

const STAGES: readonly Stage[] = [
  {
    id: "tunnel",
    title: "The service tunnel",
    cells: 7,
    sweeps: [{ period: 3100, offset: 0, width: 0.13 }],
    cameras: [],
    charges: 2,
  },
  {
    id: "mezzanine",
    title: "The mezzanine",
    cells: 8,
    sweeps: [
      { period: 2700, offset: 0, width: 0.12 },
      { period: 4300, offset: 1300, width: 0.1 },
    ],
    cameras: [{ cell: 4, period: 3700, duty: 0.34, offset: 900 }],
    charges: 2,
  },
  {
    id: "platform",
    title: "The platform",
    cells: 9,
    sweeps: [
      { period: 2300, offset: 0, width: 0.12 },
      { period: 3300, offset: 800, width: 0.11 },
      { period: 5100, offset: 2100, width: 0.09 },
    ],
    cameras: [
      { cell: 3, period: 3100, duty: 0.32, offset: 400 },
      { cell: 6, period: 4100, duty: 0.3, offset: 2000 },
    ],
    charges: 3,
  },
];

type Phase = "stalking" | "moving" | "caught" | "cleared" | "paused" | "busted" | "done";

/** Where a cell sits across the panel, 0..1. */
const cellNorm = (cell: number, cells: number) => 0.1 + (cell / (cells - 1)) * 0.8;

/** A sweep's centre at a given time: a triangle wave across the panel. */
function sweepCentre(sweep: Sweep, timeMs: number): number {
  const t = (((timeMs + sweep.offset) % sweep.period) + sweep.period) % sweep.period;
  const phase = t / sweep.period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

function cameraOn(camera: Camera, timeMs: number): boolean {
  const t = (((timeMs + camera.offset) % camera.period) + camera.period) % camera.period;
  return t < camera.period * camera.duty;
}

/** Is the given normalized position lit by anything at this instant? */
function litAt(stage: Stage, timeMs: number, position: number): boolean {
  for (const sweep of stage.sweeps) {
    if (Math.abs(sweepCentre(sweep, timeMs) - position) <= sweep.width) return true;
  }
  for (const camera of stage.cameras) {
    if (!cameraOn(camera, timeMs)) continue;
    if (Math.abs(cellNorm(camera.cell, stage.cells) - position) <= 0.07) return true;
  }
  return false;
}

function PlatformWalk() {
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("stalking");
  const [cell, setCell] = useState(0);
  const [alert, setAlert] = useState(0);
  const [charges, setCharges] = useState(STAGES[0].charges);
  const [score, setScore] = useState(0);
  const [clean, setClean] = useState(true);
  const [litNow, setLitNow] = useState(false);
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [shakeTick, setShakeTick] = useState(0);

  const reducedMotion = useReducedMotion();
  const audio = useBatmanAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const stepRef = useRef<HTMLButtonElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("stalking");
  const cellRef = useRef(0);
  const stageRef = useRef(0);
  const tickRef = useRef(0);
  const scoreRef = useRef(0);
  const alertRef = useRef(0);
  const litRef = useRef(false);
  const immuneUntilRef = useRef(0);
  const immuneTicksRef = useRef(0);
  const moveRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const startedRef = useRef(0);
  const caughtAtRef = useRef(-1);
  const arriveAtRef = useRef(-1);
  const drawRef = useRef<(now: number) => void>(() => {});
  const { freshPress, markPress } = useFreshPress(phase);

  const stage = STAGES[stageIndex];

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    cellRef.current = cell;
  }, [cell]);
  useEffect(() => {
    stageRef.current = stageIndex;
  }, [stageIndex]);

  const armStage = useCallback((index: number) => {
    const next = STAGES[index];
    setStageIndex(index);
    stageRef.current = index;
    setCell(0);
    cellRef.current = 0;
    setCharges(next.charges);
    setClean(true);
    tickRef.current = 0;
    setTick(0);
    immuneUntilRef.current = 0;
    immuneTicksRef.current = 0;
    moveRef.current = null;
    caughtAtRef.current = -1;
    arriveAtRef.current = -1;
    startedRef.current = performance.now();
    phaseRef.current = "stalking";
    setPhase("stalking");
    window.requestAnimationFrame(() => stepRef.current?.focus());
  }, []);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    alertRef.current = 0;
    setScore(0);
    setAlert(0);
    setNote(null);
    armStage(0);
  }, [armStage]);

  useEffect(() => {
    armStage(0);
  }, [armStage]);

  const bust = useCallback(() => {
    audio.fail();
    recordSimulationScore(SCORE_ID, scoreRef.current);
    phaseRef.current = "busted";
    setPhase("busted");
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio]);

  const getCaught = useCallback(() => {
    audio.wrong();
    caughtAtRef.current = performance.now();
    moveRef.current = null;
    setClean(false);
    setShakeTick((t) => t + 1);
    alertRef.current += 1;
    setAlert(alertRef.current);
    const knocked = Math.max(0, cellRef.current - 2);
    cellRef.current = knocked;
    setCell(knocked);
    if (alertRef.current >= ALERT_LIMIT) {
      bust();
      return;
    }
    phaseRef.current = "caught";
    setPhase("caught");
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio, bust]);

  const clearStage = useCallback(() => {
    arriveAtRef.current = performance.now();
    const seconds = (performance.now() - startedRef.current) / 1000;
    const speed = Math.max(0, Math.round(240 - seconds * 6));
    const bonus = 320 + speed + (clean ? 200 : 0);
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `${stage.title} cleared +${bonus}` });
    const last = stageRef.current + 1 >= STAGES.length;
    if (last) {
      audio.win();
      recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = "done";
      setPhase("done");
    } else {
      audio.clear();
      phaseRef.current = "cleared";
      setPhase("cleared");
    }
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio, clean, stage.title]);

  /** Turn-based resolution: advance one tick, then see what the light found. */
  const resolveTurn = useCallback(
    (nextCell: number) => {
      const nextTick = tickRef.current + 1;
      tickRef.current = nextTick;
      setTick(nextTick);
      cellRef.current = nextCell;
      setCell(nextCell);
      const immune = immuneTicksRef.current > 0;
      if (immune) immuneTicksRef.current -= 1;
      const seen =
        !immune &&
        litAt(STAGES[stageRef.current], nextTick * TICK_MS, cellNorm(nextCell, STAGES[stageRef.current].cells));
      if (seen) {
        getCaught();
        return;
      }
      if (nextCell >= STAGES[stageRef.current].cells - 1) {
        clearStage();
        return;
      }
      audio.tick(nextCell);
      drawRef.current(performance.now());
    },
    [audio, clearStage, getCaught]
  );

  const move = useCallback(
    (delta: number) => {
      if (phaseRef.current !== "stalking") return;
      audio.unlock();
      const active = STAGES[stageRef.current];
      const target = Math.max(0, Math.min(active.cells - 1, cellRef.current + delta));
      if (reducedMotion) {
        scoreRef.current += delta > 0 ? 40 : 0;
        setScore(scoreRef.current);
        resolveTurn(target);
        return;
      }
      if (target === cellRef.current && delta !== 0) return;
      moveRef.current = { from: cellRef.current, to: target, start: performance.now() };
      if (delta > 0) {
        scoreRef.current += 40;
        setScore(scoreRef.current);
      }
      audio.tick(target);
      phaseRef.current = "moving";
      setPhase("moving");
    },
    [audio, reducedMotion, resolveTurn]
  );

  const wait = useCallback(() => {
    if (phaseRef.current !== "stalking") return;
    audio.unlock();
    if (reducedMotion) {
      resolveTurn(cellRef.current);
      return;
    }
    // Live play has no discrete turn — waiting is simply not pressing step.
    audio.tick(0);
  }, [audio, reducedMotion, resolveTurn]);

  const holdTheDark = useCallback(() => {
    if (phaseRef.current !== "stalking" && phaseRef.current !== "moving") return;
    if (charges <= 0) return;
    audio.unlock();
    audio.sweep();
    setCharges((left) => left - 1);
    if (reducedMotion) {
      immuneTicksRef.current = 1;
      setNote({ id: performance.now(), text: "held the dark — one beat" });
    } else {
      immuneUntilRef.current = performance.now() + IMMUNE_MS;
      setNote({ id: performance.now(), text: "held the dark" });
    }
  }, [audio, charges, reducedMotion]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "stalking") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "stalking";
      setPhase("stalking");
    }
  }, []);

  // Keyboard: the whole stage plays from the arrow keys and the space bar.
  useEffect(() => {
    if (phase !== "stalking") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowDown" || event.key === "." ) {
        event.preventDefault();
        wait();
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        holdTheDark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdTheDark, move, phase, wait]);

  // --- The platform -------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      // Size comes from the ResizeObserver, not from a layout read per frame.
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      const active = STAGES[stageRef.current];
      const clock = reducedMotion ? tickRef.current * TICK_MS : now;
      const floor = height - 26;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Tiled back wall and the pillars of the platform.
      context.strokeStyle = accentAlpha(0.08);
      context.lineWidth = 1;
      context.beginPath();
      for (let gx = 0; gx < width; gx += 22) {
        context.moveTo(gx, height * 0.18);
        context.lineTo(gx, floor);
      }
      for (let gy = height * 0.18; gy < floor; gy += 18) {
        context.moveTo(0, gy);
        context.lineTo(width, gy);
      }
      context.stroke();

      context.strokeStyle = accentAlpha(0.18);
      for (let i = 0; i < 4; i += 1) {
        const px = width * (0.18 + i * 0.22);
        context.strokeRect(px - 5, height * 0.2, 10, floor - height * 0.2);
      }

      // The floor line and the cells along it.
      context.strokeStyle = accentAlpha(0.3);
      context.beginPath();
      context.moveTo(6, floor);
      context.lineTo(width - 6, floor);
      context.stroke();

      context.beginPath();
      for (let i = 0; i < active.cells; i += 1) {
        const cx = cellNorm(i, active.cells) * width;
        context.moveTo(cx, floor - 4);
        context.lineTo(cx, floor + 4);
      }
      context.strokeStyle = accentAlpha(0.22);
      context.stroke();

      // Sweeping lights: a cone from the ceiling with falloff.
      for (const sweep of active.sweeps) {
        const centre = sweepCentre(sweep, clock);
        const cx = centre * width;
        const half = sweep.width * width;
        const cone = context.createLinearGradient(cx - half * 1.6, 0, cx + half * 1.6, 0);
        cone.addColorStop(0, "rgba(0,0,0,0)");
        cone.addColorStop(0.5, accentAlpha(0.2));
        cone.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = cone;
        context.beginPath();
        context.moveTo(cx - half * 0.35, 0);
        context.lineTo(cx + half * 0.35, 0);
        context.lineTo(cx + half * 1.6, floor);
        context.lineTo(cx - half * 1.6, floor);
        context.closePath();
        context.fill();
        context.fillStyle = accentAlpha(0.5);
        context.fillRect(cx - 4, 0, 8, 3);
      }

      // Cameras: a housing on the wall and a cone while the light is on.
      for (const camera of active.cameras) {
        const cx = cellNorm(camera.cell, active.cells) * width;
        const on = cameraOn(camera, clock);
        context.strokeStyle = accentAlpha(on ? 0.8 : 0.3);
        context.lineWidth = 1;
        context.strokeRect(cx - 6, height * 0.16, 12, 7);
        if (on) {
          context.fillStyle = accentAlpha(0.14);
          context.beginPath();
          context.moveTo(cx, height * 0.23);
          context.lineTo(cx - 0.075 * width, floor);
          context.lineTo(cx + 0.075 * width, floor);
          context.closePath();
          context.fill();
        }
        // A blink glyph so the camera state is not carried by color alone.
        context.fillStyle = accentAlpha(on ? 0.9 : 0.35);
        context.font = "8px monospace";
        context.fillText(on ? "●" : "○", cx - 3, height * 0.14);
      }

      // The figure: interpolated while a step commits.
      const movement = moveRef.current;
      let position = cellNorm(cellRef.current, active.cells);
      if (movement && !reducedMotion) {
        const t = Math.min(1, Math.max(0, (now - movement.start) / COMMIT_MS));
        position =
          cellNorm(movement.from, active.cells) +
          (cellNorm(movement.to, active.cells) - cellNorm(movement.from, active.cells)) * t;
      }
      const px = position * width;
      const immune = reducedMotion
        ? immuneTicksRef.current > 0
        : now < immuneUntilRef.current;
      const seen = litRef.current;
      context.fillStyle = accentAlpha(seen ? 1 : immune ? 0.35 : 0.6);
      context.beginPath();
      context.arc(px, floor - 22, 4.2, 0, Math.PI * 2);
      context.fill();
      context.fillRect(px - 2.4, floor - 18, 4.8, 14);
      // The cape reads as two strokes off the shoulders.
      context.strokeStyle = accentAlpha(seen ? 0.9 : 0.4);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(px - 2.4, floor - 17);
      context.lineTo(px - 7, floor - 4);
      context.moveTo(px + 2.4, floor - 17);
      context.lineTo(px + 7, floor - 4);
      context.stroke();
      if (immune) {
        context.strokeStyle = accentAlpha(0.5);
        context.beginPath();
        context.arc(px, floor - 14, 12, 0, Math.PI * 2);
        context.stroke();
      }

      // The exit stair at the far end.
      context.strokeStyle = accentAlpha(0.45);
      context.beginPath();
      for (let i = 0; i < 4; i += 1) {
        context.moveTo(width - 26 + i * 5, floor - i * 5);
        context.lineTo(width - 6, floor - i * 5);
      }
      context.stroke();

      // Being seen: a hard flash across the panel.
      if (caughtAtRef.current > 0) {
        const t = reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (now - caughtAtRef.current) / 520));
        if (t < 1) {
          context.fillStyle = accentAlpha(0.42 * (1 - t));
          context.fillRect(0, 0, width, height);
        }
      }

      // The arrival: the figure rises into the frame and the platform flares.
      if (arriveAtRef.current > 0) {
        const t = reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (now - arriveAtRef.current) / 900));
        context.strokeStyle = palette.bright;
        context.globalAlpha = 0.6 * (1 - t) + 0.25;
        context.lineWidth = 2;
        context.strokeRect(4, 4, width - 8, height - 8);
        context.globalAlpha = 1;
        context.fillStyle = accentAlpha(0.1 * (1 - t));
        context.fillRect(0, 0, width, height);
      }
    };
    drawRef.current = draw;

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const active = STAGES[stageRef.current];
        const immune = now < immuneUntilRef.current;
        const movement = moveRef.current;
        let position = cellNorm(cellRef.current, active.cells);
        if (movement) {
          const t = Math.min(1, Math.max(0, (now - movement.start) / COMMIT_MS));
          position =
            cellNorm(movement.from, active.cells) +
            (cellNorm(movement.to, active.cells) - cellNorm(movement.from, active.cells)) * t;
          if (t >= 1) {
            moveRef.current = null;
            cellRef.current = movement.to;
            setCell(movement.to);
            if (movement.to >= active.cells - 1) {
              clearStage();
            } else if (phaseRef.current === "moving") {
              phaseRef.current = "stalking";
              setPhase("stalking");
            }
          }
        }
        const seen = !immune && litAt(active, now, position);
        if (seen !== litRef.current) {
          litRef.current = seen;
          setLitNow(seen);
        }
        // Standing in the light is survivable — you simply cannot move through
        // it. The risk lives in the commit: once a step starts it has to
        // finish, and the sweep can arrive while you are between cells.
        if (seen && phaseRef.current === "moving") getCaught();
        draw(now);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [clearStage, getCaught, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, cell, phase, stageIndex, tick]);

  // --- Readouts -----------------------------------------------------------

  // In turn play these say what the next beat holds, so a move is a decision
  // with information rather than a guess.
  const nextSafe = useMemo(() => {
    if (!reducedMotion) return !litNow;
    const target = Math.min(stage.cells - 1, cell + 1);
    return !litAt(stage, (tick + 1) * TICK_MS, cellNorm(target, stage.cells));
  }, [cell, litNow, reducedMotion, stage, tick]);

  const holdSafe = useMemo(() => {
    if (!reducedMotion) return !litNow;
    return !litAt(stage, (tick + 1) * TICK_MS, cellNorm(cell, stage.cells));
  }, [cell, litNow, reducedMotion, stage, tick]);

  const backSafe = useMemo(() => {
    if (!reducedMotion) return !litNow;
    const target = Math.max(0, cell - 1);
    return !litAt(stage, (tick + 1) * TICK_MS, cellNorm(target, stage.cells));
  }, [cell, litNow, reducedMotion, stage, tick]);

  /** The corridor as a row of glyphs — the shadow map, readable without color. */
  const shadowMap = useMemo(() => {
    const clock = reducedMotion ? (tick + 1) * TICK_MS : 0;
    return Array.from({ length: stage.cells }, (_, i) => {
      const isLit = reducedMotion ? litAt(stage, clock, cellNorm(i, stage.cells)) : false;
      return { index: i, lit: isLit, here: i === cell };
    });
  }, [cell, reducedMotion, stage, tick]);

  const over = phase === "busted" || phase === "done";

  const status = useMemo(() => {
    if (phase === "done") return `Every platform walked. ${score} points. I'm vengeance.`;
    if (phase === "busted") return `The platform lit up for good. ${score} points banked.`;
    if (phase === "paused") return "Held in the dark. Nothing is sweeping.";
    if (phase === "cleared") return `${stage.title} is behind you.`;
    if (phase === "caught") return "Seen. Driven back down the platform — wait for the dark.";
    if (phase === "moving") return "Committed. The step has to finish.";
    if (reducedMotion)
      return `Cell ${cell + 1} of ${stage.cells} — the next beat is ${
        nextSafe ? "dark ahead" : "lit ahead"
      }, and holding here is ${holdSafe ? "dark" : "lit"}.`;
    return `Cell ${cell + 1} of ${stage.cells} · ${litNow ? "in the light — hold" : "dark — move now"}`;
  }, [cell, holdSafe, litNow, nextSafe, phase, reducedMotion, score, stage.cells, stage.title]);

  return (
    <div
      data-sim-state={phase}
      data-vengeance-stage={stageIndex + 1}
      data-vengeance-cell={cell}
      data-vengeance-cells={stage.cells}
      data-vengeance-alert={alert}
      data-vengeance-score={score}
      data-vengeance-charges={charges}
      data-vengeance-safe={nextSafe ? "yes" : "no"}
      data-vengeance-hold={holdSafe ? "yes" : "no"}
      data-vengeance-back={backSafe ? "yes" : "no"}
      className={`flex flex-col gap-3 ${
        !reducedMotion && phase === "caught" ? "bat-jolt" : ""
      }`}
      onPointerDownCapture={markPress}
    >
      <BatmanKeyframes />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          stage <span className="text-accent">{stageIndex + 1}</span>/{STAGES.length}
        </span>
        <span>
          cell <span className="text-accent">{cell + 1}</span>/{stage.cells}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "bat-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          alert{" "}
          <span aria-hidden className="text-accent">
            {"▮".repeat(alert)}
            {"▯".repeat(Math.max(0, ALERT_LIMIT - alert))}
          </span>
          <span className="sr-only">
            {alert} of {ALERT_LIMIT}
          </span>
        </span>
        <span>
          dark <span className="text-accent">{charges}</span>
        </span>
        <span className="ml-auto flex gap-2">
          <BatmanMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {!over && (
            <BatmanChip onClick={togglePause} label={phase === "paused" ? "Resume" : "Pause"}>
              {phase === "paused" ? "resume" : "pause"}
            </BatmanChip>
          )}
        </span>
      </div>

      <p className="text-[11px] normal-case leading-relaxed text-white/60">
        <span className="uppercase tracking-[0.14em] text-accent">{stage.title}</span> —{" "}
        {stage.sweeps.length} sweeping {stage.sweeps.length === 1 ? "light" : "lights"}
        {stage.cameras.length > 0
          ? `, ${stage.cameras.length} camera${stage.cameras.length === 1 ? "" : "s"}`
          : ""}
        .
      </p>

      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-44 w-full border border-accent/25 bg-ink/60 sm:h-56"
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-2 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "bat-float"
            }`}
          >
            {note.text}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {reducedMotion && (
        <p
          className="font-mono text-sm tracking-[0.3em] text-accent"
          aria-label={`Next beat: ${shadowMap
            .map((c) => (c.lit ? "lit" : "dark"))
            .join(", ")}. You are in cell ${cell + 1}.`}
        >
          {shadowMap.map((c) => (c.here ? "◈" : c.lit ? "▓" : "·")).join(" ")}
        </p>
      )}

      <div className="h-1 w-full bg-white/10" aria-hidden>
        <div
          className="h-full bg-accent/80 transition-[width] duration-200"
          style={{ width: `${(cell / (stage.cells - 1)) * 100}%` }}
        />
      </div>

      <div
        key={`controls-${shakeTick}`}
        className={`flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] ${
          !reducedMotion && phase === "caught" ? "bat-shake" : ""
        }`}
      >
        {(phase === "stalking" || phase === "moving") && (
          <>
            <button
              ref={stepRef}
              type="button"
              onClick={() => move(1)}
              disabled={phase === "moving"}
              aria-label="Step forward one cell"
              className="bat-press border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Step {reducedMotion ? (nextSafe ? "· dark ahead" : "· lit ahead") : ""}
            </button>
            <BatmanChip onClick={() => move(-1)} label="Step back one cell">
              back
            </BatmanChip>
            <BatmanChip onClick={wait} label="Wait one beat">
              wait
            </BatmanChip>
            <BatmanChip
              onClick={holdTheDark}
              disabled={charges <= 0}
              label="Hold the dark"
            >
              hold the dark ({charges})
            </BatmanChip>
          </>
        )}
        {phase === "caught" && (
          <BatmanChip
            innerRef={advanceRef}
            bright
            onClick={() => {
              if (!freshPress()) return;
              caughtAtRef.current = -1;
              phaseRef.current = "stalking";
              setPhase("stalking");
              window.requestAnimationFrame(() => stepRef.current?.focus());
            }}
          >
            Back to the shadows
          </BatmanChip>
        )}
        {phase === "cleared" && (
          <BatmanChip
            innerRef={advanceRef}
            bright
            onClick={() => {
              if (freshPress()) armStage(stageRef.current + 1);
            }}
          >
            Next platform
          </BatmanChip>
        )}
        {over && (
          <BatmanChip
            innerRef={advanceRef}
            bright
            onClick={() => {
              if (freshPress()) restart();
            }}
          >
            {phase === "done" ? "Walk it again" : "Back to the tunnel"}
          </BatmanChip>
        )}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/60">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function TheBatmanVengeance({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="the-batman-vengeance-title"
      gameId="the-batman-vengeance"
      eyebrow="Stealth · shadow"
      title="I'm vengeance"
      startLabel="Step from the dark"
      stage
      howToPlay={{
        objective:
          "Walk three lit platforms end to end without being caught in a sweep.",
        controls: [
          { keys: "→", does: "step forward one cell — the step commits and can be caught mid-move" },
          { keys: "←", does: "step back one cell" },
          { keys: "↓ / .", does: "wait a beat and let the sweep pass" },
          { keys: "H", does: "hold the dark — one charge buys a beat of immunity" },
        ],
        tip: "Standing in the light is survivable; moving through it is not. Being seen knocks you two cells back, and four sightings end the run. Under reduced motion the walk is turn-based and the shadow map shows which cells are lit on the next beat.",
      }}
      reference={{
        quote: "I'm vengeance.",
        scene: "The Batman (2022) · boots out of the shadow at the subway platform",
      }}
      onClose={onClose}
    >
      <PlatformWalk />
    </SimulationShell>
  );
}
