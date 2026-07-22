"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  TenenbaumChip,
  TenenbaumKeyframes,
  TenenbaumMuteButton,
  useTenenbaumAudio,
} from "@/components/film-experience/simulations/RoyalTenenbaumsShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useFreshPress } from "@/lib/useFreshPress";
import { useReducedMotion } from "@/lib/useReducedMotion";

// A full falconry loop on the townhouse roof: loose the hawk, read the wind as
// it deforms his circle, and call at the moment his arc crosses the glove.
// Five flights, each adding something — wind that makes the orbit uneven, a
// pigeon he would rather look at, and a lure you can swing to pull him tighter
// for a moment at a cost. Three calls per flight; a catch ends it.

const SCORE_ID = "royal-tenenbaums-mordecai";
/** Straight down: the glove is the near edge of the ring. */
const GLOVE_ANGLE = Math.PI / 2;
const CALLS_PER_FLIGHT = 3;
const LURE_MS = 1400;
const LURE_COST = 60;
const LURE_WIDEN = 1.9;
const MAX_FEATHERS = 70;
const TRAIL_LENGTH = 26;

type Flight = Readonly<{
  name: string;
  /** Base angular speed, radians per second. */
  speed: number;
  /** Half-width of the catch arc, radians. */
  window: number;
  /** How unevenly the wind pushes the circle, 0–1. */
  wind: number;
  /** Direction the wind blows from, radians. */
  windFrom: number;
  /** A pigeon he would rather watch. */
  pigeon: boolean;
  /** Lure swings available this flight. */
  lures: number;
}>;

const FLIGHTS: readonly Flight[] = [
  { name: "The first cast", speed: 1.5, window: 0.5, wind: 0, windFrom: 0, pigeon: false, lures: 0 },
  { name: "A rising wind", speed: 1.75, window: 0.4, wind: 0.34, windFrom: 0.4, pigeon: false, lures: 0 },
  { name: "Pigeons on the ledge", speed: 2.0, window: 0.32, wind: 0.4, windFrom: 2.1, pigeon: true, lures: 1 },
  { name: "The lure aloft", speed: 2.3, window: 0.25, wind: 0.5, windFrom: 4.0, pigeon: true, lures: 2 },
  { name: "Dusk over the roof", speed: 2.65, window: 0.19, wind: 0.6, windFrom: 5.2, pigeon: true, lures: 2 },
];

// Reduced motion keeps the flight — the timing IS the game — but halves the
// speed, more than doubles the window, and drops trails, feathers and shake.
const REDUCED_SPEED = 0.45;
const REDUCED_WINDOW = 2.2;

type Phase = "ready" | "flying" | "caught" | "lost" | "paused" | "done";
type Grade = "perfect" | "clean" | "late";

type Feather = { x: number; y: number; vx: number; vy: number; life: number; spin: number; angle: number };

/** Smallest signed distance between two angles, in [-PI, PI]. */
function angleGap(a: number, b: number) {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function HawkReturn() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [flightIndex, setFlightIndex] = useState(0);
  const [callsLeft, setCallsLeft] = useState(CALLS_PER_FLIGHT);
  const [luresLeft, setLuresLeft] = useState(FLIGHTS[0].lures);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [tell, setTell] = useState<string | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [shakeTick, setShakeTick] = useState(0);

  const reducedMotion = useReducedMotion();
  const audio = useTenenbaumAudio();
  const flight = FLIGHTS[flightIndex];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Live values the paint loop reads without forcing a React render.
  const phaseRef = useRef<Phase>("ready");
  const flightRef = useRef(0);
  const angleRef = useRef(GLOVE_ANGLE + Math.PI);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const feathersRef = useRef<Feather[]>([]);
  const lureUntilRef = useRef(0);
  const pigeonRef = useRef(0);
  const catchAtRef = useRef(-1);
  const missAtRef = useRef(-1);
  const looseAtRef = useRef(-1);
  const lastRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const floatRef = useRef<{ text: string; at: number } | null>(null);
  const reducedRef = useRef(false);
  const drawRef = useRef<(now: number) => void>(() => {});

  // Gesture-identity guard: when a phase resolves and swaps the action button
  // in place, the trailing click of the causing gesture can land on the new
  // button. A genuine tap presses AFTER the phase changed.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    flightRef.current = flightIndex;
  }, [flightIndex]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  /** The live catch window: flight width, widened by reduced motion or a lure. */
  const windowNow = useCallback((now: number) => {
    const base = FLIGHTS[flightRef.current].window * (reducedRef.current ? REDUCED_WINDOW : 1);
    return lureUntilRef.current > now ? base * LURE_WIDEN : base;
  }, []);

  const spawnFeathers = useCallback((x: number, y: number, count: number) => {
    if (reducedRef.current) return;
    const feathers = feathersRef.current;
    for (let i = 0; i < count; i += 1) {
      if (feathers.length >= MAX_FEATHERS) break;
      const a = Math.random() * Math.PI * 2;
      feathers.push({
        x,
        y,
        vx: Math.cos(a) * (0.6 + Math.random() * 2.2),
        vy: Math.sin(a) * (0.6 + Math.random() * 1.6) - 0.8,
        life: 1,
        spin: (Math.random() - 0.5) * 0.22,
        angle: Math.random() * Math.PI,
      });
    }
  }, []);

  const focusPrimary = useCallback(() => {
    window.requestAnimationFrame(() => primaryRef.current?.focus());
  }, []);

  const loose = useCallback(
    (index: number, resetRun: boolean) => {
      audio.unlock();
      audio.loose();
      if (resetRun) {
        scoreRef.current = 0;
        setScore(0);
        streakRef.current = 0;
        setStreak(0);
      }
      flightRef.current = index;
      setFlightIndex(index);
      setCallsLeft(CALLS_PER_FLIGHT);
      setLuresLeft(FLIGHTS[index].lures);
      setTell(null);
      setGrade(null);
      angleRef.current = GLOVE_ANGLE + Math.PI;
      trailRef.current = [];
      lureUntilRef.current = 0;
      catchAtRef.current = -1;
      missAtRef.current = -1;
      looseAtRef.current = performance.now();
      lastRef.current = performance.now();
      phaseRef.current = "flying";
      setPhase("flying");
      window.requestAnimationFrame(() => callRef.current?.focus());
    },
    [audio]
  );

  const call = useCallback(() => {
    if (phaseRef.current !== "flying") return;
    audio.unlock();
    const now = performance.now();
    const canvas = canvasRef.current;
    const width = canvas?.offsetWidth ?? 320;
    const height = canvas?.offsetHeight ?? 220;
    const radius = Math.min(width, height) * 0.34;
    const gx = width / 2 + Math.cos(GLOVE_ANGLE) * radius;
    const gy = height / 2 + Math.sin(GLOVE_ANGLE) * radius;

    // The pigeon steals his attention: a call made while he is level with the
    // ledge is simply not heard.
    const current = FLIGHTS[flightRef.current];
    if (
      current.pigeon &&
      Math.abs(angleGap(angleRef.current, pigeonRef.current)) < 0.3 &&
      lureUntilRef.current <= now
    ) {
      missAtRef.current = now;
      setShakeTick((tick) => tick + 1);
      audio.wrong();
      setTell("He is watching the pigeons on the ledge and does not hear you. Swing the lure, or wait him past it.");
      const left = callsLeft - 1;
      setCallsLeft(left);
      if (left <= 0) {
        streakRef.current = 0;
        setStreak(0);
        audio.fail();
        phaseRef.current = "lost";
        setPhase("lost");
        focusPrimary();
      }
      return;
    }

    const span = windowNow(now);
    const gap = Math.abs(angleGap(angleRef.current, GLOVE_ANGLE));
    if (gap > span) {
      missAtRef.current = now;
      setShakeTick((tick) => tick + 1);
      audio.wrong();
      const early = angleGap(angleRef.current, GLOVE_ANGLE) < 0;
      setTell(early ? "Too soon — he wheels in short of the glove." : "Too late — he is already past and climbing.");
      const left = callsLeft - 1;
      setCallsLeft(left);
      if (left <= 0) {
        streakRef.current = 0;
        setStreak(0);
        audio.fail();
        phaseRef.current = "lost";
        setPhase("lost");
        focusPrimary();
      }
      return;
    }

    // A catch. Precision inside the window sets the tier; the streak multiplies.
    const precision = 1 - gap / span;
    const tier: Grade = precision > 0.82 ? "perfect" : precision > 0.45 ? "clean" : "late";
    const base = tier === "perfect" ? 250 : tier === "clean" ? 160 : 100;
    const nextStreak = streakRef.current + 1;
    streakRef.current = nextStreak;
    setStreak(nextStreak);
    setBest((current2) => Math.max(current2, nextStreak));
    const multiplier = 1 + Math.min(5, nextStreak - 1) * 0.25;
    const lureTax = (FLIGHTS[flightRef.current].lures - luresLeft) * LURE_COST;
    const gained = Math.max(20, Math.round(base * multiplier) - lureTax);
    scoreRef.current += gained;
    setScore(scoreRef.current);
    recordSimulationScore(SCORE_ID, scoreRef.current);

    catchAtRef.current = now;
    floatRef.current = { text: `${tier} +${gained}`, at: now };
    spawnFeathers(gx, gy, tier === "perfect" ? 26 : 16);
    audio.land(nextStreak);
    setGrade(tier);
    setTell(
      tier === "perfect"
        ? "Straight to the fist. He does not even open his wings to brake."
        : tier === "clean"
          ? "A clean landing — one beat of the wings and he is down."
          : "He comes in wide and settles late, but he settles."
    );

    const last = flightRef.current + 1 >= FLIGHTS.length;
    if (last) {
      audio.win();
      phaseRef.current = "done";
      setPhase("done");
    } else {
      phaseRef.current = "caught";
      setPhase("caught");
    }
    focusPrimary();
  }, [audio, callsLeft, focusPrimary, luresLeft, spawnFeathers, windowNow]);

  const swingLure = useCallback(() => {
    if (phaseRef.current !== "flying" || luresLeft <= 0) return;
    audio.unlock();
    audio.lure();
    lureUntilRef.current = performance.now() + LURE_MS;
    setLuresLeft((left) => left - 1);
    setTell(`Lure up — the window opens wide for a moment. −${LURE_COST} from this catch.`);
  }, [audio, luresLeft]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "flying") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "flying";
      setPhase("flying");
      window.requestAnimationFrame(() => callRef.current?.focus());
    }
  }, []);

  const backToRoof = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    streakRef.current = 0;
    setStreak(0);
    setFlightIndex(0);
    flightRef.current = 0;
    setCallsLeft(CALLS_PER_FLIGHT);
    setLuresLeft(FLIGHTS[0].lures);
    setTell(null);
    setGrade(null);
    angleRef.current = GLOVE_ANGLE + Math.PI;
    trailRef.current = [];
    feathersRef.current = [];
    catchAtRef.current = -1;
    missAtRef.current = -1;
    phaseRef.current = "ready";
    setPhase("ready");
    focusPrimary();
  }, [focusPrimary]);

  // The rooftop: ring, glove, wind, pigeon, hawk, trail, feathers. One rAF
  // loop; reduced motion runs the same loop at a crawl with the extras off.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      // One palette read per frame; every stroke below reuses it.
      const palette = getLiveThemePalette();
      const reduced = reducedRef.current;
      const current = FLIGHTS[flightRef.current];

      context.save();
      // Impact shake: a short camera kick on a catch or a refusal.
      if (!reduced) {
        const kickFrom = Math.max(catchAtRef.current, missAtRef.current);
        if (kickFrom > 0) {
          const t = (now - kickFrom) / 260;
          if (t < 1) {
            const amp = (1 - t) * (catchAtRef.current > missAtRef.current ? 4 : 6);
            context.translate(Math.sin(now / 18) * amp, Math.cos(now / 21) * amp * 0.6);
          }
        }
      }

      context.fillStyle = palette.inkSoft;
      context.fillRect(-12, -12, width + 24, height + 24);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.34;

      // The roofline: a flat parapet under the ring, dead-centre like everything
      // else in this house.
      context.strokeStyle = accentAlpha(0.18);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height - 14);
      context.lineTo(width, height - 14);
      context.stroke();
      for (let x = 6; x < width; x += 18) {
        context.strokeRect(x, height - 22, 8, 8);
      }

      // Wind: drifting streaks, plus the ring's own deformation below.
      if (!reduced && current.wind > 0) {
        context.strokeStyle = accentAlpha(0.08 + current.wind * 0.06);
        context.beginPath();
        for (let i = 0; i < 7; i += 1) {
          const y = ((i * 37 + now / (18 - current.wind * 8)) % (height + 40)) - 20;
          const dx = Math.cos(current.windFrom) * 26;
          context.moveTo(-10, y);
          context.lineTo(width + 10, y + dx * 0.35);
        }
        context.stroke();
      }

      // The orbit ring and its compass ticks.
      context.strokeStyle = accentAlpha(0.2);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = accentAlpha(0.14);
      context.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        context.moveTo(cx + Math.cos(a) * (radius - 4), cy + Math.sin(a) * (radius - 4));
        context.lineTo(cx + Math.cos(a) * (radius + 4), cy + Math.sin(a) * (radius + 4));
      }
      context.stroke();

      // The catch window, centred on the glove. It breathes brighter while the
      // hawk is inside it — a second, non-colour cue backs the status line.
      const span = windowNow(now);
      const inside = Math.abs(angleGap(angleRef.current, GLOVE_ANGLE)) <= span;
      if (span < Math.PI) {
        const lit = inside && phaseRef.current === "flying";
        context.strokeStyle = accentAlpha(lit ? 0.55 + (reduced ? 0.2 : 0.25 * Math.abs(Math.sin(now / 130))) : 0.3);
        context.lineWidth = lit ? 5 : 3;
        context.beginPath();
        context.arc(cx, cy, radius, GLOVE_ANGLE - span, GLOVE_ANGLE + span);
        context.stroke();
      }

      // The glove: a small cuffed wedge at the bottom of the ring.
      const gx = cx + Math.cos(GLOVE_ANGLE) * radius;
      const gy = cy + Math.sin(GLOVE_ANGLE) * radius;
      context.fillStyle = accentAlpha(0.8);
      context.beginPath();
      context.moveTo(gx - 8, gy + 8);
      context.lineTo(gx + 8, gy + 8);
      context.lineTo(gx + 5, gy - 4);
      context.lineTo(gx - 5, gy - 4);
      context.closePath();
      context.fill();
      context.strokeStyle = accentAlpha(0.5);
      context.beginPath();
      context.moveTo(gx - 9, gy + 10);
      context.lineTo(gx + 9, gy + 10);
      context.stroke();

      // The lure on its tether, swung up beside the glove.
      if (lureUntilRef.current > now) {
        const t = 1 - (lureUntilRef.current - now) / LURE_MS;
        const la = -Math.PI / 2 + Math.sin(t * 9) * 0.9;
        const lx = gx + Math.cos(la) * 26;
        const ly = gy + Math.sin(la) * 26;
        context.strokeStyle = accentAlpha(0.5);
        context.beginPath();
        context.moveTo(gx, gy);
        context.lineTo(lx, ly);
        context.stroke();
        context.fillStyle = palette.bright;
        context.beginPath();
        context.arc(lx, ly, 3.5, 0, Math.PI * 2);
        context.fill();
      }

      // The pigeon on the ledge: something better to look at.
      if (current.pigeon) {
        const px = cx + Math.cos(pigeonRef.current) * (radius + 16);
        const py = cy + Math.sin(pigeonRef.current) * (radius + 16);
        context.fillStyle = accentAlpha(0.42);
        context.beginPath();
        context.ellipse(px, py, 4.5, 3, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = accentAlpha(0.3);
        context.beginPath();
        context.arc(px, py, 9 + (reduced ? 0 : Math.abs(Math.sin(now / 420)) * 3), 0, Math.PI * 2);
        context.stroke();
      }

      // The trail: where he has just been, fading out behind him.
      const trail = trailRef.current;
      if (!reduced && trail.length > 1) {
        context.strokeStyle = accentAlpha(0.22);
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i += 1) context.lineTo(trail[i].x, trail[i].y);
        context.stroke();
      }

      // The hawk. Perched on the glove once caught, otherwise on the ring with
      // wings beating in time with his speed.
      const perched = phaseRef.current === "caught" || phaseRef.current === "done";
      const settle = perched
        ? reduced
          ? 1
          : Math.min(1, Math.max(0, (now - catchAtRef.current) / 320))
        : 0;
      const ringX = cx + Math.cos(angleRef.current) * radius;
      const ringY = cy + Math.sin(angleRef.current) * radius;
      const hx = perched ? ringX + (gx - ringX) * settle : ringX;
      const hy = perched ? ringY + (gy - 10 - ringY) * settle : ringY;
      const beat = reduced || perched ? 0.45 : 0.35 + 0.55 * Math.abs(Math.sin(now / 90));
      context.fillStyle = palette.bright;
      context.beginPath();
      context.ellipse(hx, hy, 4.5, 3, angleRef.current + Math.PI / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = accentAlpha(0.85);
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(hx, hy);
      context.lineTo(hx - 11, hy - 11 * beat);
      context.moveTo(hx, hy);
      context.lineTo(hx + 11, hy - 11 * beat);
      context.stroke();

      // Catch impact: a ring blooming off the glove.
      if (!reduced && catchAtRef.current > 0) {
        const t = Math.max(0, (now - catchAtRef.current) / 620);
        if (t < 1) {
          context.strokeStyle = accentAlpha(0.6 * (1 - t));
          context.lineWidth = 3 * (1 - t) + 1;
          context.beginPath();
          context.arc(gx, gy, 6 + t * radius * 1.1, 0, Math.PI * 2);
          context.stroke();
        }
      }

      // Feathers.
      if (!reduced) {
        const feathers = feathersRef.current;
        for (let i = feathers.length - 1; i >= 0; i -= 1) {
          const f = feathers[i];
          f.x += f.vx;
          f.y += f.vy;
          f.vy += 0.045;
          f.vx *= 0.985;
          f.angle += f.spin;
          f.life -= 0.014;
          if (f.life <= 0) {
            feathers.splice(i, 1);
            continue;
          }
          context.save();
          context.translate(f.x, f.y);
          context.rotate(f.angle);
          context.fillStyle = accentAlpha(f.life * 0.7);
          context.beginPath();
          context.ellipse(0, 0, 3.4, 1.1, 0, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
      }

      // The floating tally over the glove.
      const float = floatRef.current;
      if (float && !reduced) {
        const t = (now - float.at) / 1000;
        if (t < 1) {
          context.fillStyle = accentAlpha(1 - t);
          context.font = "10px monospace";
          context.textAlign = "center";
          context.fillText(float.text.toUpperCase(), gx, gy - 22 - t * 18);
          context.textAlign = "left";
        }
      }

      context.restore();
    };
    drawRef.current = draw;

    lastRef.current = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = Math.min(0.05, (now - lastRef.current) / 1000);
        lastRef.current = now;
        if (phaseRef.current === "flying") {
          const current = FLIGHTS[flightRef.current];
          // Wind deforms the circle: he runs downwind and labours back upwind,
          // so the crossing is never on a metronome.
          const gust = 1 + current.wind * Math.sin(angleRef.current - current.windFrom);
          const lured = lureUntilRef.current > now ? 0.68 : 1;
          const speed =
            current.speed * gust * lured * (reducedRef.current ? REDUCED_SPEED : 1);
          angleRef.current = (angleRef.current + speed * dt) % (Math.PI * 2);
          if (current.pigeon) {
            pigeonRef.current = (pigeonRef.current + 0.45 * dt) % (Math.PI * 2);
          }
          if (!reducedRef.current) {
            const canvasEl = canvasRef.current;
            if (canvasEl) {
              const r = Math.min(canvasEl.offsetWidth, canvasEl.offsetHeight) * 0.34;
              const trail = trailRef.current;
              trail.push({
                x: canvasEl.offsetWidth / 2 + Math.cos(angleRef.current) * r,
                y: canvasEl.offsetHeight / 2 + Math.sin(angleRef.current) * r,
              });
              if (trail.length > TRAIL_LENGTH) trail.shift();
            }
          }
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [windowNow]);

  // L swings the lure while a flight is up; the button stays the real control.
  useEffect(() => {
    if (phase !== "flying") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        swingLure();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, swingLure]);

  const status = useMemo(() => {
    if (phase === "done") return `Every flight flown — ${score} points, best streak ${best}.`;
    if (phase === "caught") return tell ?? "He is down on the fist.";
    if (phase === "lost") return `${tell ?? "He will not come."} Streak lost — back to the first cast.`;
    if (phase === "paused") return "Held. He keeps circling in your head.";
    if (phase === "flying") {
      return tell ?? `Flight ${flightIndex + 1}: ${flight.name}. Watch the arc and call as it crosses the glove.`;
    }
    return flightIndex === 0
      ? "Loose him from the roof, then call him back the moment his circle crosses the glove. Three calls a flight."
      : `Ready for flight ${flightIndex + 1}: ${flight.name}.`;
  }, [best, flight.name, flightIndex, phase, score, tell]);

  const anim = (className: string) => (reducedMotion ? "" : className);

  return (
    <div
      data-sim-state={phase}
      data-flight={flightIndex + 1}
      data-mordecai-score={score}
      data-streak={streak}
      data-calls-left={callsLeft}
      className="flex flex-col gap-3"
      onPointerDownCapture={markPress}
    >
      <TenenbaumKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
        <span>
          flight <span className="text-accent">{flightIndex + 1}</span>/{FLIGHTS.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={`text-accent ${anim("tnb-pop")}`}>
            {score}
          </span>
        </span>
        <span>
          streak <span className="text-accent">x{streak}</span>
        </span>
        <span aria-label={`${callsLeft} calls left`}>
          calls{" "}
          <span className="text-accent">
            {"▮".repeat(callsLeft)}
            {"▯".repeat(CALLS_PER_FLIGHT - callsLeft)}
          </span>
        </span>
        <span aria-label={flight.wind > 0 ? `Wind strength ${Math.round(flight.wind * 10)} of 10` : "No wind"}>
          wind{" "}
          <span className="text-accent">
            {flight.wind > 0 ? "≈".repeat(Math.max(1, Math.round(flight.wind * 5))) : "—"}
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <TenenbaumMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "flying" || phase === "paused") && (
            <TenenbaumChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </TenenbaumChip>
          )}
        </span>
      </div>

      {/* The roof. Tapping it calls him, so touch play never needs the button. */}
      <div className="relative" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          onPointerDown={() => {
            if (phaseRef.current === "flying") call();
          }}
          className={`h-52 w-full border border-accent/25 bg-ink/60 sm:h-64 ${
            grade === "perfect" && phase !== "flying" ? "border-accent" : ""
          }`}
        />
        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
        {grade && (phase === "caught" || phase === "done") && (
          <p
            key={`${grade}-${score}`}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-xs uppercase tracking-[0.3em] text-accent ${anim(
              "tnb-stamp"
            )}`}
          >
            {grade}
          </p>
        )}
      </div>

      <p
        key={`tell-${shakeTick}`}
        role="status"
        className={`text-[11px] normal-case leading-relaxed text-white/70 ${
          phase === "lost" ? anim("tnb-shake") : ""
        }`}
      >
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {phase === "flying" && (
          <>
            <TenenbaumChip innerRef={callRef} onClick={call} bright>
              Call him back
            </TenenbaumChip>
            <TenenbaumChip onClick={swingLure} disabled={luresLeft <= 0}>
              Swing the lure ({luresLeft}) · L
            </TenenbaumChip>
          </>
        )}
        {phase === "ready" && (
          <TenenbaumChip innerRef={primaryRef} onClick={() => loose(flightIndex, flightIndex === 0)} bright>
            Loose the hawk
          </TenenbaumChip>
        )}
        {phase === "caught" && (
          <TenenbaumChip
            innerRef={primaryRef}
            onClick={() => {
              if (freshPress()) loose(flightIndex + 1, false);
            }}
            bright
          >
            Fly {FLIGHTS[Math.min(flightIndex + 1, FLIGHTS.length - 1)].name}
          </TenenbaumChip>
        )}
        {phase === "lost" && (
          <TenenbaumChip
            innerRef={primaryRef}
            onClick={() => {
              if (freshPress()) loose(flightIndex, false);
            }}
            bright
          >
            Cast him again
          </TenenbaumChip>
        )}
        {phase === "done" && (
          <TenenbaumChip
            innerRef={primaryRef}
            onClick={() => {
              if (freshPress()) backToRoof();
            }}
            bright
          >
            Back to the rooftop
          </TenenbaumChip>
        )}
        {phase !== "ready" && phase !== "done" && (
          <TenenbaumChip onClick={backToRoof}>Start over</TenenbaumChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function RoyalTenenbaumsMordecai({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="royal-tenenbaums-mordecai-title"
      gameId="royal-tenenbaums-mordecai"
      eyebrow="Rooftop trial"
      title="Mordecai's return"
      startLabel="Loose the hawk"
      stage
      howToPlay={{
        objective:
          "Call the hawk back at the moment his circle crosses the glove, once on each of five flights.",
        controls: [
          { keys: "click", does: "tap the roof to call him — the call button does the same" },
          { keys: "L", does: `swing the lure: the catch window opens wide, −${LURE_COST} from the catch` },
          { keys: "pause", does: "hold the flight where it is and pick it up again" },
        ],
        tip: "Three calls a flight, and the closer to dead centre the better the tier. From flight three a pigeon on the ledge takes his attention — a call made while he is level with it is not heard at all.",
      }}
      reference={{
        quote: "Mordecai!",
        scene: "The Royal Tenenbaums (2001) · the hawk loosed from the rooftop",
      }}
      onClose={onClose}
    >
      <HawkReturn />
    </SimulationShell>
  );
}
