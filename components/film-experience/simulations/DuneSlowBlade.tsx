"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { createDuneSynth, type DuneSynth } from "./DuneAudio";

// The slow blade: a sparring bout to three touches. The blade swings quick and
// eager; hold the strike to steady it — the longer the hold, the slower the
// point — and release to commit. The shield only stops what comes fast, but
// from the second touch on the opponent keeps a guard that must lapse first,
// and hesitating past their patience invites the riposte.
const SCORE_ID = "dune-slow-blade";
const TOUCHES_TO_WIN = 3;
// Strike speed decays from 1 toward 0 as the hold lengthens.
const STEADY_TAU_MS = 620;
// Tier = your current touches: each one narrows the window and tightens guard.
const TIERS = [
  { label: "The shield alone", slowMax: 0.34, guarded: false, guardMs: 0, lapseMs: 0, patienceMs: 3600 },
  { label: "Guard up", slowMax: 0.26, guarded: true, guardMs: 1700, lapseMs: 1100, patienceMs: 3200 },
  { label: "The narrow way", slowMax: 0.2, guarded: true, guardMs: 2000, lapseMs: 850, patienceMs: 2800 },
] as const;
const RESOLVE_MS = 1100;

type Phase = "aiming" | "charging" | "resolved" | "victory" | "defeat";
type Outcome = "touch" | "parried" | "bounced" | "riposte" | null;

const speedFor = (heldMs: number) => Math.exp(-Math.max(0, heldMs) / STEADY_TAU_MS);

/**
 * The bout itself. Mounted by the shell only once the visitor starts, so the
 * blade is already swinging on mount; the strike control is focused here so a
 * keyboard can steady the blade the moment the stance is taken.
 */
function SlowBlade() {
  const [phase, setPhase] = useState<Phase>("aiming");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [playerTouches, setPlayerTouches] = useState(0);
  const [oppTouches, setOppTouches] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [lastSpeed, setLastSpeed] = useState<number | null>(null);
  const [guardOpen, setGuardOpen] = useState(true);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strikeButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  // Live mechanics in refs so a release reads the exact instant it happens.
  const phaseRef = useRef<Phase>("aiming");
  const outcomeRef = useRef<Outcome>(null);
  const playerRef = useRef(0);
  const oppRef = useRef(0);
  const bestRef = useRef(0);
  const chargeStartRef = useRef(0);
  const exchangeStartRef = useRef(0);
  const speedRef = useRef(1);
  const outcomeAtRef = useRef(0);
  const resolveTimerRef = useRef<number | null>(null);
  const synthRef = useRef<DuneSynth | null>(null);
  const mutedRef = useRef(false);

  const synth = useCallback(() => {
    if (!synthRef.current) synthRef.current = createDuneSynth(mutedRef.current);
    return synthRef.current;
  }, []);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    exchangeStartRef.current = performance.now();
    window.requestAnimationFrame(() => strikeButtonRef.current?.focus());
    const timers = resolveTimerRef;
    const synths = synthRef;
    return () => {
      if (timers.current !== null) window.clearTimeout(timers.current);
      synths.current?.dispose();
    };
  }, []);

  const tier = TIERS[Math.min(playerTouches, TIERS.length - 1)];

  const isGuardOpen = useCallback((now: number) => {
    const conf = TIERS[Math.min(playerRef.current, TIERS.length - 1)];
    if (!conf.guarded) return true;
    const cycle = conf.guardMs + conf.lapseMs;
    return (now - exchangeStartRef.current) % cycle >= conf.guardMs;
  }, []);

  const bookScore = useCallback(() => {
    const score = playerRef.current * 100 - oppRef.current * 30 + bestRef.current;
    if (score > 0) recordSimulationScore(SCORE_ID, score);
  }, []);

  const resolve = useCallback(
    (result: Exclude<Outcome, null>, committedSpeed: number | null) => {
      outcomeRef.current = result;
      outcomeAtRef.current = performance.now();
      setOutcome(result);
      if (committedSpeed !== null) setLastSpeed(committedSpeed);
      synthRef.current?.stopDrone();

      if (result === "touch") {
        playerRef.current += 1;
        setPlayerTouches(playerRef.current);
        const sharpness = Math.max(1, Math.round((1 - (committedSpeed ?? 1)) * 100));
        bestRef.current = Math.max(bestRef.current, sharpness);
        setBest(bestRef.current);
        synth().tone(700, 180, { gain: 0.05, glide: 980 });
      } else if (result === "bounced" || result === "riposte") {
        oppRef.current += 1;
        setOppTouches(oppRef.current);
        if (result === "bounced") synth().tone(220, 300, { type: "sawtooth", gain: 0.045 });
        else synth().tone(500, 420, { type: "sawtooth", gain: 0.045, glide: 90 });
      } else {
        synth().tone(300, 140, { gain: 0.035 });
      }

      if (playerRef.current >= TOUCHES_TO_WIN) {
        setPhaseSafe("victory");
        bookScore();
        synth().tone(320, 180, { gain: 0.05 });
        synth().tone(480, 200, { gain: 0.05 });
        synth().tone(640, 320, { gain: 0.05, glide: 760 });
        window.requestAnimationFrame(() => restartButtonRef.current?.focus());
        return;
      }
      if (oppRef.current >= TOUCHES_TO_WIN) {
        setPhaseSafe("defeat");
        bookScore();
        synth().tone(200, 500, { type: "sine", gain: 0.05, glide: 60 });
        window.requestAnimationFrame(() => restartButtonRef.current?.focus());
        return;
      }

      setPhaseSafe("resolved");
      resolveTimerRef.current = window.setTimeout(() => {
        resolveTimerRef.current = null;
        exchangeStartRef.current = performance.now();
        speedRef.current = 1;
        setSpeed(1);
        setPhaseSafe("aiming");
      }, RESOLVE_MS);
    },
    [bookScore, setPhaseSafe, synth]
  );

  const beginCharge = useCallback(() => {
    if (phaseRef.current !== "aiming") return;
    chargeStartRef.current = performance.now();
    speedRef.current = 1;
    setSpeed(1);
    setPhaseSafe("charging");
    synth().drone(220, 0.018);
  }, [setPhaseSafe, synth]);

  const commit = useCallback(() => {
    if (phaseRef.current !== "charging") return;
    const now = performance.now();
    const committed = speedFor(now - chargeStartRef.current);
    const conf = TIERS[Math.min(playerRef.current, TIERS.length - 1)];
    if (committed > conf.slowMax) {
      resolve("bounced", committed);
    } else if (!isGuardOpen(now)) {
      resolve("parried", committed);
    } else {
      resolve("touch", committed);
    }
  }, [isGuardOpen, resolve]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        beginCharge();
      }
    },
    [beginCharge]
  );

  const onKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") commit();
    },
    [commit]
  );

  const restart = useCallback(() => {
    if (resolveTimerRef.current !== null) {
      window.clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
    playerRef.current = 0;
    oppRef.current = 0;
    bestRef.current = 0;
    outcomeRef.current = null;
    speedRef.current = 1;
    exchangeStartRef.current = performance.now();
    setPlayerTouches(0);
    setOppTouches(0);
    setBest(0);
    setOutcome(null);
    setLastSpeed(null);
    setSpeed(1);
    setPhaseSafe("aiming");
    window.requestAnimationFrame(() => strikeButtonRef.current?.focus());
  }, [setPhaseSafe]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      synthRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // Mechanics loop: while a stance is live it tracks the guard's lapses, and
  // while charging it tracks the steadying speed and the opponent's patience.
  // This runs under reduced motion too — it is gameplay, not decoration.
  useEffect(() => {
    if (phase !== "aiming" && phase !== "charging") return;
    let frame = 0;
    const loop = () => {
      const now = performance.now();
      setGuardOpen(isGuardOpen(now));
      if (phaseRef.current === "charging") {
        const held = now - chargeStartRef.current;
        const current = speedFor(held);
        speedRef.current = current;
        setSpeed(current);
        synthRef.current?.drone(60 + current * 180, 0.018);
        const conf = TIERS[Math.min(playerRef.current, TIERS.length - 1)];
        if (held > conf.patienceMs) {
          // Held too long: the opponent reads the hesitation and answers.
          resolve("riposte", current);
          return;
        }
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, isGuardOpen, resolve]);

  // The piste: blade at left, shield and opponent at right. Decorative (the
  // meter and labels carry the same information); reduced motion parks the
  // swing and repaints on state changes instead of running the loop.
  const speedBucket = Math.round(speed * 25);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (time: number) => {
      const palette = getLiveThemePalette();
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      const now = performance.now();
      const sinceOutcome = now - outcomeAtRef.current;
      const flashing = outcomeAtRef.current > 0 && sinceOutcome < 500;
      const fade = flashing ? 1 - sinceOutcome / 500 : 0;

      // Impact shake on a bounce or riposte.
      const shaking =
        !reducedMotion &&
        flashing &&
        (outcomeRef.current === "bounced" || outcomeRef.current === "riposte");
      if (shaking) {
        context.save();
        context.translate(Math.sin(time * 0.09) * 4 * fade, Math.cos(time * 0.11) * 3 * fade);
      }

      const midY = height * 0.52;
      const shieldX = width * 0.68;
      const open = isGuardOpen(now);
      const conf = TIERS[Math.min(playerRef.current, TIERS.length - 1)];

      // The opponent: a watching silhouette behind their shield.
      context.strokeStyle = accentAlpha(0.55);
      context.lineWidth = 1.4;
      context.beginPath();
      context.arc(width * 0.82, midY - height * 0.18, 7, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(width * 0.82, midY - height * 0.11);
      context.lineTo(width * 0.82, midY + height * 0.16);
      context.moveTo(width * 0.82, midY - height * 0.05);
      context.lineTo(width * 0.74, midY + height * 0.02); // their guard arm
      context.moveTo(width * 0.82, midY + height * 0.16);
      context.lineTo(width * 0.78, midY + height * 0.3);
      context.moveTo(width * 0.82, midY + height * 0.16);
      context.lineTo(width * 0.86, midY + height * 0.3);
      context.stroke();

      // The shield: a shimmer band; bright lattice while guarded, dimmer and
      // thinner while the guard lapses.
      const shimmer = reducedMotion ? 0.14 : 0.12 + Math.abs(Math.sin(time * 0.003)) * 0.1;
      const guardGlow = conf.guarded && !open ? 0.22 : 0;
      const bounceFlare = flashing && outcomeRef.current === "bounced" ? 0.5 * fade : 0;
      context.fillStyle = accentAlpha(shimmer + guardGlow + bounceFlare);
      context.fillRect(shieldX - 2, height * 0.12, 4, height * 0.76);
      const lattice = conf.guarded && !open ? 7 : 4;
      for (let i = 0; i < lattice; i += 1) {
        const gx = shieldX + (i - (lattice - 1) / 2) * 6;
        context.strokeStyle = accentAlpha(0.05 + guardGlow * 0.5 + bounceFlare * 0.6);
        context.beginPath();
        context.moveTo(gx, height * 0.12);
        context.lineTo(gx, height * 0.88);
        context.stroke();
      }

      // The blade from the left: its tip swings while aiming and steadies as
      // the strike is held. Slower = brighter.
      const charging = phaseRef.current === "charging";
      const amplitude = charging ? speedRef.current : 1;
      const wave = reducedMotion ? 0 : Math.sin(time * 0.0035) * amplitude;
      const tipX = shieldX - 14;
      const tipY = midY + wave * height * 0.26;
      const slowness = 1 - (charging ? speedRef.current : 1);
      context.strokeStyle = accentAlpha(0.5 + slowness * 0.5);
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(width * 0.06, midY + height * 0.2);
      context.lineTo(tipX, tipY);
      context.stroke();
      context.beginPath();
      context.arc(tipX, tipY, 2.5 + slowness * 3, 0, Math.PI * 2);
      context.fillStyle = accentAlpha(0.45 + slowness * 0.55);
      context.fill();

      // Outcome effects.
      if (flashing && outcomeRef.current === "touch") {
        // The clean pass-through: the blade extended past the shield, with a
        // spark at the crossing.
        context.strokeStyle = accentAlpha(0.9 * fade);
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(tipX, midY);
        context.lineTo(width * 0.8, midY - height * 0.06);
        context.stroke();
        for (let r = 0; r < 6; r += 1) {
          const angle = (r / 6) * Math.PI * 2;
          context.beginPath();
          context.moveTo(shieldX, midY);
          context.lineTo(
            shieldX + Math.cos(angle) * 16 * fade,
            midY + Math.sin(angle) * 16 * fade
          );
          context.strokeStyle = accentAlpha(0.6 * fade);
          context.lineWidth = 1;
          context.stroke();
        }
      }
      if (flashing && outcomeRef.current === "bounced") {
        // The flare: the shield turns the point in a burst of sparks.
        for (let r = 0; r < 8; r += 1) {
          const angle = -Math.PI / 2 + ((r - 3.5) / 8) * Math.PI;
          context.beginPath();
          context.moveTo(shieldX - 4, tipY);
          context.lineTo(
            shieldX - 4 + Math.cos(angle + Math.PI) * 22 * fade,
            tipY + Math.sin(angle) * 22 * fade
          );
          context.strokeStyle = accentAlpha(0.7 * fade);
          context.lineWidth = 1;
          context.stroke();
        }
      }
      if (flashing && outcomeRef.current === "riposte") {
        // Their blade crosses back over yours.
        context.strokeStyle = accentAlpha(0.85 * fade);
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(width * 0.74, midY + height * 0.02);
        context.lineTo(width * 0.12, midY + height * 0.12);
        context.stroke();
      }
      if (flashing && outcomeRef.current === "parried") {
        // A short deflect arc at the guard arm.
        context.strokeStyle = accentAlpha(0.6 * fade);
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(width * 0.72, midY, 12, -0.9, 0.9);
        context.stroke();
      }

      if (shaking) context.restore();
    };

    if (reducedMotion) {
      draw(performance.now());
      return () => window.removeEventListener("resize", resize);
    }
    let frame = 0;
    const loop = (time: number) => {
      if (!document.hidden) draw(time);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
    // The still frame must repaint as the discrete bout state advances.
  }, [reducedMotion, isGuardOpen, phase, outcome, playerTouches, oppTouches, guardOpen, speedBucket]);

  const status = useMemo(() => {
    if (phase === "victory")
      return `Three touches. The slow blade penetrated. Best sharpness ${best}.`;
    if (phase === "defeat") return "Three against you. The shield won this bout.";
    if (phase === "resolved") {
      const spoken = Math.round((lastSpeed ?? 0) * 100);
      if (outcome === "touch") return `Through — the slow blade penetrated. Speed ${spoken}.`;
      if (outcome === "bounced") return `Too fast — the shield turned it. Speed ${spoken}.`;
      if (outcome === "parried") return "Slow enough, but the guard held. Wait for the lapse.";
      return "You hesitated. The riposte lands.";
    }
    if (phase === "charging")
      return speed <= tier.slowMax
        ? "Slow enough — release, before their patience ends."
        : "Steadying… hold until the point crawls.";
    if (tier.guarded)
      return guardOpen
        ? "The guard lapses. Steady the blade and commit."
        : "Guard held. Hold to steady the blade; wait for the lapse.";
    return "Hold strike to steady the blade; release it slow.";
  }, [phase, outcome, best, lastSpeed, speed, tier, guardOpen]);

  const over = phase === "victory" || phase === "defeat";
  const pips = (count: number) =>
    Array.from({ length: TOUCHES_TO_WIN }, (_, i) => (i < count ? "●" : "○")).join(" ");

  return (
    <div
      data-sim-state={phase}
      data-outcome={outcome ?? "none"}
      data-player={playerTouches}
      data-opponent={oppTouches}
      data-best={best}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          You {pips(playerTouches)} · Them {pips(oppTouches)}
        </span>
        <span className="flex items-center gap-3">
          <span>{tier.label}</span>
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="border border-accent/30 px-2 py-0.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {muted ? "muted" : "sound"}
          </button>
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-64"
        />
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/85">
                {phase === "victory" ? "The slow blade penetrated." : "The shield held."}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                {playerTouches}–{oppTouches} · best sharpness {best}
              </p>
              <button
                ref={restartButtonRef}
                type="button"
                onClick={restart}
                className="border border-accent/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Reset the bout
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
        <span className="shrink-0">
          Speed{phase === "charging" && speed <= tier.slowMax ? " · slow enough" : ""}
        </span>
        <div className="relative h-1.5 w-full bg-white/10" aria-hidden>
          <div
            className="absolute top-0 h-full bg-accent/25"
            style={{ width: `${(tier.slowMax * 100).toFixed(0)}%` }}
          />
          <div
            className="h-full bg-accent/80"
            style={{ width: `${(speed * 100).toFixed(1)}%` }}
          />
        </div>
        <span className="shrink-0 text-white/35">
          {tier.guarded ? (guardOpen ? "guard lapsing" : "guard held") : "no guard"}
        </span>
      </div>

      {!over && (
        <button
          ref={strikeButtonRef}
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            beginCharge();
          }}
          onPointerUp={commit}
          onPointerLeave={commit}
          onPointerCancel={commit}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          aria-disabled={phase === "resolved"}
          className="h-14 w-full touch-none select-none border border-accent/40 text-[12px] uppercase tracking-[0.2em] hover:bg-accent/10 aria-disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {phase === "charging" ? "Steadying…" : "Strike"}
        </button>
      )}

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function DuneSlowBlade({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="dune-slow-blade-title"
      gameId="dune-slow-blade"
      eyebrow="Shield bout"
      title="The slow blade"
      startLabel="Take the stance"
      stage
      howToPlay={{
        objective: "Land three touches through the shield before it lands three on you.",
        controls: [
          { keys: "hold", does: "press and hold strike — the longer you hold, the slower the point" },
          { keys: "release", does: "commit the strike at the speed it has reached" },
          { keys: "Space / Enter", does: "hold and release the strike control from the keyboard" },
        ],
        tip: "Too fast and the shield turns it; from your second touch the opponent also keeps a guard, so release during a lapse. Holding past their patience draws a riposte.",
      }}
      reference={{
        quote: "The slow blade penetrates the shield.",
        scene: "Dune (2021) · Gurney's training bout, shields flaring on fast strikes",
      }}
      onClose={onClose}
    >
      <SlowBlade />
    </SimulationShell>
  );
}
