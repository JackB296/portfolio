"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ODYSSEY_BUTTON,
  OdysseyKeyframes,
  OdysseyMuteButton,
  useOdysseyAudio,
} from "@/components/film-experience/simulations/SpaceOdysseyShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useFreshPress } from "@/lib/useFreshPress";
import { useReducedMotion } from "@/lib/useReducedMotion";

// The most famous cut in cinema, as a two-beat timing game. Hold to wind up —
// power sets how high and how long the bone hangs — release to throw, then cut
// at the apex. Wind skews the apex off centre, so the top of the arc is never
// simply the middle of the flight, and the window tightens every throw. A
// clean cut plays the match as a real graphic morph: bone becomes orbiter.
const SCORE_ID = "space-odyssey-bone";

type ThrowSpec = Readonly<{ window: number; wind: number; hang: number }>;

// Fixed per throw, so the run is learnable and the spec is deterministic.
const THROWS: readonly ThrowSpec[] = [
  { window: 0.15, wind: 0, hang: 2300 },
  { window: 0.115, wind: 0.24, hang: 2100 },
  { window: 0.09, wind: -0.36, hang: 1950 },
  { window: 0.07, wind: 0.46, hang: 1800 },
  { window: 0.055, wind: -0.55, hang: 1700 },
];
// Reduced motion keeps the arc — it IS the game — but slows the flight and
// widens every window so timing never depends on fast motion.
const REDUCED_WINDOW = 2.6;
const REDUCED_HANG = 1.85;

/** Wind-up ping-pongs across this range; releasing picks the power. */
const POWER_MIN = 0.35;
const POWER_SWEEP_MS = 1150;
/** A hard throw carries further but reads harder at the top. */
const HARD_THROW = 0.8;
const HARD_PENALTY = 0.75;
const MORPH_MS = 950;

type Phase = "ready" | "winding" | "arcing" | "matched" | "missed" | "paused" | "done";
type Grade = "perfect" | "clean" | "loose";

type Star = Readonly<{ x: number; y: number; r: number; phase: number }>;

/** Height 0→1 across the flight, peaking at `apex` and zero at both ends. */
function arcHeight(t: number, apex: number) {
  if (t <= 0 || t >= 1) return 0;
  const span = t < apex ? apex : 1 - apex;
  const d = (t - apex) / span;
  return Math.max(0, 1 - d * d);
}

const gradeFor = (offset: number, window: number): Grade =>
  offset <= window * 0.3 ? "perfect" : offset <= window * 0.65 ? "clean" : "loose";

/** Score multiplier from the running streak: doubles at 3, triples at 5. */
const streakMultiplier = (streak: number) => (streak >= 5 ? 3 : streak >= 3 ? 2 : 1);

const GRADE_WORD: Readonly<Record<Grade, string>> = {
  perfect: "match cut",
  clean: "clean cut",
  loose: "loose cut",
};

function Toss() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [index, setIndex] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [grade, setGrade] = useState<Grade>("clean");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useOdysseyAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const powerRef = useRef<HTMLDivElement>(null);

  const phaseRef = useRef<Phase>("ready");
  const indexRef = useRef(0);
  const reducedRef = useRef(false);
  const windUpStartRef = useRef(0);
  const flightStartRef = useRef(0);
  const powerValueRef = useRef(POWER_MIN);
  /** Flight progress 0→1, read by the cut the frame it is pressed. */
  const tRef = useRef(0);
  const cutTRef = useRef(0);
  const cutAngleRef = useRef(0);
  const morphStartRef = useRef(0);
  const flashUntilRef = useRef(0);
  const shakeUntilRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number; a: number }[]>([]);
  const starsRef = useRef<Star[]>([]);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  // The action button swaps in place when a throw resolves, so the trailing
  // half of the very tap that resolved it can land on the new button and skip
  // the result screen. Reject by gesture identity: a deliberate tap begins its
  // press AFTER the phase changed; a stray one began before.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const spec = THROWS[Math.min(index, THROWS.length - 1)];
  const apex = 0.5 + spec.wind * 0.16;

  /** The live window, widened for reduced motion and narrowed by a hard throw. */
  const windowFor = useCallback((power: number, at: number) => {
    const base = THROWS[Math.min(at, THROWS.length - 1)].window;
    const scaled = reducedRef.current ? base * REDUCED_WINDOW : base;
    return power > HARD_THROW ? scaled * HARD_PENALTY : scaled;
  }, []);

  const beginWind = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    audio.unlock();
    windUpStartRef.current = performance.now();
    powerValueRef.current = POWER_MIN;
    phaseRef.current = "winding";
    setPhase("winding");
  }, [audio]);

  const release = useCallback(() => {
    if (phaseRef.current !== "winding") return;
    trailRef.current = [];
    flightStartRef.current = performance.now();
    tRef.current = 0;
    audio.play({ freq: 140, slideTo: 420, duration: 0.28, gain: 0.05, type: "triangle" });
    phaseRef.current = "arcing";
    setPhase("arcing");
  }, [audio]);

  const land = useCallback(
    (reason: "fell" | "early" | "late") => {
      shakeUntilRef.current = performance.now() + 340;
      audio.play({ freq: 150, slideTo: 60, duration: 0.3, gain: 0.06, type: "sawtooth" });
      streakRef.current = 0;
      setStreak(0);
      setNote({
        id: performance.now(),
        text:
          reason === "fell"
            ? "fell to the dirt"
            : reason === "early"
              ? "cut before the apex"
              : "cut after the apex",
      });
      phaseRef.current = "missed";
      setPhase("missed");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const cut = useCallback(() => {
    if (phaseRef.current !== "arcing") return;
    const t = tRef.current;
    const at = indexRef.current;
    const window_ = windowFor(powerValueRef.current, at);
    const apexAt = 0.5 + THROWS[Math.min(at, THROWS.length - 1)].wind * 0.16;
    const offset = Math.abs(t - apexAt);
    cutTRef.current = t;

    if (offset > window_) {
      land(t < apexAt ? "early" : "late");
      return;
    }

    const nextGrade = gradeFor(offset, window_);
    const acc = Math.max(1, Math.round(100 * (1 - offset / window_)));
    const nextStreak = streakRef.current + 1;
    const multiplier = streakMultiplier(nextStreak);
    // Reach is rewarded: a harder throw banks more, and it is harder to read.
    const reach = Math.round(powerValueRef.current * 40);
    const gained = (acc + reach) * multiplier;

    streakRef.current = nextStreak;
    scoreRef.current += gained;
    setStreak(nextStreak);
    setScore(scoreRef.current);
    setAccuracy(acc);
    setGrade(nextGrade);
    setBest((current) => Math.max(current, acc));
    setNote({
      id: performance.now(),
      text: `${GRADE_WORD[nextGrade]} +${gained}${multiplier > 1 ? ` ×${multiplier}` : ""}`,
    });

    morphStartRef.current = performance.now();
    flashUntilRef.current = performance.now() + 260;
    audio.play({ freq: 523.25, duration: 0.16, gain: 0.06, type: "triangle" });
    audio.play({ freq: 784, duration: 0.4, gain: 0.06, type: "triangle", delay: 0.12 });

    const last = at + 1 >= THROWS.length;
    if (last) {
      recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = "done";
      setPhase("done");
    } else {
      phaseRef.current = "matched";
      setPhase("matched");
    }
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio, land, windowFor]);

  const nextThrow = useCallback(() => {
    const next = phaseRef.current === "missed" ? indexRef.current : indexRef.current + 1;
    indexRef.current = next;
    setIndex(next);
    tRef.current = 0;
    trailRef.current = [];
    powerValueRef.current = POWER_MIN;
    setNote(null);
    phaseRef.current = "ready";
    setPhase("ready");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, []);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    indexRef.current = 0;
    setScore(0);
    setStreak(0);
    setIndex(0);
    setAccuracy(0);
    setBest(0);
    setNote(null);
    tRef.current = 0;
    trailRef.current = [];
    phaseRef.current = "ready";
    setPhase("ready");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "ready" || phaseRef.current === "winding") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "ready";
      setPhase("ready");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, []);

  // One rAF loop owns the whole scene: wind-up meter, the arc and its trail,
  // the flight rail needle, the match morph, and the ending frames.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      // A fixed star lattice: seeded from position, so it never re-randomizes
      // mid-run and never allocates per frame.
      starsRef.current = Array.from({ length: 46 }, (_, i) => ({
        x: ((i * 97) % 100) / 100 * width,
        y: ((i * 53) % 100) / 100 * height * 0.8,
        r: 0.5 + ((i * 31) % 10) / 12,
        phase: (i * 17) % 100,
      }));
    };
    size();

    const drawBone = (x: number, y: number, angle: number, morph: number, scale: number) => {
      // The graphic match: the bone's own geometry becomes the orbiter's.
      // Shaft shortens into a hull, the four knobs slide out into panels.
      const span = 20 - morph * 12;
      const knob = 4 - morph * 1.4;
      const panel = morph * 13;
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.scale(scale, scale);
      context.strokeStyle = accentAlpha(0.92);
      context.fillStyle = accentAlpha(0.92);
      context.lineWidth = 4 + morph * 3;
      context.beginPath();
      context.moveTo(-span, 0);
      context.lineTo(span, 0);
      context.stroke();
      for (const [kx, ky] of [
        [-span, -4],
        [-span, 4],
        [span, -4],
        [span, 4],
      ] as const) {
        context.beginPath();
        context.arc(kx, ky, knob, 0, Math.PI * 2);
        context.fill();
      }
      if (panel > 0.5) {
        context.fillStyle = accentAlpha(0.5);
        context.fillRect(-span - panel - 2, -3, panel, 6);
        context.fillRect(span + 2, -3, panel, 6);
      }
      context.restore();
    };

    const drawStars = (now: number, alpha: number) => {
      if (alpha <= 0.01) return;
      for (const star of starsRef.current) {
        const twinkle = reducedRef.current
          ? 0.6
          : 0.45 + 0.55 * Math.abs(Math.sin(now / 1400 + star.phase));
        context.fillStyle = accentAlpha(alpha * twinkle * 0.5);
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }
    };

    const draw = (now: number) => {
      const palette = getLiveThemePalette();
      const current = phaseRef.current;
      const at = indexRef.current;
      const activeSpec = THROWS[Math.min(at, THROWS.length - 1)];
      const apexAt = 0.5 + activeSpec.wind * 0.16;
      const orbital = current === "matched" || current === "done";
      const morphRaw = orbital
        ? Math.min(1, (now - morphStartRef.current) / MORPH_MS)
        : 0;
      const morph = reducedRef.current && orbital ? 1 : morphRaw;

      context.clearRect(0, 0, width, height);

      // Screen shake on a miss: the camera, not the sprite.
      const shaking = !reducedRef.current && now < shakeUntilRef.current;
      context.save();
      if (shaking) {
        const k = (shakeUntilRef.current - now) / 340;
        context.translate((Math.random() - 0.5) * 9 * k, (Math.random() - 0.5) * 9 * k);
      }

      drawStars(now, morph);

      const ground = height * 0.9;
      const rise = height * 0.72;

      // The dirt line fades out as the match carries us into orbit.
      if (morph < 1) {
        context.strokeStyle = accentAlpha(0.28 * (1 - morph));
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, ground);
        context.lineTo(width, ground);
        context.stroke();
      }

      // Orbit ellipse blooms in behind the morphing shape.
      if (morph > 0.05) {
        context.strokeStyle = accentAlpha(0.22 * morph);
        context.lineWidth = 1;
        context.beginPath();
        context.ellipse(width / 2, height / 2, width * 0.34, height * 0.3, 0, 0, Math.PI * 2);
        context.stroke();
      }

      // Advance the flight.
      if (current === "arcing") {
        const hang =
          activeSpec.hang *
          (0.75 + powerValueRef.current * 0.45) *
          (reducedRef.current ? REDUCED_HANG : 1);
        const t = (now - flightStartRef.current) / hang;
        tRef.current = Math.min(1, t);
        if (t >= 1) {
          // Handled outside the paint pass on the next tick.
          tRef.current = 1;
        }
      }

      let t = current === "arcing" ? tRef.current : orbital || current === "missed" ? cutTRef.current : 0;
      if (current === "missed" && cutTRef.current === 0) t = 1;

      const h = current === "ready" || current === "winding" ? 0 : arcHeight(t, apexAt);
      const drift = activeSpec.wind * width * 0.16;
      const baseX = width * 0.3 + t * (width * 0.34) + drift * t;
      const powerHeight = current === "arcing" || orbital ? powerValueRef.current : 1;
      const y = ground - h * rise * (0.55 + powerHeight * 0.45);
      const angle =
        current === "arcing"
          ? (now - flightStartRef.current) / (reducedRef.current ? 320 : 130)
          : cutAngleRef.current;
      if (current === "arcing") cutAngleRef.current = angle;

      // Trail: a short decaying ribbon behind the tumbling bone.
      if (current === "arcing" && !reducedRef.current) {
        const trail = trailRef.current;
        trail.push({ x: baseX, y, a: 1 });
        if (trail.length > 18) trail.shift();
        for (const point of trail) {
          point.a -= 0.055;
          if (point.a <= 0) continue;
          context.fillStyle = accentAlpha(point.a * 0.3);
          context.beginPath();
          context.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
          context.fill();
        }
      }

      // The apex marker: a lit rung the bone should cross when you cut.
      if (current === "arcing") {
        const apexY = ground - rise * (0.55 + powerHeight * 0.45);
        context.strokeStyle = accentAlpha(0.3);
        context.setLineDash([4, 5]);
        context.beginPath();
        context.moveTo(0, apexY);
        context.lineTo(width, apexY);
        context.stroke();
        context.setLineDash([]);
      }

      if (current === "ready" || current === "winding" || current === "paused") {
        // Grounded, waiting: the bone sits in the dirt with the wind-up tilt.
        drawBone(width * 0.3, ground - 8, -0.35 - powerValueRef.current * 0.5, 0, 1);
      } else if (current === "missed") {
        drawBone(baseX, ground - 6, 1.4, 0, 1);
      } else {
        // Orbital drift once the match completes.
        const orbitT = orbital ? Math.min(1, (now - morphStartRef.current) / MORPH_MS) : 0;
        const settleX = baseX + (width * 0.5 - baseX) * orbitT;
        const settleY = orbital ? y + (height * 0.5 - height * 0.3 - y) * orbitT : y;
        const settleAngle = orbital ? angle * (1 - orbitT) : angle;
        const orbiting =
          orbital && orbitT >= 1
            ? {
                x: width / 2 + Math.cos((now - morphStartRef.current) / 1400) * width * 0.34,
                y: height / 2 + Math.sin((now - morphStartRef.current) / 1400) * height * 0.3,
              }
            : null;
        drawBone(
          orbiting ? orbiting.x : settleX,
          orbiting ? orbiting.y : settleY,
          orbiting ? 0 : settleAngle,
          morph,
          1 + morph * 0.15
        );
      }

      // Cut flash: the frame itself blows out for a beat, as a cut does.
      if (!reducedRef.current && now < flashUntilRef.current) {
        context.save();
        context.globalAlpha = ((flashUntilRef.current - now) / 260) * 0.8;
        context.fillStyle = palette.bright;
        context.fillRect(0, 0, width, height);
        context.restore();
      }

      context.restore();
    };

    const updateMeters = (now: number) => {
      const current = phaseRef.current;
      if (current === "winding") {
        // Ping-pong sweep: release picks the power, so it is a real choice.
        const cycle = ((now - windUpStartRef.current) % (POWER_SWEEP_MS * 2)) / POWER_SWEEP_MS;
        const tri = cycle <= 1 ? cycle : 2 - cycle;
        powerValueRef.current = POWER_MIN + tri * (1 - POWER_MIN);
        if (powerRef.current) {
          powerRef.current.style.width = `${(powerValueRef.current * 100).toFixed(1)}%`;
        }
      }
      if (needleRef.current) {
        const t = current === "arcing" ? tRef.current : 0;
        needleRef.current.style.left = `${(t * 100).toFixed(2)}%`;
      }
    };

    if (reducedMotion) {
      // Still animated, but only while something is genuinely in motion; the
      // resting states paint a single frame and stop.
      let frame = 0;
      const tick = () => {
        const now = performance.now();
        updateMeters(now);
        draw(now);
        const live = phaseRef.current === "winding" || phaseRef.current === "arcing";
        if (live) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      window.addEventListener("resize", size);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", size);
      };
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) {
        const now = performance.now();
        updateMeters(now);
        draw(now);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, [reducedMotion, phase]);

  // The bone landing is a state change, so it lives outside the paint loop.
  useEffect(() => {
    if (phase !== "arcing") return;
    let frame = 0;
    const watch = () => {
      if (phaseRef.current !== "arcing") return;
      if (tRef.current >= 1) {
        land("fell");
        return;
      }
      frame = window.requestAnimationFrame(watch);
    };
    frame = window.requestAnimationFrame(watch);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, land]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (event.repeat) return;
      if (phaseRef.current === "ready") beginWind();
      else if (phaseRef.current === "arcing") cut();
    },
    [beginWind, cut]
  );
  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (phaseRef.current === "winding") release();
    },
    [release]
  );

  const liveWindow = windowFor(powerValueRef.current, index);
  const bandLeft = Math.max(0, (apex - liveWindow) * 100);
  const bandWidth = Math.min(100 - bandLeft, liveWindow * 200);

  const status = useMemo(() => {
    if (phase === "done")
      return `Five throws, ${score} points banked. Best single cut ${best}% aligned.`;
    if (phase === "paused") return "Held. The bone waits in the dirt.";
    if (phase === "matched")
      return `${GRADE_WORD[grade]} — ${accuracy}% aligned. Four million years pass in one frame.`;
    if (phase === "missed") return "No match. The bone came down and stayed down.";
    if (phase === "arcing") return "Cut at the apex — watch the dashed rung, not the clock.";
    if (phase === "winding") return "Release to throw. Higher power carries further and reads harder.";
    return index === 0
      ? "Hold to wind up, release to throw, then press again at the top of the arc."
      : `Throw ${index + 1} of ${THROWS.length}. The wind has shifted — the apex moves with it.`;
  }, [phase, score, best, grade, accuracy, index]);

  const windWord =
    spec.wind === 0 ? "still" : spec.wind > 0 ? `${"▶".repeat(spec.wind > 0.4 ? 2 : 1)} late` : `${"◀".repeat(spec.wind < -0.4 ? 2 : 1)} early`;

  return (
    <div
      data-sim-state={phase}
      data-bone-throw={index + 1}
      data-bone-score={score}
      data-bone-streak={streak}
      data-accuracy={accuracy}
      className="flex flex-col gap-3"
      // Capture runs before any child handler, so every press is timestamped
      // even when the play surface stops propagation.
      onPointerDownCapture={markPress}
    >
      <OdysseyKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          throw <span className="text-accent">{Math.min(index + 1, THROWS.length)}</span>/
          {THROWS.length}
        </span>
        {/* Fixed-width numeric slots so a growing score never rewraps the HUD
            and shifts the play field under an in-flight throw. */}
        <span>
          score{" "}
          <span
            key={score}
            className={`inline-block min-w-[3.5em] text-accent tabular-nums ${
              reducedMotion ? "" : "so-pop"
            }`}
          >
            {score}
          </span>
        </span>
        <span>
          streak{" "}
          <span className="inline-block min-w-[1.5em] text-accent tabular-nums">{streak}</span>
          <span className="inline-block min-w-[1.8em] text-accent-bright">
            {streak >= 3 ? `×${streakMultiplier(streak)}` : ""}
          </span>
        </span>
        <span>
          wind <span className="text-accent">{windWord}</span>
        </span>
        <span className="ml-auto flex gap-2">
          <OdysseyMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "ready" || phase === "winding" || phase === "paused") && (
            <button type="button" onClick={togglePause} className={ODYSSEY_BUTTON}>
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* Play field */}
      <div
        className="relative h-52 overflow-hidden border border-accent/25 bg-ink/60 sm:h-72"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          event.preventDefault();
          if (phaseRef.current === "ready") beginWind();
          else if (phaseRef.current === "arcing") cut();
        }}
        onPointerUp={release}
        onPointerLeave={release}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "so-float"
            }`}
          >
            {note.text}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {/* Flight rail: the window band sits where the apex actually is. */}
      <div className="relative h-3 w-full border border-accent/25 bg-white/5" aria-hidden>
        <div
          className="absolute inset-y-0 border-x border-accent/60 bg-accent/20"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        <div
          ref={needleRef}
          className="absolute inset-y-0 w-0.5 bg-accent-bright"
          style={{ left: "0%" }}
        />
      </div>

      {/* Wind-up meter */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">power</span>
        <div className="h-2 flex-1 overflow-hidden border border-accent/25 bg-white/5">
          <div ref={powerRef} className="h-full bg-accent/70" style={{ width: "35%" }} />
        </div>
      </div>

      {/* Controls on their own row, above a status line whose length changes
          every throw — otherwise the cut target slides mid-flight. */}
      <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.12em]">
        <span className="flex gap-2">
          {phase === "ready" || phase === "winding" || phase === "arcing" ? (
            <button
              ref={actionRef}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (phaseRef.current === "ready") beginWind();
                else if (phaseRef.current === "arcing") cut();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                release();
              }}
              onPointerLeave={release}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              // Fixed width: the label changes with the phase, and a button
              // that shrinks under a held pointer drops the very next press.
              className={`${ODYSSEY_BUTTON} min-w-[11rem] text-center active:scale-95`}
              style={{ touchAction: "none" }}
            >
              {phase === "arcing" ? "Cut" : phase === "winding" ? "Release…" : "Hold to wind up"}
            </button>
          ) : phase === "done" ? (
            <button
              ref={actionRef}
              type="button"
              // detail 0 marks a keyboard-synthesized click, which has no
              // pointer press to date-stamp and is always deliberate.
              onClick={(event) => {
                if (event.detail === 0 || freshPress()) restart();
              }}
              className={ODYSSEY_BUTTON}
            >
              Throw the five again
            </button>
          ) : phase === "paused" ? null : (
            <button
              ref={actionRef}
              type="button"
              onClick={(event) => {
                if (event.detail === 0 || freshPress()) nextThrow();
              }}
              className={ODYSSEY_BUTTON}
            >
              {phase === "missed" ? "Pick it up again" : "Next throw"}
            </button>
          )}
        </span>
        <p
          role="status"
          className="min-h-[2.4em] text-[11px] normal-case tracking-normal text-white/70"
        >
          {status}
        </p>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function SpaceOdysseyBoneToss({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="space-odyssey-bone-title"
      gameId="space-odyssey-bone"
      eyebrow="Match cut"
      title="The bone toss"
      startLabel="Throw the bone"
      stage
      reference={{
        scene:
          "2001: A Space Odyssey (1968) · bone up, satellite down — the most famous cut in cinema",
      }}
      howToPlay={{
        objective: "Cut at the top of the bone's arc, five throws in a row.",
        controls: [
          { keys: "hold Space", does: "wind up — the power meter sweeps while it is held" },
          { keys: "release", does: "throw; more power carries further and reads harder" },
          { keys: "Space", does: "cut the frame as the bone crosses the apex" },
          { keys: "click", does: "the same three beats, pressed and held on the play field" },
        ],
        tip: "The dashed rung marks the apex, and wind shifts it off the middle of the flight. Three clean cuts in a row doubles the score, five triples it.",
      }}
      onClose={onClose}
    >
      <Toss />
    </SimulationShell>
  );
}
