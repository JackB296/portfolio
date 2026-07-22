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
  useFreshPress,
  withAlpha,
  type FloatNote,
  type FuryRoadHalfProps,
} from "@/components/film-experience/simulations/FuryRoadShared";
import {
  CHROME_MAX_MS,
  GRIP_MAX,
  SLIP_BAND,
  VEHICLES,
  WITNESS_SCORE_ID,
  chromeMultiplier,
  chromeNote,
  leapScore,
  witnessRating,
  witnessRunScore,
} from "@/components/film-experience/simulations/FuryRoadWitnessConvoy";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";

/**
 * The leap, built the way the scene is: the ritual first, then the jump.
 *
 * Every crossing is two interactions. Hold the chrome can — release near the
 * peak for a full coat, hold too long and it floods — and the coat becomes the
 * multiplier on the jump that follows. Then read the gap: it drifts with the
 * wind and breathes with the vehicle's sway, so the window is never in the same
 * place twice. Land two on a vehicle and you are up onto the next one, faster
 * and narrower, all the way to the rig.
 *
 * Landing on the lip of the gap is a slip, not a death: it costs grip. Only
 * missing the vehicle entirely — or slipping with no grip left — ends the run.
 */

const LEAPS_PER_VEHICLE = 2;
const FLIGHT_MS = 520;
const MAX_PARTICLES = 70;

type Phase = "chroming" | "aiming" | "flying" | "paused" | "fallen" | "witnessed";

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

export default function FuryRoadWitnessLeap({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [phase, setPhase] = useState<Phase>("chroming");
  const [vehicle, setVehicle] = useState(0);
  const [landed, setLanded] = useState(0);
  const [grip, setGrip] = useState(GRIP_MAX);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [banked, setBanked] = useState(0);
  const [chromeHeld, setChromeHeld] = useState(0);
  const [chrome, setChrome] = useState(1);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("chroming");
  const resumeToRef = useRef<Phase>("chroming");
  const vehicleRef = useRef(0);
  const landedRef = useRef(0);
  const gripRef = useRef(GRIP_MAX);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const pointsRef = useRef(0);
  const chromeStartRef = useRef(0);
  const chromeRef = useRef(1);
  const markerRef = useRef(0);
  const markerDirRef = useRef(1);
  const clockRef = useRef(0);
  const lastRef = useRef(0);
  const flightStartRef = useRef(0);
  const flightFromRef = useRef(0);
  const flightToRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const uiClockRef = useRef(0);
  // The last resolved gap, kept so the flight and fall frames paint the window
  // the jump was actually aimed at rather than one that has since drifted.
  const frozenGapRef = useRef({ center: 0.5, half: 0.16 });

  const { freshPress, rootProps } = useFreshPress(phase);

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
    vehicleRef.current = 0;
    landedRef.current = 0;
    gripRef.current = GRIP_MAX;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    pointsRef.current = 0;
    chromeRef.current = 1;
    chromeStartRef.current = 0;
    markerRef.current = 0;
    markerDirRef.current = 1;
    clockRef.current = 0;
    lastRef.current = 0;
    shakeRef.current = 0;
    flashRef.current = 0;
    particlesRef.current = [];
    setVehicle(0);
    setLanded(0);
    setGrip(GRIP_MAX);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setBanked(0);
    setChrome(1);
    setChromeHeld(0);
    setFloatNote(null);
    goto("chroming");
    window.requestAnimationFrame(() => surfaceRef.current?.focus());
  }, [goto]);

  useEffect(() => {
    arm();
  }, [arm]);

  const spawnSpray = useCallback((count: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles = particlesRef.current;
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      particles.push({
        x: canvas.width * 0.24,
        y: canvas.height * 0.3,
        vx: -0.6 - Math.random() * 1.6,
        vy: (Math.random() - 0.5) * 1.6,
        life: 1,
      });
    }
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      audio.setWind(0);
      const total = witnessRunScore(pointsRef.current, vehicleRef.current);
      setBanked(total);
      recordSimulationScore(WITNESS_SCORE_ID, total);
      if (won) audio.fanfare();
      else {
        audio.fail();
        shakeRef.current = 16;
        flashRef.current = 1;
      }
      goto(won ? "witnessed" : "fallen");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio, goto]
  );

  const releaseChrome = useCallback(() => {
    if (phaseRef.current !== "chroming" || chromeStartRef.current === 0) return;
    const held = Math.min(CHROME_MAX_MS, performance.now() - chromeStartRef.current);
    chromeStartRef.current = 0;
    const multiplier = chromeMultiplier(held, VEHICLES[vehicleRef.current].chromePeak);
    chromeRef.current = multiplier;
    setChrome(multiplier);
    setChromeHeld(held);
    note(chromeNote(multiplier));
    audio.tick(Math.round(multiplier * 4));
    goto("aiming");
  }, [audio, goto, note]);

  const beginChrome = useCallback(() => {
    if (phaseRef.current !== "chroming" || chromeStartRef.current !== 0) return;
    audio.unlock();
    audio.spray();
    chromeStartRef.current = performance.now();
    setShowHelp(false);
  }, [audio]);

  const leap = useCallback(() => {
    if (phaseRef.current !== "aiming") return;
    audio.unlock();
    const spec = VEHICLES[vehicleRef.current];
    const t = clockRef.current;
    const center = 0.5 + Math.sin(t * 0.9) * spec.wind + Math.sin(t * 0.31) * spec.wind * 0.6;
    const half = spec.gapHalf * (0.84 + 0.16 * Math.sin(t * spec.sway));
    frozenGapRef.current = { center, half };
    const offset = Math.abs(markerRef.current - center);

    if (offset <= half) {
      // A landing. Dead centre pays double what the lip of the gap does.
      const accuracy = 1 - (offset / half) * 0.55;
      const earned = leapScore(accuracy, chromeRef.current, streakRef.current);
      pointsRef.current += earned;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      landedRef.current += 1;
      setPoints(pointsRef.current);
      setStreak(streakRef.current);
      setBestStreak(bestStreakRef.current);
      setLanded(landedRef.current);
      note(accuracy > 0.9 ? `witnessed · +${earned}` : `landed · +${earned}`);
      audio.catchCue();
      flightFromRef.current = markerRef.current;
      flightToRef.current = center;
      flightStartRef.current = performance.now();
      goto("flying");
      return;
    }

    if (offset <= half + SLIP_BAND && gripRef.current > 0) {
      // The lip of the gap: a hand catches. It costs grip, not the run.
      gripRef.current -= 1;
      streakRef.current = 0;
      setGrip(gripRef.current);
      setStreak(0);
      note(`slipped · grip ${gripRef.current}`);
      audio.impact();
      audio.warn();
      shakeRef.current = 10;
      flashRef.current = 0.8;
      chromeRef.current = 1;
      setChrome(1);
      goto("chroming");
      return;
    }

    finish(false);
  }, [audio, finish, goto, note]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "chroming" || phaseRef.current === "aiming") {
      resumeToRef.current = phaseRef.current;
      chromeStartRef.current = 0;
      audio.setWind(0);
      goto("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      goto(resumeToRef.current);
      window.requestAnimationFrame(() => surfaceRef.current?.focus());
    }
  }, [audio, goto]);

  // ---------------------------------------------------------------------
  // One rAF loop: sweep the marker, drift the gap, and paint the convoy.
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

    const advance = (dt: number, now: number) => {
      clockRef.current += dt;
      const spec = VEHICLES[vehicleRef.current];

      if (phaseRef.current === "chroming") {
        if (chromeStartRef.current !== 0) {
          const held = now - chromeStartRef.current;
          // The can meter is mirrored into React on a slow cadence, not every
          // frame — the loop must never drive a re-render per tick.
          if (now - uiClockRef.current > 60) {
            uiClockRef.current = now;
            setChromeHeld(held);
            spawnSpray(2);
          }
          // The can floods rather than hanging: the hold always resolves.
          if (held >= CHROME_MAX_MS) releaseChrome();
        }
        // The boy stands on the near vehicle's deck while the ritual runs —
        // just inside the frame, so the figure is never clipped by the edge.
        markerRef.current = 0.05;
        markerDirRef.current = 1;
        audio.setWind(spec.wind * 2.2);
        return;
      }

      if (phaseRef.current === "aiming") {
        markerRef.current += markerDirRef.current * spec.sweep * dt;
        if (markerRef.current >= 1) {
          markerRef.current = 1;
          markerDirRef.current = -1;
        } else if (markerRef.current <= 0) {
          markerRef.current = 0;
          markerDirRef.current = 1;
        }
        audio.setWind(spec.wind * 3.4);
        return;
      }

      if (phaseRef.current === "flying") {
        if (now - flightStartRef.current < FLIGHT_MS) return;
        // Landed. Two clean crossings and the boy is up onto the next vehicle.
        if (landedRef.current >= LEAPS_PER_VEHICLE) {
          landedRef.current = 0;
          setLanded(0);
          const next = vehicleRef.current + 1;
          vehicleRef.current = next;
          setVehicle(next);
          if (next >= VEHICLES.length) {
            finish(true);
            return;
          }
          audio.fanfare();
          note(`up onto ${VEHICLES[next].label}`);
        }
        chromeRef.current = 1;
        setChrome(1);
        setChromeHeld(0);
        goto("chroming");
      }
    };

    const draw = (now: number) => {
      if (now - paletteSampledAt > 400) {
        paletteSampledAt = now;
        palette = getLiveThemePalette();
      }
      const spec = VEHICLES[Math.min(vehicleRef.current, VEHICLES.length - 1)];
      const t = clockRef.current;
      const live = phaseRef.current === "chroming" || phaseRef.current === "aiming";
      const center = live
        ? 0.5 + Math.sin(t * 0.9) * spec.wind + Math.sin(t * 0.31) * spec.wind * 0.6
        : frozenGapRef.current.center;
      const half = live
        ? spec.gapHalf * (0.84 + 0.16 * Math.sin(t * spec.sway))
        : frozenGapRef.current.half;

      context.save();
      const shake = shakeRef.current;
      if (shake > 0.1) {
        context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      context.fillStyle = palette.inkSoft;
      context.fillRect(-40, -40, width + 80, height + 80);

      // Wind streaks: density tracks the vehicle's crosswind, so the hardest
      // gaps also look the windiest.
      context.strokeStyle = acc(0.12);
      context.lineWidth = 1;
      context.beginPath();
      const streaks = 6 + Math.round(spec.wind * 60);
      for (let i = 0; i < streaks; i += 1) {
        const y = ((i * 53) % height) + Math.sin(t * 2 + i) * 3;
        const x = ((t * 260 * (0.6 + (i % 3) * 0.3) + i * 90) % (width + 200)) - 100;
        context.moveTo(width - x, y);
        context.lineTo(width - x - 30 - spec.wind * 200, y);
      }
      context.stroke();

      const roadY = height * 0.58;
      const bodyH = height * 0.2;

      // The two vehicles, in profile, with the gap between them. The gap moves
      // with the wind and breathes with the sway — the target, drawn literally.
      const gapLeft = (center - half) * width;
      const gapRight = (center + half) * width;
      const drawVehicle = (from: number, to: number, bounce: number) => {
        if (to - from < 6) return;
        context.fillStyle = acc(0.4);
        context.fillRect(from, roadY - bodyH + bounce, to - from, bodyH);
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.strokeRect(from, roadY - bodyH + bounce, to - from, bodyH);
        // Wheels.
        context.fillStyle = acc(0.85);
        const wheel = Math.min(14, (to - from) / 5);
        context.fillRect(from + 6, roadY + bounce, wheel, 7);
        context.fillRect(to - 6 - wheel, roadY + bounce, wheel, 7);
      };
      const bounceA = Math.sin(t * spec.sway * 1.3) * 3;
      const bounceB = Math.sin(t * spec.sway * 1.3 + 1.1) * 3;
      drawVehicle(-20, gapLeft, bounceA);
      drawVehicle(gapRight, width + 20, bounceB);

      // The gap itself, lit from below so it reads as the target.
      const slot = context.createLinearGradient(0, roadY - bodyH, 0, roadY + 10);
      slot.addColorStop(0, acc(0));
      slot.addColorStop(1, acc(0.34));
      context.fillStyle = slot;
      context.fillRect(gapLeft, roadY - bodyH, gapRight - gapLeft, bodyH + 10);
      context.strokeStyle = palette.bright;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(gapLeft, roadY - bodyH);
      context.lineTo(gapLeft, roadY + 10);
      context.moveTo(gapRight, roadY - bodyH);
      context.lineTo(gapRight, roadY + 10);
      context.stroke();

      // The war boy: on the pole while chroming, sweeping while aiming, arcing
      // across on a landing.
      let figureX = markerRef.current * width;
      let figureY = roadY - bodyH - 18;
      if (phaseRef.current === "flying") {
        const k = Math.min(1, (now - flightStartRef.current) / FLIGHT_MS);
        figureX = (flightFromRef.current + (flightToRef.current - flightFromRef.current) * k) * width;
        figureY = roadY - bodyH - 18 - Math.sin(k * Math.PI) * height * 0.22;
      }
      context.fillStyle = palette.bright;
      context.beginPath();
      context.arc(figureX, figureY - 8, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = palette.bright;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(figureX, figureY - 3);
      context.lineTo(figureX, figureY + 12);
      // Arms out on the jump, up on the pole otherwise.
      const spread = phaseRef.current === "flying" ? 11 : 6;
      context.moveTo(figureX - spread, figureY + (phaseRef.current === "flying" ? 0 : -6));
      context.lineTo(figureX, figureY + 2);
      context.lineTo(figureX + spread, figureY + (phaseRef.current === "flying" ? 0 : -6));
      context.moveTo(figureX, figureY + 12);
      context.lineTo(figureX - 7, figureY + 22);
      context.moveTo(figureX, figureY + 12);
      context.lineTo(figureX + 7, figureY + 22);
      context.stroke();

      // The aim track under the scene: where the marker is against the gap.
      const trackY = height - 16;
      context.strokeStyle = acc(0.3);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, trackY);
      context.lineTo(width, trackY);
      context.stroke();
      context.fillStyle = acc(0.3);
      context.fillRect(gapLeft, trackY - 6, gapRight - gapLeft, 12);
      context.fillStyle = palette.bright;
      context.fillRect(markerRef.current * width - 1.5, trackY - 9, 3, 18);

      // Chrome spray, drifting off the can while the ritual runs.
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.03;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        context.fillStyle = withAlpha(palette.bright, particle.life * 0.8);
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
        const live =
          phaseRef.current === "chroming" ||
          phaseRef.current === "aiming" ||
          phaseRef.current === "flying";
        if (live) {
          const dt = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 0;
          lastRef.current = now;
          if (dt > 0) advance(dt, now);
        } else {
          lastRef.current = now;
        }
        settledFrames = live ? 0 : settledFrames + 1;
        if (live || settledFrames < 40) {
          shakeRef.current *= 0.86;
          flashRef.current *= 0.9;
          draw(now);
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
  }, [audio, finish, goto, note, releaseChrome, spawnSpray]);

  // Silence the wind whenever the run is not actually live.
  useEffect(() => {
    if (phase !== "chroming" && phase !== "aiming") audio.setWind(0);
  }, [phase, audio]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === "p") {
        event.preventDefault();
        togglePause();
        return;
      }
      if (key !== " " && key !== "Enter") return;
      event.preventDefault();
      if (event.repeat) return;
      if (phaseRef.current === "chroming") beginChrome();
      else if (phaseRef.current === "aiming") leap();
    },
    [beginChrome, leap, togglePause]
  );

  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      releaseChrome();
    },
    [releaseChrome]
  );

  const spec = VEHICLES[Math.min(vehicle, VEHICLES.length - 1)];
  const rating = useMemo(() => witnessRating(vehicle, bestStreak), [vehicle, bestStreak]);
  const chromeFraction = Math.min(1, chromeHeld / CHROME_MAX_MS);
  const peakFraction = spec.chromePeak / CHROME_MAX_MS;

  const status = useMemo(() => {
    if (phase === "witnessed")
      return `The whole convoy, crossed. ${rating.grade} — ${rating.note} ${banked} points banked.`;
    if (phase === "fallen") return `Under the wheels. ${rating.grade} — ${rating.note} ${banked} points banked.`;
    if (phase === "paused") return "Held. The convoy is frozen mid-run.";
    if (phase === "flying") return "Across — reaching for the rail.";
    if (phase === "aiming") return "The gap drifts with the wind. Leap when the mark crosses it.";
    return `${spec.label}. Hold the can — release near the mark for a full coat.`;
  }, [phase, rating, banked, spec.label]);

  const over = phase === "fallen" || phase === "witnessed";

  return (
    <div
      data-sim-state={phase}
      data-witness-mode="leap"
      data-witness-vehicle={vehicle + 1}
      data-witness-landed={landed}
      data-witness-streak={streak}
      data-witness-grip={grip}
      data-witness-points={points}
      data-witness-score={banked}
      className="flex flex-col gap-3"
      {...rootProps}
    >
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="vehicle" value={`${Math.min(vehicle + 1, VEHICLES.length)}/${VEHICLES.length}`} width="w-8" />
        <FuryRoadStat label="streak" value={streak} width="w-6" pulseKey={streak} />
        <FuryRoadStat label="points" value={points} width="w-12" pulseKey={points} />
        <FuryRoadPips label="grip" value={grip} max={GRIP_MAX} />
        <span className="ml-auto flex gap-2">
          {(phase === "chroming" || phase === "aiming" || phase === "paused") && (
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
        aria-label="Chrome up and leap. Hold space or enter to spray the chrome, release near the mark, then press again to leap when the marker crosses the gap. P to pause."
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={(event) => {
          event.preventDefault();
          if (phaseRef.current === "chroming") beginChrome();
          else if (phaseRef.current === "aiming") leap();
          surfaceRef.current?.focus();
        }}
        onPointerUp={releaseChrome}
        onPointerCancel={releaseChrome}
        onPointerLeave={releaseChrome}
        style={{ touchAction: "none" }}
        className="relative h-52 overflow-hidden border border-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-72"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {showHelp && phase === "chroming" && (
          <p
            aria-hidden
            className="fr-anim-rise pointer-events-none absolute inset-x-0 bottom-8 text-center text-[10px] uppercase tracking-[0.18em] text-white/70"
          >
            hold to chrome · release near the mark · press to leap
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
              {phase === "witnessed" ? "witnessed" : "mediocre"}
            </p>
          </div>
        )}
      </div>

      {/* The chrome can: the hold meter, with the perfect coat marked on it. */}
      <div className="relative">
        <FuryRoadMeter
          label="Chrome"
          value={chromeFraction}
          note={phase === "chroming" && chromeHeld > 0 ? "spraying" : chromeNote(chrome)}
          danger={chromeFraction > 0.92}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-bright"
          style={{ left: `${peakFraction * 100}%` }}
        />
      </div>

      {/* Controls: the field takes hold-and-tap directly, but the two beats also
          get their own buttons so the game is playable without a drag surface. */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "chroming" && (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              beginChrome();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              releaseChrome();
            }}
            onPointerLeave={releaseChrome}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            style={{ touchAction: "none" }}
            className="border border-accent/40 px-5 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            {chromeHeld > 0 ? "Spraying…" : "Chrome up"}
          </button>
        )}
        {phase === "aiming" && (
          // Fired on click, and only for a press that began after this phase
          // did: the release of the chrome hold lands a trailing click right
          // here, and taking it would spend the leap the player never made.
          <button
            type="button"
            onClick={() => {
              if (freshPress()) leap();
            }}
            className="border border-accent/40 px-5 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            Leap
          </button>
        )}
        {over && (
          <button
            ref={actionRef}
            type="button"
            onClick={() => {
              if (freshPress()) arm();
            }}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Chrome up again
          </button>
        )}
      </div>

      {over && (
        <div className="fr-anim-rise border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            {phase === "witnessed" ? "Historic" : "Run over"} · {rating.grade}
          </p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Vehicles crossed — {vehicle}</li>
            <li>Best streak — {bestStreak}</li>
            <li>Leap points — {points}</li>
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
