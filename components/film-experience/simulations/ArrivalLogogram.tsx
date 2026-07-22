"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ArrivalKeyframes,
  ArrivalMuteButton,
  ARRIVAL_BUTTON,
  useArrivalAudio,
  useCanvasSize,
  withAlpha,
} from "@/components/film-experience/simulations/ArrivalShared";
import {
  concentricity,
  gradeRing,
  gradeStem,
  inkWidth,
  traceRing,
  traceStem,
  type InkPoint,
} from "@/components/film-experience/simulations/ArrivalInk";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Louise raises the word HUMAN; the heptapods answer in a closed ring. Six
// utterances, each a harder shape held to a higher standard: a plain ring, a
// ring with a stem hanging off it, then two rings drawn inside one another.
// Every stroke is graded on closure, roundness, smoothness, and wholeness —
// the ink either comes back to itself and blooms, or it smears and you try it
// again.
const SCORE_ID = "arrival-logogram";

type ShapeId = "ring" | "stem" | "double";

type Utterance = Readonly<{
  word: string;
  shape: ShapeId;
  /** 0–100 grade the utterance has to clear. */
  threshold: number;
}>;

const UTTERANCES: readonly Utterance[] = [
  { word: "Human", shape: "ring", threshold: 34 },
  { word: "Hello", shape: "ring", threshold: 46 },
  { word: "Louise", shape: "stem", threshold: 50 },
  { word: "Offer", shape: "double", threshold: 54 },
  { word: "Time", shape: "double", threshold: 60 },
  { word: "Gift", shape: "double", threshold: 66 },
];

const STROKES_FOR: Record<ShapeId, number> = { ring: 1, stem: 2, double: 2 };
const SHAPE_NAME: Record<ShapeId, string> = {
  ring: "one closed ring",
  stem: "a ring, then a stem out of its edge",
  double: "two rings, one inside the other",
};

/** Ink is resampled at this spacing so a long stroke stays cheap to paint. */
const SAMPLE_GAP = 0.005;
const MAX_POINTS = 260;
const MAX_MOTES = 56;
const SMEAR_MS = 620;
const BLOOM_MS = 1100;

type Phase = "drawing" | "spoken" | "smeared" | "done";

type Mote = { x: number; y: number; vx: number; vy: number; life: number };

type Verdict = Readonly<{
  score: number;
  closure: number;
  roundness: number;
  smoothness: number;
  accepted: boolean;
}>;

function gradeUtterance(shape: ShapeId, strokes: InkPoint[][]): Verdict {
  const ring = gradeRing(strokes[0] ?? []);
  if (shape === "ring") {
    return {
      score: ring.score,
      closure: ring.closure,
      roundness: ring.roundness,
      smoothness: ring.smoothness,
      accepted: false,
    };
  }
  if (shape === "stem") {
    const stem = gradeStem(strokes[1] ?? [], ring);
    return {
      score: Math.round(ring.score * 0.6 + stem.score * 0.4),
      closure: ring.closure,
      roundness: (ring.roundness + stem.roundness) / 2,
      smoothness: ring.smoothness,
      accepted: false,
    };
  }
  const inner = gradeRing(strokes[1] ?? []);
  const nested = concentricity(ring, inner);
  const average = (ring.score + inner.score) / 2;
  return {
    score: Math.round(average * (0.74 + nested * 0.26)),
    closure: (ring.closure + inner.closure) / 2,
    roundness: (ring.roundness + inner.roundness) / 2,
    smoothness: nested,
    accepted: false,
  };
}

/** A labelled 0–1 bar; the label carries the value, so colour is never the
 * only channel. */
function GradeBar({ label, value }: { label: string; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <span className="h-1.5 flex-1 bg-white/10" aria-hidden>
        <span className="block h-full bg-accent/75" style={{ width: `${percent}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-white/55">
        {percent}
      </span>
    </div>
  );
}

/**
 * The barrier itself. Mounted by the shell only after the visitor starts, so
 * the pointer capture, the render loop, and the audio context all arm on a
 * gesture rather than while the reference card is still being read.
 */
function DrawLogogram() {
  const [phase, setPhase] = useState<Phase>("drawing");
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState(0);
  const [rings, setRings] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [gained, setGained] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useArrivalAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<InkPoint[][]>([]);
  const liveRef = useRef<InkPoint[]>([]);
  const drawingRef = useRef(false);
  const smearRef = useRef<{ points: InkPoint[]; born: number } | null>(null);
  const bloomRef = useRef<number | null>(null);
  const motesRef = useRef<Mote[]>([]);
  const redrawRef = useRef<() => void>(() => {});
  const phaseRef = useRef<Phase>("drawing");
  const indexRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const size = useCanvasSize(canvasRef, () => redrawRef.current());

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const utterance = UTTERANCES[Math.min(index, UTTERANCES.length - 1)];
  const needed = STROKES_FOR[utterance.shape];

  const spawnMotes = useCallback(
    (count: number) => {
      if (reducedMotion) return;
      const motes = motesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (motes.length >= MAX_MOTES) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.08 + Math.random() * 0.5;
        motes.push({
          x: 0.5,
          y: 0.5,
          vx: Math.cos(angle) * speed * 0.006,
          vy: Math.sin(angle) * speed * 0.006,
          life: 1,
        });
      }
    },
    [reducedMotion]
  );

  const finishUtterance = useCallback(
    (strokes: InkPoint[][]) => {
      const current = UTTERANCES[indexRef.current];
      const graded = gradeUtterance(current.shape, strokes);
      const accepted = graded.score >= current.threshold;
      setVerdict({ ...graded, accepted });
      setBest((previous) => Math.max(previous, graded.score));

      if (!accepted) {
        streakRef.current = 0;
        setStreak(0);
        smearRef.current = {
          points: strokes.flat(),
          born: performance.now(),
        };
        strokesRef.current = [];
        liveRef.current = [];
        setPlaced(0);
        audio.play({ freq: 138, type: "sine", duration: 0.5, gain: 0.05, slideTo: 96 });
        phaseRef.current = "smeared";
        setPhase("smeared");
        redrawRef.current();
        return;
      }

      const nextStreak = streakRef.current + 1;
      streakRef.current = nextStreak;
      const points = graded.score * 10 + (nextStreak - 1) * 60;
      scoreRef.current += points;
      setStreak(nextStreak);
      setScore(scoreRef.current);
      setGained({ id: performance.now(), text: `${current.word.toLowerCase()} +${points}` });
      setRings((count) => count + 1);
      recordSimulationScore(SCORE_ID, scoreRef.current);

      bloomRef.current = performance.now();
      spawnMotes(22);
      audio.play({ freq: 392, duration: 0.5, gain: 0.05 });
      audio.play({ freq: 588, duration: 0.7, gain: 0.035, delay: 0.1 });

      const last = indexRef.current + 1 >= UTTERANCES.length;
      phaseRef.current = last ? "done" : "spoken";
      setPhase(last ? "done" : "spoken");
      redrawRef.current();
    },
    [audio, spawnMotes]
  );

  /** A finished stroke either completes the shape or waits for the next one. */
  const settleStroke = useCallback(() => {
    const points = liveRef.current;
    liveRef.current = [];
    if (points.length < 6) {
      redrawRef.current();
      return;
    }
    strokesRef.current = [...strokesRef.current, points];
    setPlaced(strokesRef.current.length);
    audio.play({ freq: 220, duration: 0.22, gain: 0.03 });
    if (strokesRef.current.length >= STROKES_FOR[UTTERANCES[indexRef.current].shape]) {
      finishUtterance(strokesRef.current);
      return;
    }
    redrawRef.current();
  }, [audio, finishUtterance]);

  const clearInk = useCallback(() => {
    strokesRef.current = [];
    liveRef.current = [];
    drawingRef.current = false;
    setPlaced(0);
    redrawRef.current();
  }, []);

  const armUtterance = useCallback((next: number) => {
    strokesRef.current = [];
    liveRef.current = [];
    smearRef.current = null;
    bloomRef.current = null;
    motesRef.current = [];
    setPlaced(0);
    setVerdict(null);
    setIndex(next);
    indexRef.current = next;
    phaseRef.current = "drawing";
    setPhase("drawing");
    redrawRef.current();
  }, []);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    setScore(0);
    setStreak(0);
    setRings(0);
    setBest(0);
    setGained(null);
    armUtterance(0);
  }, [armUtterance]);

  /** The keyboard path to the same reward: the board draws the current shape
   * for you, cleanly enough to clear its own threshold. */
  const trace = useCallback(() => {
    if (phaseRef.current !== "drawing") return;
    const shape = UTTERANCES[indexRef.current].shape;
    const outer = traceRing(0.5, 0.5, 0.3);
    if (shape === "ring") {
      strokesRef.current = [outer];
    } else if (shape === "stem") {
      strokesRef.current = [outer, traceStem(0.5, 0.5, 0.3)];
    } else {
      strokesRef.current = [outer, traceRing(0.5, 0.5, 0.17)];
    }
    setPlaced(strokesRef.current.length);
    finishUtterance(strokesRef.current);
  }, [finishUtterance]);

  const toPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
      t: performance.now(),
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== "drawing") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      bloomRef.current = null;
      smearRef.current = null;
      liveRef.current = [toPoint(event)];
      redrawRef.current();
    },
    [toPoint]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const point = toPoint(event);
      const live = liveRef.current;
      const last = live[live.length - 1];
      // Resample: only keep points that actually moved, and never grow past a
      // bound the paint loop can carry at 60fps.
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < SAMPLE_GAP) return;
      if (live.length >= MAX_POINTS) return;
      live.push(point);
      redrawRef.current();
    },
    [toPoint]
  );

  const onPointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    settleStroke();
  }, [settleStroke]);

  // One render function. rAF drives it when motion is allowed; when it is not,
  // every pointer move and state change calls it directly, so the board still
  // draws — reduced motion loses the drift, not the game.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    // Sampled once: the grade cannot change while this dialog is open, and
    // reading it per frame would cost a style recalculation per tint.
    const palette = getLiveThemePalette();
    const tint = (a: number) => withAlpha(palette.accent, a);

    const paintInk = (points: readonly InkPoint[], w: number, h: number, fade: number) => {
      if (points.length < 2) return;
      context.lineJoin = "round";
      context.lineCap = "round";
      // Two wide, faint passes give the ink its bleed; the core pass carries
      // the pressure, widening where the hand slowed down.
      const base = Math.min(w, h) * 0.012;
      for (const pass of [
        { width: base * 3.4, alpha: 0.05 },
        { width: base * 1.9, alpha: 0.12 },
      ]) {
        context.strokeStyle = tint(pass.alpha * fade);
        context.lineWidth = pass.width;
        context.beginPath();
        context.moveTo(points[0].x * w, points[0].y * h);
        for (let i = 1; i < points.length; i += 1) {
          context.lineTo(points[i].x * w, points[i].y * h);
        }
        context.stroke();
      }
      context.strokeStyle = tint(0.9 * fade);
      for (let i = 1; i < points.length; i += 1) {
        context.lineWidth = inkWidth(points[i - 1], points[i], base);
        context.beginPath();
        context.moveTo(points[i - 1].x * w, points[i - 1].y * h);
        context.lineTo(points[i].x * w, points[i].y * h);
        context.stroke();
      }
    };

    const render = () => {
      const { width: w, height: h } = size.current;
      if (!w || !h) return;
      const now = performance.now();
      const shape = UTTERANCES[Math.min(indexRef.current, UTTERANCES.length - 1)].shape;
      const short = Math.min(w, h);

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, w, h);

      // The board's guide: the shape being asked for, faint, dashed.
      context.setLineDash([4, 7]);
      context.strokeStyle = tint(0.14);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(w * 0.5, h * 0.5, short * 0.3, 0, Math.PI * 2);
      context.stroke();
      if (shape === "double") {
        context.beginPath();
        context.arc(w * 0.5, h * 0.5, short * 0.17, 0, Math.PI * 2);
        context.stroke();
      }
      if (shape === "stem") {
        context.beginPath();
        context.moveTo(w * 0.5 + Math.cos(Math.PI / 4) * short * 0.3, h * 0.5 + Math.sin(Math.PI / 4) * short * 0.3);
        context.lineTo(w * 0.5 + Math.cos(Math.PI / 4) * short * 0.52, h * 0.5 + Math.sin(Math.PI / 4) * short * 0.52);
        context.stroke();
      }
      context.setLineDash([]);

      for (const stroke of strokesRef.current) paintInk(stroke, w, h, 1);

      const live = liveRef.current;
      paintInk(live, w, h, 1);

      // While a stroke is open, mark where it began — closure is the whole
      // point, so the target is never hidden.
      if (live.length > 1) {
        const first = live[0];
        const last = live[live.length - 1];
        const gap = Math.hypot(last.x - first.x, last.y - first.y);
        const near = gap < 0.09;
        context.strokeStyle = tint(near ? 0.95 : 0.35);
        context.lineWidth = near ? 2 : 1;
        context.beginPath();
        context.arc(first.x * w, first.y * h, near ? 9 : 6, 0, Math.PI * 2);
        context.stroke();
      }

      // A failed utterance smears: the ink drifts off its own path and fades.
      const smear = smearRef.current;
      if (smear) {
        const life = reducedMotion ? 0.55 : Math.min(1, (now - smear.born) / SMEAR_MS);
        const drift = life * short * 0.05;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.strokeStyle = tint((1 - life) * 0.55);
        context.lineWidth = Math.min(w, h) * 0.012 * (1 + life * 2.4);
        context.beginPath();
        smear.points.forEach((point, i) => {
          const angle = i * 0.7;
          const x = point.x * w + Math.cos(angle) * drift;
          const y = point.y * h + Math.sin(angle) * drift;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
        if (!reducedMotion && life >= 1) smearRef.current = null;
      }

      // A cleared utterance blooms: rings expanding out of the centre, with
      // motes carried on them.
      const bloomBorn = bloomRef.current;
      if (bloomBorn !== null) {
        const life = reducedMotion ? 0.45 : Math.min(1, (now - bloomBorn) / BLOOM_MS);
        for (let ring = 0; ring < 3; ring += 1) {
          const offset = Math.max(0, life - ring * 0.16);
          if (offset <= 0) continue;
          context.strokeStyle = tint((1 - offset) * 0.6);
          context.lineWidth = 3 - offset * 2;
          context.beginPath();
          context.arc(w * 0.5, h * 0.5, short * (0.1 + offset * 0.42), 0, Math.PI * 2);
          context.stroke();
        }
        if (!reducedMotion && life >= 1) bloomRef.current = null;
      }

      const motes = motesRef.current;
      if (motes.length) {
        context.fillStyle = palette.bright;
        for (let i = motes.length - 1; i >= 0; i -= 1) {
          const mote = motes[i];
          if (!reducedMotion) {
            mote.x += mote.vx;
            mote.y += mote.vy;
            mote.life -= 0.012;
          }
          if (mote.life <= 0) {
            motes.splice(i, 1);
            continue;
          }
          context.globalAlpha = mote.life * 0.5;
          context.beginPath();
          context.arc(mote.x * w, mote.y * h, 1.6, 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      }
    };

    redrawRef.current = render;
    render();

    if (reducedMotion) return;

    let frame = 0;
    const step = () => {
      if (!document.hidden) render();
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, size]);

  useEffect(() => {
    if (phase === "spoken" || phase === "done" || phase === "smeared") {
      window.requestAnimationFrame(() => nextRef.current?.focus());
    }
  }, [phase]);

  const status = useMemo(() => {
    if (phase === "done")
      return `Six utterances answered. ${score} points, best stroke ${best} of 100.`;
    if (phase === "spoken" && verdict)
      return `The ring closes. It says “${utterance.word}” — graded ${verdict.score}, needed ${utterance.threshold}.`;
    if (phase === "smeared" && verdict)
      return `The ink smears — graded ${verdict.score}, needed ${utterance.threshold}. Draw it again.`;
    if (placed > 0)
      return `Stroke ${placed} of ${needed} laid. Now draw the rest of it.`;
    return `Draw ${SHAPE_NAME[utterance.shape]} — come back to where you began.`;
  }, [phase, verdict, utterance, placed, needed, score, best]);

  return (
    <div
      data-sim-state={phase}
      data-rings={rings}
      data-logogram-utterance={Math.min(index + 1, UTTERANCES.length)}
      data-logogram-score={score}
      data-logogram-streak={streak}
      className="flex flex-col gap-3"
    >
      <ArrivalKeyframes />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          utterance <span className="text-accent">{Math.min(index + 1, UTTERANCES.length)}</span>/
          {UTTERANCES.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "arr-anim-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          streak <span className="text-accent">{streak}</span>
        </span>
        <span>
          needs <span className="text-accent">{utterance.threshold}</span>
        </span>
        <span className="ml-auto">
          <ArrivalMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-56 w-full touch-none border border-accent/25 bg-ink/60 sm:h-72 lg:h-80"
        />
        {gained && (
          <p
            key={gained.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-4 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "arr-anim-float"
            }`}
          >
            {gained.text}
          </p>
        )}
        {(phase === "spoken" || phase === "done") && (
          <p
            aria-hidden
            className={`pointer-events-none absolute inset-0 grid place-items-center text-2xl tracking-[0.2em] text-white/85 sm:text-3xl ${
              reducedMotion ? "" : "arr-anim-rise"
            }`}
          >
            <span className="bg-ink/60 px-4 py-1">{utterance.word}</span>
          </p>
        )}
      </div>

      {verdict && (
        <div
          className={`flex flex-col gap-1.5 ${
            !reducedMotion && phase === "smeared" ? "arr-anim-shake" : ""
          }`}
        >
          <GradeBar label="closure" value={verdict.closure} />
          <GradeBar label="roundness" value={verdict.roundness} />
          <GradeBar
            label={utterance.shape === "double" ? "nesting" : "smoothness"}
            value={verdict.smoothness}
          />
        </div>
      )}

      <p role="status" className="min-h-[2.2rem] text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex min-h-[2.25rem] flex-wrap gap-2">
        {phase === "drawing" && (
          <>
            <button ref={nextRef} type="button" onClick={trace} className={ARRIVAL_BUTTON}>
              Trace the ring
            </button>
            <button
              type="button"
              onClick={clearInk}
              disabled={placed === 0}
              className={ARRIVAL_BUTTON}
            >
              Clear the ink
            </button>
          </>
        )}
        {phase === "spoken" && (
          <button
            ref={nextRef}
            type="button"
            onClick={() => armUtterance(index + 1)}
            className={ARRIVAL_BUTTON}
          >
            Answer again
          </button>
        )}
        {phase === "smeared" && (
          <button
            ref={nextRef}
            type="button"
            onClick={() => armUtterance(index)}
            className={ARRIVAL_BUTTON}
          >
            Draw it again
          </button>
        )}
        {phase === "done" && (
          <button ref={nextRef} type="button" onClick={restart} className={ARRIVAL_BUTTON}>
            Raise the board again
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ArrivalLogogram({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="arrival-logogram-title"
      gameId="arrival-logogram"
      eyebrow="First lesson"
      title="Draw the logogram"
      startLabel="Raise the board"
      stage
      reference={{
        quote: "Human.",
        scene: "Arrival (2016) · Louise at the barrier, whiteboard raised",
      }}
      howToPlay={{
        objective: "Draw six logograms cleanly enough that each one is understood.",
        controls: [
          { keys: "drag", does: "lay one stroke of ink across the board" },
          { keys: "release", does: "settle that stroke; the shape is graded once all its strokes are down" },
          { keys: "click", does: "trace the ring for a clean stroke, or clear the ink and start over" },
        ],
        tip: "Every stroke is graded on closure, roundness and smoothness — end where you began, and a streak of clean shapes pays a rising bonus.",
      }}
      onClose={onClose}
    >
      <DrawLogogram />
    </SimulationShell>
  );
}
