"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
  BRACE_DRAIN,
  BRACE_REGAIN,
  DODGE_POINTS,
  GRIT_MAX,
  HAZARD_LABEL,
  HULL_MAX,
  LANE_NAMES,
  STORM_LANES,
  STORM_SCORE_ID,
  STORM_WAVES,
  dustDensity,
  stormRating,
  stormRunScore,
  stormWaveAt,
  type HazardKind,
} from "@/components/film-experience/simulations/FuryRoadStormFront";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";

/**
 * The gauntlet: five lanes through the front, three hazards that announce
 * themselves differently, and a dust curtain that thickens as the run goes on.
 *
 * Fairness is the whole design here. Hazards are always painted over the dust,
 * never behind it — the storm hides the road, never the warning — and the spawn
 * rule refuses to claim the last open lane, so there is always somewhere to be.
 * The brace is the counterweight: hold it and a hit costs nothing, but the rig
 * cannot change lanes while braced and grit runs out, so it buys you out of the
 * hazard you misread rather than out of the game.
 */

const RIG_ROW = 0.82;
const LANE_SHIFT = 0.16; // seconds a lane change takes to visibly slide
const INVULN = 0.6;
const MAX_PARTICLES = 90;
const MAX_STEP = 0.05;

type Phase = "running" | "paused" | "struck";

type Hazard = {
  id: number;
  kind: HazardKind;
  /** Lane the telegraph starts in. */
  from: number;
  /** Lane it actually lands in — a whirl drifts, so these differ. */
  to: number;
  born: number;
  strike: number;
  settled: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

export default function FuryRoadStormRun({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [phase, setPhase] = useState<Phase>("running");
  const [seconds, setSeconds] = useState(0);
  const [wave, setWave] = useState(1);
  const [hull, setHull] = useState(HULL_MAX);
  const [grit, setGrit] = useState(GRIT_MAX);
  const [dodges, setDodges] = useState(0);
  const [lane, setLane] = useState(2);
  const [bracing, setBracing] = useState(false);
  const [banked, setBanked] = useState(0);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [waveBanner, setWaveBanner] = useState<{ id: number; label: string } | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("running");
  const laneRef = useRef(2);
  const laneVisualRef = useRef(2);
  const hullRef = useRef(HULL_MAX);
  const gritRef = useRef(GRIT_MAX);
  const dodgesRef = useRef(0);
  const secondsRef = useRef(0);
  const waveRef = useRef(1);
  const hazardsRef = useRef<Hazard[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const nextIdRef = useRef(1);
  const sinceSpawnRef = useRef(0);
  const invulnRef = useRef(0);
  const bracingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const lastRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const uiClockRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const note = useCallback((text: string) => {
    setFloatNote({ id: performance.now(), text });
  }, []);

  const arm = useCallback(() => {
    laneRef.current = 2;
    laneVisualRef.current = 2;
    hullRef.current = HULL_MAX;
    gritRef.current = GRIT_MAX;
    dodgesRef.current = 0;
    secondsRef.current = 0;
    waveRef.current = 1;
    hazardsRef.current = [];
    particlesRef.current = [];
    sinceSpawnRef.current = 0;
    invulnRef.current = 0;
    bracingRef.current = false;
    keysRef.current.clear();
    lastRef.current = 0;
    shakeRef.current = 0;
    flashRef.current = 0;
    setSeconds(0);
    setWave(1);
    setHull(HULL_MAX);
    setGrit(GRIT_MAX);
    setDodges(0);
    setLane(2);
    setBracing(false);
    setBanked(0);
    setFloatNote(null);
    setWaveBanner(null);
    phaseRef.current = "running";
    setPhase("running");
    window.requestAnimationFrame(() => surfaceRef.current?.focus());
  }, []);

  useEffect(() => {
    arm();
  }, [arm]);

  const moveTo = useCallback(
    (next: number) => {
      if (phaseRef.current !== "running") return;
      if (bracingRef.current) {
        note("braced — no room to swerve");
        return;
      }
      const clamped = Math.min(STORM_LANES - 1, Math.max(0, next));
      if (clamped === laneRef.current) return;
      laneRef.current = clamped;
      setLane(clamped);
      audio.tick(clamped);
    },
    [audio, note]
  );

  const strike = useCallback(() => {
    audio.setWind(0);
    audio.fail();
    shakeRef.current = 20;
    flashRef.current = 1;
    const total = stormRunScore(secondsRef.current, dodgesRef.current, waveRef.current);
    setBanked(total);
    recordSimulationScore(STORM_SCORE_ID, total);
    phaseRef.current = "struck";
    setPhase("struck");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      audio.setWind(0);
      bracingRef.current = false;
      keysRef.current.clear();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      phaseRef.current = "running";
      setPhase("running");
      window.requestAnimationFrame(() => surfaceRef.current?.focus());
    }
  }, [audio]);

  // ---------------------------------------------------------------------
  // One rAF loop: spawn, resolve, and paint the front.
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
    const laneCenter = (index: number) => (index + 0.5) * (width / STORM_LANES);

    const braceHeld = () =>
      bracingRef.current ||
      keysRef.current.has("ArrowDown") ||
      keysRef.current.has("s") ||
      keysRef.current.has(" ") ||
      keysRef.current.has("Shift");

    /** Every lane an active hazard will end up claiming, plus a whirl's path. */
    const claimed = () => {
      const set = new Set<number>();
      for (const hazard of hazardsRef.current) {
        set.add(hazard.to);
        if (hazard.kind === "whirl") set.add(hazard.from);
      }
      return set;
    };

    const spawn = (now: number) => {
      const spec = STORM_WAVES[Math.min(waveRef.current, STORM_WAVES.length) - 1];
      const taken = claimed();
      const open = [];
      for (let i = 0; i < STORM_LANES; i += 1) if (!taken.has(i)) open.push(i);
      // The safe-lane guarantee: a new hazard may never claim the last free
      // lane. A whirl claims two, so it needs three free to be allowed at all.
      const kind = spec.kinds[Math.floor(Math.random() * spec.kinds.length)];
      const needs = kind === "whirl" ? 2 : 1;
      if (open.length <= needs) return;

      const from = open[Math.floor(Math.random() * open.length)];
      let to = from;
      if (kind === "whirl") {
        // A whirl drifts one lane, and only into a lane that is still free.
        const drifts = [from - 1, from + 1].filter(
          (candidate) => candidate >= 0 && candidate < STORM_LANES && !taken.has(candidate)
        );
        if (drifts.length === 0) return;
        to = drifts[Math.floor(Math.random() * drifts.length)];
      }
      hazardsRef.current.push({
        id: nextIdRef.current++,
        kind,
        from,
        to,
        born: now,
        strike: now + spec.telegraph,
        settled: false,
      });
    };

    const spawnBurst = (count: number, atLane: number) => {
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: laneCenter(atLane),
          y: RIG_ROW * height,
          vx: Math.cos(angle) * (0.6 + Math.random() * 3),
          vy: Math.sin(angle) * (0.6 + Math.random() * 3),
          life: 1,
        });
      }
    };

    const advance = (dt: number, now: number) => {
      secondsRef.current += dt;
      invulnRef.current = Math.max(0, invulnRef.current - dt);

      const nextWave = stormWaveAt(secondsRef.current);
      if (nextWave !== waveRef.current) {
        waveRef.current = nextWave;
        setWave(nextWave);
        setWaveBanner({
          id: performance.now(),
          label: STORM_WAVES[Math.min(nextWave, STORM_WAVES.length) - 1].label,
        });
        audio.fanfare();
      }

      // Bracing: a hit costs nothing, but the rig is pinned and grit runs out.
      const wantsBrace = braceHeld() && gritRef.current > 0;
      if (wantsBrace !== bracingRef.current) {
        bracingRef.current = wantsBrace;
        setBracing(wantsBrace);
      }
      gritRef.current = wantsBrace
        ? Math.max(0, gritRef.current - BRACE_DRAIN * dt)
        : Math.min(GRIT_MAX, gritRef.current + BRACE_REGAIN * dt);

      // The rig slides between lanes rather than teleporting.
      const target = laneRef.current;
      const delta = target - laneVisualRef.current;
      laneVisualRef.current += delta * Math.min(1, dt / LANE_SHIFT);

      const spec = STORM_WAVES[Math.min(waveRef.current, STORM_WAVES.length) - 1];
      sinceSpawnRef.current += dt * 1000;
      if (sinceSpawnRef.current >= spec.spawnMs) {
        sinceSpawnRef.current = 0;
        spawn(now);
      }

      const survivors: Hazard[] = [];
      for (const hazard of hazardsRef.current) {
        if (now < hazard.strike) {
          survivors.push(hazard);
          continue;
        }
        if (hazard.settled) continue;
        hazard.settled = true;
        const caught = hazard.to === laneRef.current;
        if (!caught) {
          dodgesRef.current += 1;
          setDodges(dodgesRef.current);
          audio.nearMiss();
          continue;
        }
        if (bracingRef.current) {
          // Braced through it: the rig takes the hit on the plates.
          shakeRef.current = Math.min(14, shakeRef.current + 10);
          flashRef.current = 0.7;
          audio.impact();
          note(`braced through the ${HAZARD_LABEL[hazard.kind]}`);
          spawnBurst(10, hazard.to);
          continue;
        }
        if (invulnRef.current > 0) continue;
        invulnRef.current = INVULN;
        hullRef.current -= 1;
        shakeRef.current = 16;
        flashRef.current = 1;
        audio.impact();
        spawnBurst(18, hazard.to);
        if (hullRef.current <= 0) {
          hullRef.current = 0;
          strike();
          return;
        }
        audio.warn();
        note(`${HAZARD_LABEL[hazard.kind]} · hull ${hullRef.current}`);
      }
      hazardsRef.current = survivors;

      audio.setWind(0.3 + Math.min(0.7, dustDensity(secondsRef.current, waveRef.current) * 1.6));
    };

    const drawHazard = (hazard: Hazard, now: number) => {
      const progress = Math.min(1, (now - hazard.born) / (hazard.strike - hazard.born));
      const laneWidth = width / STORM_LANES;
      // A whirl slides from its origin lane to its landing lane as it winds up,
      // so the safe lane visibly moves while the player is looking at it.
      const at = hazard.kind === "whirl" ? hazard.from + (hazard.to - hazard.from) * progress : hazard.to;
      const x = (at + 0.5) * laneWidth;

      if (hazard.kind === "bolt") {
        // A charged column that brightens, then a jagged bolt down the lane.
        context.fillStyle = acc(0.08 + progress * 0.34);
        context.fillRect(hazard.to * laneWidth + 2, 0, laneWidth - 4, height);
        context.strokeStyle = progress > 0.55 ? palette.bright : acc(0.5);
        context.lineWidth = progress > 0.55 ? 2.5 : 1;
        context.beginPath();
        context.moveTo(x, 0);
        // A fixed zigzag seeded off the hazard id: the bolt flickers in
        // brightness, not in shape, so it never reads as noise.
        for (let y = 0; y < height; y += 16) {
          context.lineTo(x + Math.sin(y * 0.31 + hazard.id) * 11 * progress, y);
        }
        context.stroke();
        return;
      }

      if (hazard.kind === "debris") {
        // The falling object plus a hard ground marker in the lane it lands in.
        const y = progress * RIG_ROW * height;
        context.strokeStyle = acc(0.45);
        context.lineWidth = 1;
        context.setLineDash([3, 5]);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, RIG_ROW * height);
        context.stroke();
        context.setLineDash([]);
        context.save();
        context.translate(x, y);
        context.rotate(progress * 7);
        context.strokeStyle = palette.bright;
        context.lineWidth = 2.5;
        context.strokeRect(-11, -11, 22, 22);
        context.beginPath();
        context.moveTo(-11, -11);
        context.lineTo(11, 11);
        context.stroke();
        context.restore();
        // The landing ring, tightening as it comes.
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, RIG_ROW * height, 30 * (1 - progress) + 10, 0, Math.PI * 2);
        context.stroke();
        return;
      }

      // A whirl: a funnel drawn as stacked ellipses, plus an arrow for the
      // drift so which way it is going is never a guess.
      context.strokeStyle = progress > 0.6 ? palette.bright : acc(0.6);
      context.lineWidth = 2;
      for (let i = 0; i < 7; i += 1) {
        const k = i / 6;
        const cy = k * height * 0.9;
        const radius = laneWidth * (0.14 + k * 0.34) * (0.6 + progress * 0.4);
        context.beginPath();
        context.ellipse(
          x + Math.sin(now / 220 + i) * 5 * progress,
          cy,
          radius,
          radius * 0.32,
          0,
          0,
          Math.PI * 2
        );
        context.stroke();
      }
      if (hazard.to !== hazard.from) {
        const direction = Math.sign(hazard.to - hazard.from);
        const ax = (hazard.to + 0.5) * laneWidth;
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x, height * 0.5);
        context.lineTo(ax, height * 0.5);
        context.lineTo(ax - direction * 8, height * 0.5 - 6);
        context.moveTo(ax, height * 0.5);
        context.lineTo(ax - direction * 8, height * 0.5 + 6);
        context.stroke();
      }
    };

    const draw = (now: number) => {
      if (now - paletteSampledAt > 400) {
        paletteSampledAt = now;
        palette = getLiveThemePalette();
      }

      context.save();
      const shake = shakeRef.current;
      if (shake > 0.1) {
        context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      context.fillStyle = palette.inkSoft;
      context.fillRect(-40, -40, width + 80, height + 80);

      const laneWidth = width / STORM_LANES;

      // Lane dividers, one path.
      context.strokeStyle = acc(0.18);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 1; i < STORM_LANES; i += 1) {
        context.moveTo(i * laneWidth, 0);
        context.lineTo(i * laneWidth, height);
      }
      context.stroke();

      // The dust curtain, drawn UNDER the hazards on purpose: the storm takes
      // the road away, never the warning.
      const dust = dustDensity(secondsRef.current, waveRef.current);
      context.fillStyle = withAlpha(palette.dim, dust);
      context.fillRect(-40, -40, width + 80, height + 80);
      context.strokeStyle = withAlpha(palette.dim, dust * 1.4);
      context.lineWidth = 2;
      context.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const y = ((secondsRef.current * 260 * (0.5 + (i % 4) * 0.2) + i * 61) % (height + 90)) - 45;
        const x = (i * 97) % width;
        context.moveTo(x, y);
        context.lineTo(x + 46, y + 8);
      }
      context.stroke();

      for (const hazard of hazardsRef.current) drawHazard(hazard, now);

      // The rig, mid-slide between lanes, braced or open.
      const rx = (laneVisualRef.current + 0.5) * laneWidth;
      const ry = RIG_ROW * height;
      const rw = laneWidth * 0.5;
      const rh = height * 0.15;
      const blink = invulnRef.current > 0 && Math.floor(secondsRef.current * 12) % 2 === 0;
      context.fillStyle = acc(blink ? 0.3 : 0.78);
      context.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      context.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh);
      context.fillStyle = palette.inkSoft;
      context.fillRect(rx - rw / 2 + 3, ry - rh / 2 + 3, rw - 6, rh * 0.3);
      if (bracingRef.current) {
        // Brace plates: an outer shell, so the state reads on the rig itself.
        context.strokeStyle = palette.bright;
        context.lineWidth = 3;
        context.strokeRect(rx - rw / 2 - 5, ry - rh / 2 - 5, rw + 10, rh + 10);
      }

      // Particles: grit thrown up by a strike.
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.08;
        particle.life -= 0.026;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        context.fillStyle = withAlpha(palette.bright, particle.life);
        context.fillRect(particle.x, particle.y, 2, 2);
      }

      if (flashRef.current > 0.01) {
        context.fillStyle = acc(flashRef.current * 0.34);
        context.fillRect(-40, -40, width + 80, height + 80);
      }

      context.restore();
    };

    let frame = 0;
    let settledFrames = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        const live = phaseRef.current === "running";
        if (live) {
          const dt = lastRef.current ? Math.min(MAX_STEP, (now - lastRef.current) / 1000) : 0;
          lastRef.current = now;
          if (dt > 0) advance(dt, now);
        } else {
          lastRef.current = now;
        }
        settledFrames = live ? 0 : settledFrames + 1;
        if (live || settledFrames < 40) {
          shakeRef.current *= 0.87;
          flashRef.current *= 0.9;
          draw(now);
        }
        if (live && now - uiClockRef.current > 80) {
          uiClockRef.current = now;
          setSeconds(Number(secondsRef.current.toFixed(1)));
          setHull(hullRef.current);
          setGrit(gritRef.current);
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
  }, [audio, note, strike]);

  // Silence the wind whenever the rig is not actually in the storm.
  useEffect(() => {
    if (phase !== "running") audio.setWind(0);
  }, [phase, audio]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      audio.unlock();
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(event.key)) {
        event.preventDefault();
      }
      if (key === "p") {
        togglePause();
        return;
      }
      setShowHelp(false);
      if (!event.repeat) {
        if (key === "ArrowLeft" || key === "a") moveTo(laneRef.current - 1);
        if (key === "ArrowRight" || key === "d") moveTo(laneRef.current + 1);
      }
      keysRef.current.add(key);
    },
    [audio, moveTo, togglePause]
  );

  const onKeyUp = useCallback((event: ReactKeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keysRef.current.delete(key);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      audio.unlock();
      setShowHelp(false);
      surfaceRef.current?.focus();
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return;
      // Tapping a lane drives to it: the most direct touch control there is.
      const fraction = (event.clientX - rect.left) / rect.width;
      moveTo(Math.floor(fraction * STORM_LANES));
    },
    [audio, moveTo]
  );

  const rating = useMemo(() => stormRating(seconds, wave), [seconds, wave]);
  const status = useMemo(() => {
    if (phase === "struck")
      return `The storm took the rig at ${seconds.toFixed(1)}s. ${rating.grade} — ${rating.note} ${banked} points banked.`;
    if (phase === "paused") return "Held. The front is frozen mid-run.";
    if (hull <= 1) return "One plate left. Read the warnings and get out of the lane.";
    if (bracing) return "Braced — the hit will land on the plates, but there is no swerving now.";
    return `${STORM_WAVES[Math.min(wave, STORM_WAVES.length) - 1].label} — read the warning, take an open lane.`;
  }, [phase, seconds, rating, banked, hull, bracing, wave]);

  return (
    <div
      data-sim-state={phase}
      data-storm-mode="run"
      data-storm-time={seconds}
      data-storm-wave={wave}
      data-storm-hull={hull}
      data-storm-grit={Math.round(grit)}
      data-storm-dodges={dodges}
      data-storm-lane={lane}
      data-storm-bracing={bracing ? "yes" : "no"}
      data-storm-score={banked}
      className="flex flex-col gap-3"
    >
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="held" value={`${seconds.toFixed(1)}s`} width="w-12" />
        <FuryRoadStat label="wave" value={`${wave}/${STORM_WAVES.length}`} width="w-8" />
        <FuryRoadStat label="dodges" value={dodges} width="w-6" pulseKey={dodges} />
        <FuryRoadPips label="hull" value={hull} max={HULL_MAX} />
        <span className="ml-auto flex gap-2">
          {(phase === "running" || phase === "paused") && (
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
        aria-label="Drive through the storm. Left and right arrows or A and D to change lane; hold down arrow, S, space, or shift to brace; P to pause. On touch, tap the lane you want."
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={onPointerDown}
        onBlur={() => keysRef.current.clear()}
        style={{ touchAction: "none" }}
        className="relative h-56 overflow-hidden border border-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-80"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {showHelp && phase === "running" && (
          <p
            aria-hidden
            className="fr-anim-rise pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/70"
          >
            warnings come before strikes · brace when there is nowhere to go
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

        {waveBanner && (
          <p
            key={waveBanner.id}
            aria-hidden
            className="fr-anim-banner pointer-events-none absolute inset-0 grid place-items-center text-sm uppercase tracking-[0.3em] text-accent-bright"
          >
            {waveBanner.label}
          </p>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">held</p>
          </div>
        )}

        {phase === "struck" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80">
            <p className="fr-anim-banner border-2 border-accent px-4 py-2 text-sm uppercase tracking-[0.3em] text-accent">
              taken
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <FuryRoadMeter
          label="Grit"
          value={grit / GRIT_MAX}
          note={bracing ? "bracing" : grit <= 28 ? "spent" : "ready"}
          danger={grit <= 28}
        />
        <span className="w-14 shrink-0 text-right text-[10px] uppercase tracking-[0.12em] text-white/45">
          {LANE_NAMES[lane]}
        </span>
      </div>

      {/* Controls: the field takes taps and keys, and these buttons cover
          one-handed play and anyone who cannot tap a precise lane. */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Swerve left"
          disabled={phase !== "running"}
          onClick={() => moveTo(laneRef.current - 1)}
          className="flex-1 border border-accent/30 py-2 text-[10px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          ◀ left
        </button>
        <button
          type="button"
          aria-label="Brace"
          aria-pressed={bracing}
          disabled={phase !== "running"}
          onPointerDown={(event) => {
            event.preventDefault();
            audio.unlock();
            setShowHelp(false);
            bracingRef.current = true;
            setBracing(true);
          }}
          onPointerUp={() => {
            bracingRef.current = false;
            setBracing(false);
          }}
          onPointerLeave={() => {
            bracingRef.current = false;
            setBracing(false);
          }}
          onPointerCancel={() => {
            bracingRef.current = false;
            setBracing(false);
          }}
          style={{ touchAction: "none" }}
          className="flex-1 border border-accent/40 py-2 text-[10px] uppercase tracking-[0.14em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          brace
        </button>
        <button
          type="button"
          aria-label="Swerve right"
          disabled={phase !== "running"}
          onClick={() => moveTo(laneRef.current + 1)}
          className="flex-1 border border-accent/30 py-2 text-[10px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          right ▶
        </button>
      </div>

      {phase === "struck" && (
        <div className="fr-anim-rise border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">{rating.grade}</p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Held — {seconds.toFixed(1)}s</li>
            <li>
              Dodges — {dodges} (+{dodges * DODGE_POINTS})
            </li>
            <li>Wave reached — {wave}</li>
            <li className="text-accent">Banked {banked} points</li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-[11px] normal-case tracking-normal text-white/60">
          {status}
        </p>
        {phase === "struck" && (
          <button
            ref={actionRef}
            type="button"
            onClick={arm}
            className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back into it
          </button>
        )}
      </div>
    </div>
  );
}
