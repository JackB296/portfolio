"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  CasablancaKeyframes,
  CasablancaMuteButton,
  useCasablancaAudio,
} from "@/components/film-experience/simulations/CasablancaShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Rick's rigged wheel, played for a streak. The wheel spins under a fixed
// pointer; drop the ball and the wheel decelerates with friction, so the pocket
// you see at the pointer is never the pocket you get — learn the lead. Each win
// doubles the pot and speeds the next spin; let it ride or walk to the cashier.
const WHEEL = [7, 28, 12, 35, 3, 26, 0, 32, 15, 22, 34, 5, 17, 20, 1, 33, 16, 24, 9, 31] as const;
const TARGET = 22;
const TARGET_INDEX = WHEEL.indexOf(TARGET);
const SLOTS = WHEEL.length;
const SLOT_ANGLE = (Math.PI * 2) / SLOTS;
const TAU = Math.PI * 2;
const BASE_SPEED = 0.045; // radians per 16.67ms frame
const SPEED_STEP = 0.009;
const MAX_SPEED = 0.09;
const REDUCED_SPEED = 0.006;
const FRICTION = 0.94; // per 16.67ms while settling
const STOP_SPEED = 0.0025;
const START_POT = 100;
const SCORE_ID = "casablanca-roulette";

type Phase = "spinning" | "settling" | "won" | "missed" | "cashed";

const CROUPIER_IDLE = [
  "Place it on twenty-two, monsieur.",
  "The house is watching. So is Rick.",
  "The wheel favors the brave tonight.",
  "Twenty-two again? As you wish.",
] as const;

function RiggedWheel() {
  const [phase, setPhase] = useState<Phase>("spinning");
  const [landed, setLanded] = useState<number | null>(null);
  const [nearMiss, setNearMiss] = useState(0);
  const [wasNear, setWasNear] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [pot, setPot] = useState(START_POT);
  const [round, setRound] = useState(0);
  const reducedMotion = useReducedMotion();
  const audio = useCasablancaAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  // Wheel physics live in refs so the rAF loop never re-renders React.
  const angleRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const phaseRef = useRef<Phase>("spinning");
  const dropAtRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  /** The pocket currently aligned with the fixed pointer at the top. */
  const slotUnderPointer = useCallback(() => {
    const normalized = ((-angleRef.current % TAU) + TAU) % TAU;
    return Math.round(normalized / SLOT_ANGLE) % SLOTS;
  }, []);

  const resolve = useCallback(
    (slot: number) => {
      const value = WHEEL[slot];
      setLanded(value);
      const distance = Math.min(
        Math.abs(slot - TARGET_INDEX),
        SLOTS - Math.abs(slot - TARGET_INDEX)
      );
      if (value === TARGET) {
        phaseRef.current = "won";
        setPhase("won");
        setPot((p) => p * 2);
        audio.play({ freq: 523.25, duration: 0.22, gain: 0.09 });
        audio.play({ freq: 659.25, duration: 0.22, gain: 0.09, delay: 0.1 });
        audio.play({ freq: 783.99, duration: 0.4, gain: 0.09, delay: 0.2 });
        setStreak((count) => {
          const next = count + 1;
          recordSimulationScore(SCORE_ID, next);
          setBest((b) => Math.max(b, next));
          return next;
        });
      } else {
        phaseRef.current = "missed";
        setPhase("missed");
        setStreak(0);
        audio.play({ freq: 110, type: "square", duration: 0.3, gain: 0.07 });
        setWasNear(distance === 1);
        if (distance === 1) setNearMiss((n) => n + 1);
      }
    },
    [audio]
  );

  const arm = useCallback(
    (streakNow: number) => {
      angleRef.current = Math.random() * TAU;
      speedRef.current = reducedRef.current
        ? REDUCED_SPEED
        : Math.min(BASE_SPEED + streakNow * SPEED_STEP, MAX_SPEED);
      phaseRef.current = "spinning";
      setPhase("spinning");
      setLanded(null);
      setRound((r) => r + 1);
      window.requestAnimationFrame(() => dropRef.current?.focus());
    },
    []
  );

  useEffect(() => {
    arm(0);
  }, [arm]);

  const drop = useCallback(() => {
    if (phaseRef.current !== "spinning") return;
    audio.play({ freq: 340, slideTo: 120, type: "triangle", duration: 0.5, gain: 0.06 });
    if (reducedRef.current) {
      // Reduced motion: no deceleration travel or bounce — the pocket under
      // the pointer is the pocket you get, resolved instantly.
      const slot = slotUnderPointer();
      angleRef.current = -slot * SLOT_ANGLE;
      resolve(slot);
      return;
    }
    phaseRef.current = "settling";
    setPhase("settling");
    dropAtRef.current = performance.now();
  }, [audio, resolve, slotUnderPointer]);

  // The wheel: one rAF loop advances the spin, applies settling friction, and
  // paints the ring. The spin IS the mechanic, so reduced motion keeps it but
  // crawls — every pocket is readable before the drop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 16;
    const pocketR = radius - 24;
    let last = performance.now();

    const draw = (now: number) => {
      const palette = getLiveThemePalette();
      context.clearRect(0, 0, width, height);

      // Rim and hub.
      context.strokeStyle = accentAlpha(0.4);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, cy, radius + 8, 0, TAU);
      context.stroke();
      context.strokeStyle = accentAlpha(0.2);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(cx, cy, pocketR - 16, 0, TAU);
      context.stroke();

      // Pocket wedges, separators, and numbers rotate with the wheel.
      context.font = "10px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      for (let slot = 0; slot < SLOTS; slot += 1) {
        const a0 = -Math.PI / 2 + angleRef.current + (slot - 0.5) * SLOT_ANGLE;
        const isTarget = slot === TARGET_INDEX;
        context.beginPath();
        context.moveTo(cx, cy);
        context.arc(cx, cy, radius, a0, a0 + SLOT_ANGLE);
        context.closePath();
        context.fillStyle = isTarget
          ? accentAlpha(0.24)
          : accentAlpha(slot % 2 === 0 ? 0.04 : 0.1);
        context.fill();
        // Separator tick.
        context.strokeStyle = accentAlpha(0.3);
        context.beginPath();
        context.moveTo(cx + Math.cos(a0) * (pocketR - 16), cy + Math.sin(a0) * (pocketR - 16));
        context.lineTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
        context.stroke();
        // Number (kept upright for readability).
        const na = a0 + SLOT_ANGLE / 2;
        context.fillStyle = isTarget ? palette.bright : accentAlpha(0.6);
        context.fillText(String(WHEEL[slot]), cx + Math.cos(na) * (radius - 12), cy + Math.sin(na) * (radius - 12));
      }

      // The fixed pointer at the top.
      context.fillStyle = palette.bright;
      context.beginPath();
      context.moveTo(cx, cy - radius + 4);
      context.lineTo(cx - 5, cy - radius - 8);
      context.lineTo(cx + 5, cy - radius - 8);
      context.closePath();
      context.fill();

      // The ball: rides the pointer while spinning, drops radially into the
      // pocket with a decaying bounce while settling.
      let ballR = radius + 2;
      const settled = phaseRef.current === "won" || phaseRef.current === "missed";
      if (phaseRef.current === "settling" || settled) {
        const t = Math.min(1, (now - dropAtRef.current) / 900);
        const bounce = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 10;
        ballR = radius + 2 - (radius + 2 - (pocketR + 2)) * t + bounce;
        if (settled) ballR = pocketR + 2;
      }
      context.fillStyle = palette.accent;
      context.beginPath();
      context.arc(cx, cy - ballR, 4.5, 0, TAU);
      context.fill();
      context.strokeStyle = accentAlpha(0.5);
      context.beginPath();
      context.arc(cx, cy - ballR, 7, 0, TAU);
      context.stroke();
    };

    if (reducedMotion && phaseRef.current !== "spinning") {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const step = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (!document.hidden) {
        const frames = delta / 16.67;
        if (phaseRef.current === "spinning") {
          angleRef.current = (angleRef.current + speedRef.current * frames) % TAU;
        } else if (phaseRef.current === "settling") {
          speedRef.current *= Math.pow(FRICTION, frames);
          angleRef.current = (angleRef.current + speedRef.current * frames) % TAU;
          if (speedRef.current < STOP_SPEED) {
            const slot = slotUnderPointer();
            angleRef.current = -slot * SLOT_ANGLE;
            resolve(slot);
          }
        }
        draw(now);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, phase, resolve, slotUnderPointer]);

  const croupier = useMemo(() => {
    if (phase === "settling") return "Rien ne va plus.";
    if (phase === "won") return "Vingt-deux, noir. The couple exhales.";
    if (phase === "missed")
      return wasNear ? "So close — one pocket out." : "The house keeps it. Encore?";
    if (phase === "cashed") return "Cash it in. Lisbon waits.";
    return CROUPIER_IDLE[round % CROUPIER_IDLE.length];
  }, [phase, wasNear, round]);

  const status = useMemo(() => {
    if (phase === "won") return `Twenty-two. Pot doubles to ${pot} francs — streak ${streak}.`;
    if (phase === "missed") return `Landed on ${landed}. The pot is gone.`;
    if (phase === "cashed") return `Walked away with ${pot} francs after ${streak} straight.`;
    if (phase === "settling") return "No more bets — the wheel slows.";
    return "The wheel turns. Drop the ball so it settles on twenty-two.";
  }, [phase, landed, pot, streak]);

  const cashOut = useCallback(() => {
    phaseRef.current = "cashed";
    setPhase("cashed");
    recordSimulationScore(SCORE_ID, streak);
    audio.play({ freq: 659.25, duration: 0.25, gain: 0.08 });
    audio.play({ freq: 523.25, duration: 0.35, gain: 0.08, delay: 0.14 });
  }, [audio, streak]);

  const spinAgain = useCallback(() => {
    setPot(START_POT);
    setStreak(0);
    arm(0);
  }, [arm]);

  return (
    <div
      data-sim-state={phase}
      data-roulette-wins={streak}
      data-roulette-pot={pot}
      className="flex flex-col gap-3"
    >
      <CasablancaKeyframes />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div
          key={`near-${nearMiss}`}
          className={`grid place-items-center ${nearMiss > 0 ? "casa-anim-shake" : ""}`}
          onPointerDown={drop}
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            aria-hidden
            className="aspect-square w-full max-w-[380px] cursor-pointer border border-accent/25 bg-ink/60"
          />
        </div>

        <div className="flex flex-col gap-2.5 border border-accent/15 bg-ink/40 p-3 text-[10px] uppercase tracking-[0.12em]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Pot</span>
            <span key={pot} className="casa-anim-pop text-sm tracking-[0.08em] text-accent">
              {phase === "missed" ? 0 : pot} f
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Streak</span>
            <span className="text-white/75">{streak > 0 ? `×${streak}` : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Best</span>
            <span className="text-white/75">{best > 0 ? best : "—"}</span>
          </div>
          <p className="mt-1 border-t border-white/10 pt-2 normal-case italic tracking-normal text-[11px] leading-relaxed text-white/60">
            {croupier}
          </p>
          <p className="normal-case tracking-normal text-[10px] leading-relaxed text-white/40">
            The wheel keeps rolling after the drop — lead the pointer past twenty-two and let
            friction bring it home. Wins double the pot and speed the wheel.
          </p>
        </div>
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "spinning" && (
          <button
            ref={dropRef}
            type="button"
            onClick={drop}
            className="border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            Drop the ball
          </button>
        )}
        {phase === "won" && (
          <>
            <button
              type="button"
              onClick={() => arm(streak)}
              className="border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Let it ride
            </button>
            <button
              type="button"
              onClick={cashOut}
              className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cash out
            </button>
          </>
        )}
        {phase === "missed" && (
          <button
            type="button"
            onClick={spinAgain}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Spin again
          </button>
        )}
        {phase === "cashed" && (
          <button
            type="button"
            onClick={spinAgain}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back to the wheel
          </button>
        )}
        <CasablancaMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function CasablancaRoulette({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="casablanca-roulette-title"
      gameId="casablanca-roulette"
      eyebrow="House game"
      title="Land it on twenty-two"
      startLabel="Take the wheel"
      stage
      howToPlay={{
        objective:
          "Drop the ball so the wheel settles on twenty-two, then decide whether the pot rides again.",
        controls: [
          { keys: "click", does: "drop the ball straight onto the spinning wheel" },
          { keys: "Drop the ball", does: "the same drop from the button, focused each spin" },
          { keys: "Let it ride", does: "double the pot into a faster spin after a win" },
          { keys: "Cash out", does: "bank the streak and walk to the cashier" },
        ],
        tip: "The wheel keeps turning after the drop — lead the pointer past twenty-two and let friction carry it home. Reduced motion resolves instantly instead: the pocket under the pointer is the pocket you get.",
      }}
      reference={{
        quote: "Have you tried twenty-two tonight?",
        scene: "Casablanca (1943) · Rick rigs the roulette wheel for the young couple",
      }}
      onClose={onClose}
    >
      <RiggedWheel />
    </SimulationShell>
  );
}
