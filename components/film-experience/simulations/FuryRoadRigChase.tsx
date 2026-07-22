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
import { RIG_SCORE_ID, rigRunScore, rigWaveAt, WAVES } from "@/components/film-experience/simulations/FuryRoadRigRoad";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";

/**
 * The chase itself: the rig runs the road while the wasteland comes for it.
 *
 * Nothing here kills on the first touch. The rig carries hull and fuel, and
 * both are spent rather than lost — a ram costs a plate of hull, the boost
 * costs fuel, and dropped canisters buy the fuel back. That makes every hazard
 * a decision (take the hit, or burn fuel to get around it) instead of a coin
 * flip, and it makes a run last long enough for the waves to escalate.
 */

const RIG_W = 0.11;
const RIG_H = 0.13;
const RIG_Y = 0.8;
const RAIL_LEFT = 0.07;
const RAIL_RIGHT = 0.93;

const STEER_ACCEL = 7.5; // how fast lateral velocity answers the controls
const STEER_MAX = 0.62; // field-widths per second at full lean
const STEER_DRAG = 6.5; // how fast lateral velocity settles hands-off

const BASE_SPEED = 0.62; // field-heights per second at wave one, no boost
const BOOST_MULTIPLIER = 1.8;
const FUEL_MAX = 100;
const FUEL_BURN = 2.6; // per second cruising
const FUEL_BOOST_BURN = 13; // per second on the boost
const FUEL_PICKUP = 26;
const HULL_MAX = 3;
const RAM_COST = 1;
const INVULN = 1.15; // seconds of grace after a hit, so one ram is not three
const NEAR_BAND = 0.055; // lateral clearance that counts as a squeak
const NEAR_MISS_POINTS = 25;
const MAX_PARTICLES = 110;
const MAX_STEP = 0.05; // longest sim step, so a stalled tab never teleports

type Phase = "running" | "paused" | "wrecked";
type Kind = "wreck" | "interceptor" | "buzzard" | "fuel";

type Entity = {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  /** Set once the entity has been scored as a squeak or a hit. */
  settled: boolean;
  spin: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hot: boolean };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FuryRoadRigChase({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [phase, setPhase] = useState<Phase>("running");
  const [distance, setDistance] = useState(0);
  const [wave, setWave] = useState(1);
  const [fuel, setFuel] = useState(FUEL_MAX);
  const [hull, setHull] = useState(HULL_MAX);
  const [squeaks, setSqueaks] = useState(0);
  const [boosting, setBoosting] = useState(false);
  const [banked, setBanked] = useState(0);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [waveBanner, setWaveBanner] = useState<{ id: number; label: string } | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  const [endReason, setEndReason] = useState<"rammed" | "dry">("rammed");

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // Live sim state lives in refs: the rAF loop must never re-render React.
  const keysRef = useRef<Set<string>>(new Set());
  const pointerLateralRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const rigXRef = useRef(0.5);
  const rigVXRef = useRef(0);
  const distRef = useRef(0);
  const fuelRef = useRef(FUEL_MAX);
  const hullRef = useRef(HULL_MAX);
  const squeaksRef = useRef(0);
  const waveRef = useRef(1);
  const invulnRef = useRef(0);
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const nextIdRef = useRef(1);
  const sinceSpawnRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const dashRef = useRef(0);
  const phaseRef = useRef<Phase>("running");
  const uiClockRef = useRef(0);
  const boostingRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const note = useCallback((text: string) => {
    setFloatNote({ id: performance.now(), text });
  }, []);

  const arm = useCallback(() => {
    rigXRef.current = 0.5;
    rigVXRef.current = 0;
    distRef.current = 0;
    fuelRef.current = FUEL_MAX;
    hullRef.current = HULL_MAX;
    squeaksRef.current = 0;
    waveRef.current = 1;
    invulnRef.current = 0;
    entitiesRef.current = [];
    particlesRef.current = [];
    sinceSpawnRef.current = 0;
    clockRef.current = 0;
    lastRef.current = 0;
    shakeRef.current = 0;
    flashRef.current = 0;
    keysRef.current.clear();
    pointerDownRef.current = false;
    pointerLateralRef.current = null;
    boostingRef.current = false;
    setDistance(0);
    setWave(1);
    setFuel(FUEL_MAX);
    setHull(HULL_MAX);
    setSqueaks(0);
    setBoosting(false);
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

  const spawnBurst = useCallback((count: number, spread: number, hot: boolean, atX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles = particlesRef.current;
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * spread;
      particles.push({
        x: atX * canvas.width,
        y: RIG_Y * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hot,
      });
    }
  }, []);

  const wreck = useCallback(
    (reason: "rammed" | "dry") => {
      audio.setEngine(0);
      audio.fail();
      shakeRef.current = 18;
      flashRef.current = 1;
      const total = rigRunScore(distRef.current, squeaksRef.current, waveRef.current);
      setBanked(total);
      recordSimulationScore(RIG_SCORE_ID, total);
      setEndReason(reason);
      phaseRef.current = "wrecked";
      setPhase("wrecked");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      audio.setEngine(0);
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
  // The road: one rAF loop owns simulation and painting alike.
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

    const boostHeld = () =>
      pointerDownRef.current ||
      keysRef.current.has("ArrowUp") ||
      keysRef.current.has("w") ||
      keysRef.current.has(" ") ||
      keysRef.current.has("Shift");

    /** -1..1 lean: keys win when held, otherwise the pointer steers. */
    const steerInput = () => {
      let dir = 0;
      if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a")) dir -= 1;
      if (keysRef.current.has("ArrowRight") || keysRef.current.has("d")) dir += 1;
      if (dir !== 0) return dir;
      const target = pointerLateralRef.current;
      if (target === null) return 0;
      return clamp((target - rigXRef.current) * 7, -1, 1);
    };

    const spawn = () => {
      const wave = WAVES[Math.min(waveRef.current, WAVES.length) - 1];
      const roll = Math.random();
      const id = nextIdRef.current++;
      // Fuel canisters arrive on their own cadence so the boost is sustainable.
      if (roll < wave.fuelChance) {
        entitiesRef.current.push({
          id,
          kind: "fuel",
          x: RAIL_LEFT + 0.06 + Math.random() * (RAIL_RIGHT - RAIL_LEFT - 0.12),
          y: -0.12,
          w: 0.05,
          h: 0.06,
          vx: 0,
          settled: false,
          spin: 0,
        });
        return;
      }
      if (roll < wave.fuelChance + wave.buzzardChance) {
        // A buzzard hangs back and flanks: it tracks the rig laterally.
        entitiesRef.current.push({
          id,
          kind: "buzzard",
          x: Math.random() < 0.5 ? RAIL_LEFT + 0.05 : RAIL_RIGHT - 0.05,
          y: -0.16,
          w: 0.085,
          h: 0.1,
          vx: 0,
          settled: false,
          spin: 0,
        });
        return;
      }
      if (roll < wave.fuelChance + wave.buzzardChance + wave.interceptorChance) {
        // An interceptor cuts across the road on a fixed line.
        const fromLeft = Math.random() < 0.5;
        entitiesRef.current.push({
          id,
          kind: "interceptor",
          x: fromLeft ? RAIL_LEFT + 0.02 : RAIL_RIGHT - 0.02,
          y: -0.14,
          w: 0.09,
          h: 0.09,
          vx: (fromLeft ? 1 : -1) * (0.16 + Math.random() * 0.14),
          settled: false,
          spin: 0,
        });
        return;
      }
      entitiesRef.current.push({
        id,
        kind: "wreck",
        x: RAIL_LEFT + 0.05 + Math.random() * (RAIL_RIGHT - RAIL_LEFT - 0.1),
        y: -0.14,
        w: 0.07 + Math.random() * 0.07,
        h: 0.08,
        vx: 0,
        settled: false,
        spin: Math.random() * Math.PI,
      });
    };

    const takeHit = (entity: Entity) => {
      if (invulnRef.current > 0) return;
      invulnRef.current = INVULN;
      hullRef.current -= RAM_COST;
      shakeRef.current = Math.min(16, shakeRef.current + 12);
      flashRef.current = 1;
      spawnBurst(16, 3.2, true, rigXRef.current);
      audio.impact();
      // A ram shoves the rig sideways and knocks the wind out of the run.
      rigVXRef.current += entity.x > rigXRef.current ? -0.35 : 0.35;
      if (hullRef.current <= 0) {
        hullRef.current = 0;
        wreck("rammed");
        return;
      }
      note(`rammed · hull ${hullRef.current}`);
      audio.warn();
    };

    const advance = (dt: number) => {
      clockRef.current += dt;
      invulnRef.current = Math.max(0, invulnRef.current - dt);

      const waveIndex = Math.min(waveRef.current, WAVES.length) - 1;
      const wave = WAVES[waveIndex];

      // Boost: a real decision — speed and score for fuel you may need later.
      const wantsBoost = boostHeld() && fuelRef.current > 0;
      if (wantsBoost !== boostingRef.current) {
        boostingRef.current = wantsBoost;
        setBoosting(wantsBoost);
      }
      const speed = BASE_SPEED * wave.speed * (wantsBoost ? BOOST_MULTIPLIER : 1);

      fuelRef.current = Math.max(
        0,
        fuelRef.current - (wantsBoost ? FUEL_BOOST_BURN : FUEL_BURN) * dt
      );
      if (fuelRef.current <= 0) {
        wreck("dry");
        return;
      }

      // Steering with weight, so the rig leans and settles rather than snapping.
      const lean = steerInput();
      const desired = lean * STEER_MAX;
      const ease = lean === 0 ? STEER_DRAG : STEER_ACCEL;
      rigVXRef.current += (desired - rigVXRef.current) * Math.min(1, ease * dt);
      rigXRef.current += rigVXRef.current * dt;
      // The rails are solid: grinding them bleeds speed rather than ending the run.
      const minX = RAIL_LEFT + RIG_W / 2;
      const maxX = RAIL_RIGHT - RIG_W / 2;
      if (rigXRef.current < minX || rigXRef.current > maxX) {
        rigXRef.current = clamp(rigXRef.current, minX, maxX);
        rigVXRef.current *= -0.2;
        if (Math.random() < 0.3) spawnBurst(2, 1.4, false, rigXRef.current);
      }

      distRef.current += speed * dt * 58;
      dashRef.current += speed * dt * height;

      const nextWave = rigWaveAt(distRef.current);
      if (nextWave !== waveRef.current) {
        waveRef.current = nextWave;
        setWave(nextWave);
        setWaveBanner({ id: performance.now(), label: WAVES[Math.min(nextWave, WAVES.length) - 1].label });
        audio.fanfare();
      }

      // Spawning tightens with the wave.
      sinceSpawnRef.current += dt * 1000;
      if (sinceSpawnRef.current >= wave.spawnMs && entitiesRef.current.length < wave.maxOnRoad) {
        sinceSpawnRef.current = 0;
        spawn();
      }

      const rigX = rigXRef.current;
      const survivors: Entity[] = [];
      for (const entity of entitiesRef.current) {
        // Buzzards close slowly and flank; everything else rides the road down.
        const closing = entity.kind === "buzzard" ? speed * 0.42 : speed;
        entity.y += closing * dt;
        if (entity.kind === "buzzard") {
          const chase = clamp((rigX - entity.x) * wave.flank, -0.5, 0.5);
          entity.x += chase * dt;
        } else if (entity.kind === "interceptor") {
          entity.x += entity.vx * dt;
          if (entity.x < RAIL_LEFT + entity.w / 2 || entity.x > RAIL_RIGHT - entity.w / 2) {
            entity.x = clamp(entity.x, RAIL_LEFT + entity.w / 2, RAIL_RIGHT - entity.w / 2);
            entity.vx *= -1;
          }
        }
        entity.spin += dt * 2;

        const overlapY = Math.abs(entity.y - RIG_Y) < (entity.h + RIG_H) / 2;
        const dx = Math.abs(entity.x - rigX);
        const overlapX = dx < (entity.w + RIG_W) / 2;

        if (overlapY && overlapX && !entity.settled) {
          entity.settled = true;
          if (entity.kind === "fuel") {
            fuelRef.current = Math.min(FUEL_MAX, fuelRef.current + FUEL_PICKUP);
            audio.catchCue();
            note(`fuel +${FUEL_PICKUP}`);
            spawnBurst(8, 2, false, entity.x);
            continue; // consumed
          }
          takeHit(entity);
          if (phaseRef.current === "wrecked") return;
          continue; // the hazard is spent in the collision
        }

        // A squeak: it went past the rig row close enough to hear the paint.
        if (!entity.settled && entity.kind !== "fuel" && entity.y > RIG_Y + RIG_H / 2) {
          entity.settled = true;
          if (dx < (entity.w + RIG_W) / 2 + NEAR_BAND) {
            squeaksRef.current += 1;
            setSqueaks(squeaksRef.current);
            audio.nearMiss();
            note(`squeaked past · +${NEAR_MISS_POINTS}`);
            spawnBurst(4, 1.6, false, entity.x);
          }
        }

        if (entity.y < 1.25) survivors.push(entity);
      }
      entitiesRef.current = survivors;

      audio.setEngine(wantsBoost ? 1 : 0.42 + wave.speed * 0.12);
    };

    // -------------------------------------------------------------------
    // Painting. The live grade is sampled on a slow cadence and every alpha
    // derived from that sample, so no frame forces a style recalculation.
    // -------------------------------------------------------------------
    let palette = getLiveThemePalette();
    let paletteSampledAt = 0;
    const acc = (alpha: number) => withAlpha(palette.accent, alpha);

    const drawEntity = (entity: Entity) => {
      const ex = entity.x * width;
      const ey = entity.y * height;
      const ew = entity.w * width;
      const eh = entity.h * height;
      if (entity.kind === "fuel") {
        // A canister: a bright outline with a fill bar, so it never reads as a hazard.
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.strokeRect(ex - ew / 2, ey - eh / 2, ew, eh);
        context.fillStyle = acc(0.55);
        context.fillRect(ex - ew / 2 + 3, ey + eh / 2 - 6, ew - 6, 3);
        context.beginPath();
        context.moveTo(ex - ew * 0.2, ey - eh / 2);
        context.lineTo(ex + ew * 0.2, ey - eh / 2);
        context.stroke();
        return;
      }
      if (entity.kind === "wreck") {
        // A burnt hulk: filled body with a cross-brace, tilted on its axle.
        context.save();
        context.translate(ex, ey);
        context.rotate(Math.sin(entity.spin) * 0.12);
        context.fillStyle = acc(0.32);
        context.fillRect(-ew / 2, -eh / 2, ew, eh);
        context.strokeStyle = acc(0.85);
        context.lineWidth = 1.5;
        context.strokeRect(-ew / 2, -eh / 2, ew, eh);
        context.beginPath();
        context.moveTo(-ew / 2, -eh / 2);
        context.lineTo(ew / 2, eh / 2);
        context.moveTo(ew / 2, -eh / 2);
        context.lineTo(-ew / 2, eh / 2);
        context.stroke();
        context.restore();
        return;
      }
      // Pursuit vehicles: a body, a windscreen, and wheels. The buzzard leans
      // into its flank so the direction it is closing from reads at a glance.
      const lean = entity.kind === "buzzard" ? clamp((rigXRef.current - entity.x) * 1.6, -0.4, 0.4) : entity.vx * 1.4;
      context.save();
      context.translate(ex, ey);
      context.rotate(lean);
      context.fillStyle = acc(entity.kind === "buzzard" ? 0.62 : 0.48);
      context.fillRect(-ew / 2, -eh / 2, ew, eh);
      context.strokeStyle = palette.bright;
      context.lineWidth = 1.5;
      context.strokeRect(-ew / 2, -eh / 2, ew, eh);
      context.fillStyle = palette.inkSoft;
      context.fillRect(-ew / 2 + 3, -eh / 2 + 3, ew - 6, eh * 0.3);
      // Wheels.
      context.fillStyle = acc(0.9);
      context.fillRect(-ew / 2 - 3, -eh * 0.3, 3, eh * 0.24);
      context.fillRect(ew / 2, -eh * 0.3, 3, eh * 0.24);
      context.fillRect(-ew / 2 - 3, eh * 0.08, 3, eh * 0.24);
      context.fillRect(ew / 2, eh * 0.08, 3, eh * 0.24);
      if (entity.kind === "buzzard") {
        // Spikes: the buzzard is the one that means to hit you.
        context.strokeStyle = palette.bright;
        context.beginPath();
        for (let i = -1; i <= 1; i += 1) {
          context.moveTo(i * ew * 0.3, eh / 2);
          context.lineTo(i * ew * 0.3, eh / 2 + 6);
        }
        context.stroke();
      }
      context.restore();
    };

    const draw = (now: number) => {
      if (now - paletteSampledAt > 400) {
        paletteSampledAt = now;
        palette = getLiveThemePalette();
      }
      const speedish = boostingRef.current ? 1 : 0.55;

      context.save();
      const shake = shakeRef.current;
      if (shake > 0.1) {
        context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      context.fillStyle = palette.inkSoft;
      context.fillRect(-40, -40, width + 80, height + 80);

      // The road surface: sand streaks flowing past, batched into one path.
      context.strokeStyle = acc(0.08);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 0; i < 14; i += 1) {
        const x = RAIL_LEFT * width + ((i * 37) % ((RAIL_RIGHT - RAIL_LEFT) * width));
        const y = ((dashRef.current * (0.6 + (i % 3) * 0.2) + i * 90) % (height + 120)) - 60;
        context.moveTo(x, y);
        context.lineTo(x, y + 26 + speedish * 30);
      }
      context.stroke();

      // Rails.
      context.strokeStyle = acc(0.4);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(RAIL_LEFT * width, 0);
      context.lineTo(RAIL_LEFT * width, height);
      context.moveTo(RAIL_RIGHT * width, 0);
      context.lineTo(RAIL_RIGHT * width, height);
      context.stroke();

      // Centre dashes, one path for the lot.
      context.strokeStyle = acc(0.22);
      context.lineWidth = 3;
      context.beginPath();
      for (let y = -40 + (dashRef.current % 46); y < height; y += 46) {
        context.moveTo(width / 2, y);
        context.lineTo(width / 2, y + 22);
      }
      context.stroke();

      for (const entity of entitiesRef.current) drawEntity(entity);

      // The war rig: cab, tanker, wheels, and a plume that lengthens with speed.
      const rx = rigXRef.current * width;
      const ry = RIG_Y * height;
      const rw = RIG_W * width;
      const rh = RIG_H * height;
      const tilt = clamp(rigVXRef.current * 0.5, -0.28, 0.28);
      context.save();
      context.translate(rx, ry);
      context.rotate(tilt);
      // Exhaust plume behind the rig.
      const plume = context.createLinearGradient(0, rh / 2, 0, rh / 2 + 40 + speedish * 50);
      plume.addColorStop(0, acc(0.34));
      plume.addColorStop(1, acc(0));
      context.fillStyle = plume;
      context.fillRect(-rw * 0.34, rh / 2, rw * 0.68, 40 + speedish * 50);
      // Tanker body.
      context.fillStyle = acc(invulnRef.current > 0 && Math.floor(clockRef.current * 12) % 2 === 0 ? 0.3 : 0.75);
      context.fillRect(-rw / 2, -rh / 2, rw, rh);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      context.strokeRect(-rw / 2, -rh / 2, rw, rh);
      // Cab and windscreen.
      context.fillStyle = palette.bright;
      context.fillRect(-rw / 2 + 2, -rh / 2 - rh * 0.18, rw - 4, rh * 0.2);
      context.fillStyle = palette.inkSoft;
      context.fillRect(-rw / 2 + 5, -rh / 2 - rh * 0.14, rw - 10, rh * 0.1);
      // Tanker ribs.
      context.strokeStyle = palette.inkSoft;
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 1; i < 4; i += 1) {
        const y = -rh / 2 + (i * rh) / 4;
        context.moveTo(-rw / 2, y);
        context.lineTo(rw / 2, y);
      }
      context.stroke();
      // Wheels.
      context.fillStyle = acc(0.95);
      for (const y of [-rh * 0.34, rh * 0.06, rh * 0.3]) {
        context.fillRect(-rw / 2 - 4, y, 4, rh * 0.18);
        context.fillRect(rw / 2, y, 4, rh * 0.18);
      }
      context.restore();

      // Speed lines: the strongest read of velocity, only while boosting hard.
      if (speedish > 0.8) {
        context.strokeStyle = acc(0.3);
        context.lineWidth = 1;
        context.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const x = RAIL_LEFT * width + Math.random() * (RAIL_RIGHT - RAIL_LEFT) * width;
          const y = Math.random() * height;
          context.moveTo(x, y);
          context.lineTo(x, y + 40);
        }
        context.stroke();
      }

      // Particles: sparks off a ram, grit off the rails.
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
        context.fillStyle = particle.hot
          ? withAlpha(palette.bright, particle.life)
          : acc(particle.life * 0.7);
        context.fillRect(particle.x, particle.y, 2, 2);
      }

      // Contact flash: a full-frame pulse the instant something lands.
      if (flashRef.current > 0.01) {
        context.fillStyle = acc(flashRef.current * 0.32);
        context.fillRect(-40, -40, width + 80, height + 80);
      }

      context.restore();
    };

    let frame = 0;
    // Paused and wrecked are still frames behind an overlay: they get a short
    // tail of paints (so the shake and flash settle) and then stop entirely.
    let settledFrames = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        const live = phaseRef.current === "running";
        if (live) {
          const dt = lastRef.current ? Math.min(MAX_STEP, (now - lastRef.current) / 1000) : 0;
          lastRef.current = now;
          if (dt > 0) advance(dt);
        } else {
          lastRef.current = now;
        }
        settledFrames = live ? 0 : settledFrames + 1;
        if (live || settledFrames < 40) {
          shakeRef.current *= 0.87;
          flashRef.current *= 0.9;
          draw(now);
        }
        // Mirror the sim into React at ~12Hz: enough for a live HUD, far less
        // work than a state write every frame.
        if (live && now - uiClockRef.current > 80) {
          uiClockRef.current = now;
          setDistance(Math.round(distRef.current));
          setFuel(fuelRef.current);
          setHull(hullRef.current);
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
  }, [audio, note, spawnBurst, wreck]);

  // Silence the engine whenever the rig is not actually running.
  useEffect(() => {
    if (phase !== "running") audio.setEngine(0);
  }, [phase, audio]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      audio.unlock();
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
        event.preventDefault();
      }
      if (key === "p") {
        togglePause();
        return;
      }
      setShowHelp(false);
      keysRef.current.add(key);
    },
    [audio, togglePause]
  );

  const onKeyUp = useCallback((event: ReactKeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keysRef.current.delete(key);
  }, []);

  const trackPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    pointerLateralRef.current = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      audio.unlock();
      setShowHelp(false);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerDownRef.current = true;
      trackPointer(event);
      surfaceRef.current?.focus();
    },
    [audio, trackPointer]
  );

  const releasePointer = useCallback(() => {
    pointerDownRef.current = false;
    pointerLateralRef.current = null;
  }, []);

  const fuelNote = fuel <= 22 ? "running dry" : boosting ? "burning" : "steady";
  const status = useMemo(() => {
    if (phase === "wrecked") {
      return endReason === "dry"
        ? `Out of guzzoline at ${distance} m. ${squeaks} squeaks. ${banked} points banked.`
        : `The rig went down at ${distance} m. ${squeaks} squeaks. ${banked} points banked.`;
    }
    if (phase === "paused") return "Held. The road is frozen mid-run.";
    if (hull <= 1) return "One plate left — stop taking rams and find a canister.";
    if (fuel <= 22) return "Guzzoline is low. Ease off the boost or grab a canister.";
    return `${WAVES[Math.min(wave, WAVES.length) - 1].label} — steer to thread it, hold to boost.`;
  }, [phase, endReason, distance, squeaks, banked, hull, fuel, wave]);

  return (
    <div
      data-sim-state={phase}
      data-rig-mode="chase"
      data-rig-distance={distance}
      data-rig-wave={wave}
      data-rig-hull={hull}
      data-rig-fuel={Math.round(fuel)}
      data-rig-squeaks={squeaks}
      data-rig-score={banked}
      className="flex flex-col gap-3"
    >
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="road" value={`${distance} m`} width="w-14" />
        <FuryRoadStat label="wave" value={`${wave}/${WAVES.length}`} width="w-8" />
        <FuryRoadStat label="squeaks" value={squeaks} width="w-6" pulseKey={squeaks} />
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
        aria-label="Drive the war rig. Left and right arrows or A and D to steer; hold up, W, or space to boost; P to pause. On touch, hold anywhere on the road and slide to steer — holding also boosts."
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (pointerDownRef.current) trackPointer(event);
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onPointerLeave={releasePointer}
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
            steer to thread the wrecks · hold to boost
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

        {phase === "wrecked" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80">
            <p className="fr-anim-banner border-2 border-accent px-4 py-2 text-sm uppercase tracking-[0.3em] text-accent">
              {endReason === "dry" ? "out of guzzoline" : "rig down"}
            </p>
          </div>
        )}
      </div>

      {/* Meters */}
      <div className="flex items-center gap-3">
        <FuryRoadMeter
          label="Guzzoline"
          value={fuel / FUEL_MAX}
          note={fuelNote}
          danger={fuel <= 22}
        />
        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-accent">
          {Math.round(fuel)}
        </span>
      </div>

      {/* Controls. The road itself steers by drag, but one always-present row of
          buttons keeps the game workable one-handed, on a keyboard, and for
          anyone who cannot drag. Holding a button is a held control; a plain
          click (keyboard activation, or a tap too quick for the hold to matter)
          still lands a real nudge. */}
      <div className="flex gap-2">
        {(
          [
            { label: "◀ left", key: "ArrowLeft", name: "Steer left", nudge: -0.09 },
            { label: "boost", key: " ", name: "Boost", nudge: 0 },
            { label: "right ▶", key: "ArrowRight", name: "Steer right", nudge: 0.09 },
          ] as const
        ).map((control) => (
          <button
            key={control.key}
            type="button"
            aria-label={control.name}
            disabled={phase !== "running"}
            onPointerDown={(event) => {
              event.preventDefault();
              audio.unlock();
              setShowHelp(false);
              keysRef.current.add(control.key);
            }}
            onPointerUp={() => keysRef.current.delete(control.key)}
            onPointerLeave={() => keysRef.current.delete(control.key)}
            onPointerCancel={() => keysRef.current.delete(control.key)}
            onClick={() => {
              if (control.nudge === 0) return;
              rigXRef.current = clamp(
                rigXRef.current + control.nudge,
                RAIL_LEFT + RIG_W / 2,
                RAIL_RIGHT - RIG_W / 2
              );
            }}
            style={{ touchAction: "none" }}
            className="flex-1 border border-accent/30 py-2 text-[10px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            {control.label}
          </button>
        ))}
      </div>

      {phase === "wrecked" && (
        <div className="fr-anim-rise border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            {endReason === "dry" ? "Dry tank" : "Rig down"} · wave {wave}
          </p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Road held — {distance} m</li>
            <li>
              Squeaks — {squeaks} (+{squeaks * NEAR_MISS_POINTS})
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
        {phase === "wrecked" && (
          <button
            ref={actionRef}
            type="button"
            onClick={arm}
            className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Roll out again
          </button>
        )}
      </div>
    </div>
  );
}
