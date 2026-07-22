"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  FuryRoadMeter,
  FuryRoadMuteButton,
  FuryRoadPips,
  FuryRoadStat,
  withAlpha,
  type FloatNote,
  type FuryRoadHalfProps,
} from "@/components/film-experience/simulations/FuryRoadShared";
import {
  CARGOS,
  DAMPING,
  GRAVITY_OVER_LENGTH,
  GRIP_MAX,
  GRIP_UNIT,
  MAX_ANGLE,
  POLECAT_SCORE_ID,
  PUMP_GRIP_DRAIN,
  PUMP_TORQUE,
  cargoScore,
  polecatRating,
  polecatRunScore,
} from "@/components/film-experience/simulations/FuryRoadPolecatRig";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";

/**
 * A real pendulum on a real pole, and the two things a polecat does with one.
 *
 * The arc is integrated rather than faked: gravity pulls the bob back toward
 * vertical, the wind bleeds energy out of it, and a held pump adds torque along
 * the direction of travel — so the swing has to be worked up over several
 * passes, exactly like pumping a playground swing. Pumping costs grip, and
 * pushing past the top of the arc whips the pole over the pivot and throws the
 * rider, so "just hold pump" is a way to lose.
 *
 * Each crate is two calls: reach it at the angle it hangs at, then let it go
 * over the rig deck on the way back. Both are scored by how near the middle of
 * their window the call landed.
 */

const TRAIL = 26;
const MAX_PARTICLES = 60;

type Phase = "swinging" | "carrying" | "paused" | "fell" | "delivered";

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

export default function FuryRoadPolecatSwing({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [phase, setPhase] = useState<Phase>("swinging");
  const [cargoIndex, setCargoIndex] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [grip, setGrip] = useState(100);
  const [points, setPoints] = useState(0);
  const [banked, setBanked] = useState(0);
  const [arc, setArc] = useState(0);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  const [endReason, setEndReason] = useState<"whipped" | "spent">("spent");

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("swinging");
  const resumeToRef = useRef<Phase>("swinging");
  const thetaRef = useRef(0.35);
  const omegaRef = useRef(0);
  const ampRef = useRef(0.35);
  const gripRef = useRef(100);
  const pumpingRef = useRef(false);
  const cargoRef = useRef(0);
  const deliveredRef = useRef(0);
  const pointsRef = useRef(0);
  const chainRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastRef = useRef(0);
  const clockRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const uiClockRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const note = useCallback((text: string) => {
    setFloatNote({ id: performance.now(), text });
  }, []);

  const goto = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const arm = useCallback(() => {
    thetaRef.current = 0.35;
    omegaRef.current = 0;
    ampRef.current = 0.35;
    gripRef.current = 100;
    pumpingRef.current = false;
    cargoRef.current = 0;
    deliveredRef.current = 0;
    pointsRef.current = 0;
    chainRef.current = 0;
    trailRef.current = [];
    particlesRef.current = [];
    keysRef.current.clear();
    lastRef.current = 0;
    clockRef.current = 0;
    shakeRef.current = 0;
    flashRef.current = 0;
    setCargoIndex(0);
    setDelivered(0);
    setGrip(100);
    setPoints(0);
    setBanked(0);
    setArc(0.35);
    setFloatNote(null);
    goto("swinging");
    window.requestAnimationFrame(() => surfaceRef.current?.focus());
  }, [goto]);

  useEffect(() => {
    arm();
  }, [arm]);

  const spawnBurst = useCallback((count: number, spread: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles = particlesRef.current;
    const head = trailRef.current[trailRef.current.length - 1];
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * spread;
      particles.push({
        x: head?.x ?? canvas.width / 2,
        y: head?.y ?? canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
      });
    }
  }, []);

  const finish = useCallback(
    (won: boolean, reason: "whipped" | "spent") => {
      const total = polecatRunScore(pointsRef.current, deliveredRef.current);
      setBanked(total);
      recordSimulationScore(POLECAT_SCORE_ID, total);
      setEndReason(reason);
      if (won) audio.fanfare();
      else {
        audio.fail();
        shakeRef.current = 18;
        flashRef.current = 1;
      }
      goto(won ? "delivered" : "fell");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio, goto]
  );

  /** The one action button: reach for the crate, or let it go over the deck. */
  const act = useCallback(() => {
    const live = phaseRef.current === "swinging" || phaseRef.current === "carrying";
    if (!live) return;
    audio.unlock();
    const cargo = CARGOS[cargoRef.current];
    const theta = thetaRef.current;
    const carrying = phaseRef.current === "carrying";
    const target = carrying ? cargo.dropAngle : cargo.angle;
    const window_ = carrying ? cargo.dropReach : cargo.reach;
    const offset = Math.abs(theta - target);

    if (offset > window_) {
      // A miss costs grip, not the run — the arc keeps going either way.
      gripRef.current = Math.max(0, gripRef.current - GRIP_UNIT);
      chainRef.current = 0;
      setGrip(gripRef.current);
      audio.impact();
      shakeRef.current = 9;
      flashRef.current = 0.7;
      note(carrying ? "let go too early" : "nowhere near it");
      if (gripRef.current <= 0) finish(false, "spent");
      return;
    }

    // Inside the window: the middle of it pays most, and a slow bob pays more
    // than a fast one — the top of the arc is where a polecat actually works.
    const closeness = 1 - (offset / window_) * 0.5;
    const settled = 1 - Math.min(0.35, Math.abs(omegaRef.current) / 4);
    const accuracy = Math.max(0.25, closeness * settled);
    const earned = cargoScore(accuracy, chainRef.current);
    pointsRef.current += earned;
    chainRef.current += 1;
    setPoints(pointsRef.current);
    audio.catchCue();
    spawnBurst(10, 2.4);
    flashRef.current = 0.5;

    if (!carrying) {
      note(`hooked ${cargo.label} · +${earned}`);
      // Taking on the weight bleeds a little speed out of the swing.
      omegaRef.current *= 0.86;
      goto("carrying");
      return;
    }

    // The crate is on the deck.
    gripRef.current = Math.min(100, gripRef.current + GRIP_UNIT * 0.55);
    setGrip(gripRef.current);
    deliveredRef.current += 1;
    setDelivered(deliveredRef.current);
    note(`onto the deck · +${earned}`);
    if (cargoRef.current + 1 >= CARGOS.length) {
      finish(true, "spent");
      return;
    }
    cargoRef.current += 1;
    setCargoIndex(cargoRef.current);
    audio.fanfare();
    goto("swinging");
  }, [audio, finish, goto, note, spawnBurst]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "swinging" || phaseRef.current === "carrying") {
      resumeToRef.current = phaseRef.current;
      pumpingRef.current = false;
      keysRef.current.clear();
      audio.setEngine(0);
      goto("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      goto(resumeToRef.current);
      window.requestAnimationFrame(() => surfaceRef.current?.focus());
    }
  }, [audio, goto]);

  // ---------------------------------------------------------------------
  // One rAF loop: integrate the pendulum and paint the pole.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    size();

    let palette = getLiveThemePalette();
    let paletteSampledAt = 0;
    const acc = (alpha: number) => withAlpha(palette.accent, alpha);

    const pumping = () =>
      pumpingRef.current ||
      keysRef.current.has(" ") ||
      keysRef.current.has("ArrowUp") ||
      keysRef.current.has("w");

    const advance = (dt: number) => {
      clockRef.current += dt;
      const theta = thetaRef.current;
      let omega = omegaRef.current;

      // Pumping along the direction of travel is what actually raises a swing.
      // Standing still on the pole, it kicks the arc off the bottom instead.
      const wantsPump = pumping() && gripRef.current > 0;
      let torque = 0;
      if (wantsPump) {
        const direction = Math.abs(omega) < 0.08 ? (theta >= 0 ? 1 : -1) : Math.sign(omega);
        torque = PUMP_TORQUE * direction;
        gripRef.current = Math.max(0, gripRef.current - PUMP_GRIP_DRAIN * dt);
        if (gripRef.current <= 0) {
          finish(false, "spent");
          return;
        }
      } else if (phaseRef.current !== "carrying") {
        // Hands off, the arms recover a little.
        gripRef.current = Math.min(100, gripRef.current + 4 * dt);
      }

      const alpha = -GRAVITY_OVER_LENGTH * Math.sin(theta) - DAMPING * omega + torque;
      omega += alpha * dt;
      const next = theta + omega * dt;
      thetaRef.current = next;
      omegaRef.current = omega;
      ampRef.current = Math.max(Math.abs(next), ampRef.current * 0.995);

      // Over the top: the pole whips past the pivot and the rider goes.
      if (Math.abs(next) > MAX_ANGLE) {
        finish(false, "whipped");
        return;
      }

      audio.setEngine(0.25 + Math.min(0.6, Math.abs(omega) / 5));
    };

    const draw = (now: number) => {
      if (now - paletteSampledAt > 400) {
        paletteSampledAt = now;
        palette = getLiveThemePalette();
      }
      const cargo = CARGOS[Math.min(cargoRef.current, CARGOS.length - 1)];
      const theta = thetaRef.current;
      const carrying = phaseRef.current === "carrying";

      context.save();
      const shake = shakeRef.current;
      if (shake > 0.1) {
        context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      context.fillStyle = palette.inkSoft;
      context.fillRect(-40, -40, width + 80, height + 80);

      const pivotX = width / 2;
      const pivotY = height * 0.1;
      const length = height * 0.62;
      const bobX = pivotX + Math.sin(theta) * length;
      const bobY = pivotY + Math.cos(theta) * length;

      trailRef.current.push({ x: bobX, y: bobY });
      if (trailRef.current.length > TRAIL) trailRef.current.shift();

      // The road under the convoy, streaming past.
      const roadY = height - 12;
      context.strokeStyle = acc(0.3);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, roadY);
      context.lineTo(width, roadY);
      context.stroke();
      context.strokeStyle = acc(0.16);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const x = ((clockRef.current * 420 + i * 80) % (width + 120)) - 60;
        context.moveTo(width - x, roadY + 4);
        context.lineTo(width - x - 26, roadY + 4);
      }
      context.stroke();

      // The rig deck: the drop zone, on the far side of the arc.
      const deckX = pivotX + Math.sin(cargo.dropAngle) * length;
      const deckY = pivotY + Math.cos(cargo.dropAngle) * length;
      context.strokeStyle = acc(0.5);
      context.lineWidth = 2;
      context.strokeRect(deckX - 26, deckY - 4, 52, 16);
      context.fillStyle = acc(0.16);
      context.fillRect(deckX - 26, deckY - 4, 52, 16);

      // Both windows drawn as arcs on the swing, so the target is never a
      // guess: where the crate hangs, and where it has to be let go.
      const drawWindow = (center: number, half: number, active: boolean) => {
        context.strokeStyle = active ? palette.bright : acc(0.28);
        context.lineWidth = active ? 6 : 3;
        context.beginPath();
        // Canvas arcs run from +x; the pendulum's zero hangs at +y, so the
        // window angles are measured off vertical and offset by a quarter turn.
        context.arc(pivotX, pivotY, length, Math.PI / 2 - center - half, Math.PI / 2 - center + half);
        context.stroke();
      };
      drawWindow(cargo.angle, cargo.reach, !carrying);
      drawWindow(cargo.dropAngle, cargo.dropReach, carrying);

      // The pole's trail: where the bob has just been.
      context.strokeStyle = acc(0.25);
      context.lineWidth = 2;
      context.beginPath();
      trailRef.current.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();

      // The pole itself, and the truck it is bolted to.
      context.strokeStyle = acc(0.75);
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(pivotX, pivotY);
      context.lineTo(bobX, bobY);
      context.stroke();
      context.fillStyle = acc(0.6);
      context.fillRect(pivotX - 30, pivotY - 14, 60, 14);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      context.strokeRect(pivotX - 30, pivotY - 14, 60, 14);

      // The crate hanging where it hangs, until it is on the pole.
      if (!carrying) {
        const cargoX = pivotX + Math.sin(cargo.angle) * length;
        const cargoY = pivotY + Math.cos(cargo.angle) * length;
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.strokeRect(cargoX - 10, cargoY - 10, 20, 20);
        context.beginPath();
        context.moveTo(cargoX, cargoY - 10);
        context.lineTo(cargoX, cargoY - 20);
        context.stroke();
      }

      // The rider on the end of the pole, carrying or reaching.
      context.fillStyle = palette.bright;
      context.beginPath();
      context.arc(bobX, bobY, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = palette.bright;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bobX, bobY + 5);
      context.lineTo(bobX + Math.sin(theta) * 12, bobY + Math.cos(theta) * 16);
      context.stroke();
      if (carrying) {
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.strokeRect(bobX - 9, bobY + 12, 18, 18);
      }

      // Particles: grit thrown off a catch.
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.08;
        particle.life -= 0.028;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        context.fillStyle = withAlpha(palette.bright, particle.life);
        context.fillRect(particle.x, particle.y, 2, 2);
      }

      if (flashRef.current > 0.01) {
        context.fillStyle = acc(flashRef.current * 0.3);
        context.fillRect(-40, -40, width + 80, height + 80);
      }

      context.restore();
    };

    let frame = 0;
    let settledFrames = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        const live = phaseRef.current === "swinging" || phaseRef.current === "carrying";
        if (live) {
          const dt = lastRef.current ? Math.min(0.032, (now - lastRef.current) / 1000) : 0;
          lastRef.current = now;
          if (dt > 0) advance(dt);
        } else {
          lastRef.current = now;
        }
        settledFrames = live ? 0 : settledFrames + 1;
        if (live || settledFrames < 40) {
          shakeRef.current *= 0.86;
          flashRef.current *= 0.9;
          draw(now);
        }
        if (live && now - uiClockRef.current > 90) {
          uiClockRef.current = now;
          setGrip(gripRef.current);
          setArc(Math.abs(thetaRef.current));
        }
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, [audio, finish]);

  // Silence the engine whenever the pole is not actually swinging.
  useEffect(() => {
    if (phase !== "swinging" && phase !== "carrying") audio.setEngine(0);
  }, [phase, audio]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      audio.unlock();
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (["ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)) event.preventDefault();
      if (key === "p") {
        togglePause();
        return;
      }
      if (key === "g" || key === "Enter") {
        if (!event.repeat) act();
        return;
      }
      setShowHelp(false);
      keysRef.current.add(key);
    },
    [act, audio, togglePause]
  );

  const onKeyUp = useCallback((event: ReactKeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keysRef.current.delete(key);
  }, []);

  const cargo = CARGOS[Math.min(cargoIndex, CARGOS.length - 1)];
  const carrying = phase === "carrying";
  const rating = useMemo(() => polecatRating(delivered), [delivered]);
  const over = phase === "fell" || phase === "delivered";
  const needed = carrying ? Math.abs(cargo.dropAngle) : cargo.angle;
  const inWindow =
    Math.abs(arc - needed) <= (carrying ? cargo.dropReach : cargo.reach) && !over && phase !== "paused";

  const status = useMemo(() => {
    if (phase === "delivered")
      return `The whole load is on the deck. ${rating.grade} — ${rating.note} ${banked} points banked.`;
    if (phase === "fell")
      return endReason === "whipped"
        ? `The pole whipped over the top. ${rating.grade} — ${banked} points banked.`
        : `The arms gave out. ${rating.grade} — ${banked} points banked.`;
    if (phase === "paused") return "Held. The pole is frozen mid-arc.";
    if (carrying) return `Carrying ${cargo.label} — let it go over the deck on the way back.`;
    return `${cargo.label} hangs high. Pump the arc up to it, then reach.`;
  }, [phase, rating, banked, endReason, carrying, cargo.label]);

  return (
    <div
      data-sim-state={phase}
      data-polecat-mode="swing"
      data-polecat-cargo={cargoIndex + 1}
      data-polecat-delivered={delivered}
      data-polecat-grip={Math.round(grip)}
      data-polecat-arc={arc.toFixed(2)}
      data-polecat-points={points}
      data-polecat-score={banked}
      className="flex flex-col gap-3"
    >
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="crate" value={`${Math.min(cargoIndex + 1, CARGOS.length)}/${CARGOS.length}`} width="w-8" />
        <FuryRoadStat label="delivered" value={delivered} width="w-6" pulseKey={delivered} />
        <FuryRoadStat label="points" value={points} width="w-12" pulseKey={points} />
        <FuryRoadPips label="grip" value={Math.ceil(grip / GRIP_UNIT)} max={GRIP_MAX} />
        <span className="ml-auto flex gap-2">
          {(phase === "swinging" || phase === "carrying" || phase === "paused") && (
            <button
              type="button"
              onClick={togglePause}
              className="border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
          <FuryRoadMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      {/* Play field */}
      <div
        ref={surfaceRef}
        role="application"
        tabIndex={0}
        aria-label="Ride the polecat. Hold space, up arrow, or W to pump the swing higher; press G or Enter to reach for the crate and again to let it go over the deck; P to pause. On touch, hold the pole to pump and use the reach button."
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={(event) => {
          event.preventDefault();
          audio.unlock();
          setShowHelp(false);
          pumpingRef.current = true;
          surfaceRef.current?.focus();
        }}
        onPointerUp={() => {
          pumpingRef.current = false;
        }}
        onPointerCancel={() => {
          pumpingRef.current = false;
        }}
        onPointerLeave={() => {
          pumpingRef.current = false;
        }}
        onBlur={() => keysRef.current.clear()}
        style={{ touchAction: "none" }}
        className="relative h-56 overflow-hidden border border-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-80"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {showHelp && phase === "swinging" && (
          <p
            aria-hidden
            className="fr-anim-rise pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/70"
          >
            hold to pump the arc · reach at the top
          </p>
        )}

        {floatNote && (
          <p
            key={floatNote.id}
            aria-hidden
            className="fr-anim-float pointer-events-none absolute inset-x-0 top-4 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright"
          >
            {floatNote.text}
          </p>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">held</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80">
            <p className="fr-anim-banner border-2 border-accent px-4 py-2 text-sm uppercase tracking-[0.3em] text-accent">
              {phase === "delivered" ? "full load" : endReason === "whipped" ? "whipped over" : "arms gone"}
            </p>
          </div>
        )}
      </div>

      {/* Meters: how far the arc has been worked up, against what it needs. */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <FuryRoadMeter
            label="Arc"
            value={arc / MAX_ANGLE}
            note={inWindow ? "in reach" : arc > MAX_ANGLE * 0.9 ? "whipping" : "building"}
            danger={arc > MAX_ANGLE * 0.9}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-bright"
            style={{ left: `${(needed / MAX_ANGLE) * 100}%` }}
          />
        </div>
        <FuryRoadMeter
          label="Grip"
          value={grip / 100}
          note={grip <= 34 ? "slipping" : "holding"}
          danger={grip <= 34}
        />
      </div>

      {/* Controls: the field pumps by hold, but both beats also get buttons so
          the game is playable without a drag surface. */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {!over && phase !== "paused" && (
          <>
            <button
              type="button"
              aria-label="Pump the swing"
              onPointerDown={(event) => {
                event.preventDefault();
                audio.unlock();
                setShowHelp(false);
                pumpingRef.current = true;
              }}
              onPointerUp={() => {
                pumpingRef.current = false;
              }}
              onPointerLeave={() => {
                pumpingRef.current = false;
              }}
              onPointerCancel={() => {
                pumpingRef.current = false;
              }}
              style={{ touchAction: "none" }}
              className="flex-1 border border-accent/40 py-2 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            >
              pump
            </button>
            {/* One element for both beats, so no button is ever swapped in
                under a gesture that is already mid-flight. */}
            <button
              type="button"
              aria-label={carrying ? "Let the cargo go" : "Reach for the cargo"}
              onClick={act}
              className="flex-1 border border-accent/40 py-2 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            >
              {carrying ? "let go" : "reach"}
            </button>
          </>
        )}
        {over && (
          <button
            ref={actionRef}
            type="button"
            onClick={arm}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Man the pole again
          </button>
        )}
      </div>

      {over && (
        <div className="fr-anim-rise border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">{rating.grade}</p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Crates delivered — {delivered}</li>
            <li>Cargo points — {points}</li>
            <li className="text-accent">Banked {banked} points</li>
          </ul>
        </div>
      )}

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/60">
        {status}
      </p>
    </div>
  );
}
