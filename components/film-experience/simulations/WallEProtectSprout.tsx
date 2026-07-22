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
import { useFreshPress } from "@/lib/useFreshPress";
import {
  WallEChip,
  WallEKeyframes,
  WallEMuteButton,
  WallEReadout,
  useWallEAudio,
} from "@/components/film-experience/simulations/WallEShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// The green thing in the boot, and a scan that will not hurry. Three waves come
// down on it. WALL·E can body-block anything he can reach — that is the cheap
// answer, and it scores — or he can throw a shield over the boot, which stops
// everything and costs a reserve that overheats if you lean on it. Only what
// lands on the sprout itself hurts, so the game is deciding which falling thing
// is actually a problem. Fill the scan with the sprout standing and it locks.

const SCORE_ID = "wall-e-sprout";
const START_HEALTH = 3;
const SPROUT_X = 0.5;
const SPROUT_HALF = 0.06; // what counts as landing on the sprout
const REACH = 0.075; // WALL·E's body-block half-width
const CATCH_Y = 0.6; // the line he intercepts on
const SHIELD_Y = 0.76;
const SHIELD_HALF = 0.15;
const GROUND_Y = 0.9;
const MAX_SHIELD = 100;
const SHIELD_DRAIN = 24; // per second held
const SHIELD_BLOCK = 9; // per deflection
const SHIELD_RECHARGE = 16; // per second down
const SHIELD_REARM = 45; // reserve needed to raise again after an overheat
const MOVE_SPEED = 0.5;
const MEASURED_STEP = 0.6; // seconds the deliberate mode advances per input
const MAX_PARTICLES = 110;

type Phase = "guarding" | "paused" | "wave" | "withered" | "secured";
type Kind = "bolt" | "spark" | "homer";
type Hazard = { x: number; y: number; vx: number; kind: Kind; id: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };

// Fixed columns rather than a lottery: the first wave never aims at the boot,
// so it teaches the difference between "falling" and "a problem".
const WAVES = [
  {
    label: "first pass",
    scan: 6,
    interval: 1.5,
    speed: 0.3,
    columns: [0.24, 0.72, 0.32, 0.8, 0.2, 0.68],
    kinds: ["bolt"] as Kind[],
  },
  {
    label: "the sweep",
    scan: 8,
    interval: 1.05,
    speed: 0.38,
    columns: [0.5, 0.28, 0.66, 0.5, 0.36, 0.78, 0.5, 0.22],
    kinds: ["bolt", "spark"] as Kind[],
  },
  {
    label: "the last of it",
    scan: 10,
    interval: 0.8,
    speed: 0.46,
    columns: [0.5, 0.44, 0.58, 0.5, 0.3, 0.7, 0.5, 0.5, 0.62],
    kinds: ["bolt", "spark", "homer"] as Kind[],
  },
] as const;

function ProtectSprout() {
  const [phase, setPhase] = useState<Phase>("guarding");
  const [wave, setWave] = useState(0);
  const [health, setHealth] = useState(START_HEALTH);
  const [scan, setScan] = useState(0);
  const [caught, setCaught] = useState(0);
  const [score, setScore] = useState(0);
  const [overheated, setOverheated] = useState(false);
  const [note, setNote] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useWallEAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const shieldBarRef = useRef<HTMLDivElement>(null);
  const shieldTextRef = useRef<HTMLSpanElement>(null);
  const scanBarRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("guarding");
  const waveRef = useRef(0);
  const walleRef = useRef(0.5);
  const moveRef = useRef(0);
  const hazardsRef = useRef<Hazard[]>([]);
  const shieldUpRef = useRef(false);
  const shieldRef = useRef(MAX_SHIELD);
  const overheatRef = useRef(false);
  const healthRef = useRef(START_HEALTH);
  const scanRef = useRef(0);
  const scanShownRef = useRef(0);
  const spawnRef = useRef(0);
  const columnRef = useRef(0);
  const caughtRef = useRef(0);
  const scoreRef = useRef(0);
  const idRef = useRef(0);
  const lastRef = useRef(0);
  const bloomRef = useRef(0);
  const shakeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});
  const reducedRef = useRef(false);
  // Hazard (a): the action button is replaced in place when a wave resolves.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paintMeters = useCallback(() => {
    const shield = Math.max(0, shieldRef.current) / MAX_SHIELD;
    if (shieldBarRef.current) shieldBarRef.current.style.width = `${(shield * 100).toFixed(1)}%`;
    if (shieldTextRef.current) {
      shieldTextRef.current.textContent = overheatRef.current
        ? `${Math.round(shield * 100)}% cooling`
        : `${Math.round(shield * 100)}%`;
    }
    if (scanBarRef.current) {
      const fraction = Math.min(1, scanRef.current / WAVES[waveRef.current].scan);
      scanBarRef.current.style.width = `${(fraction * 100).toFixed(1)}%`;
    }
  }, []);

  /** The scan only reaches React at whole percentage points. */
  const publishScan = useCallback(() => {
    const shown = Math.round(
      Math.min(1, scanRef.current / WAVES[waveRef.current].scan) * 100
    );
    if (shown === scanShownRef.current) return;
    scanShownRef.current = shown;
    setScan(shown);
  }, []);

  const spawnParticles = useCallback(
    (nx: number, ny: number, count: number, upward: boolean) => {
      if (reducedRef.current) return;
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
          x: nx,
          y: ny,
          vx: (Math.random() - 0.5) * 3,
          vy: upward ? -0.8 - Math.random() * 2.4 : Math.random() * 1.6,
          life: 1,
        });
      }
    },
    []
  );

  const startWave = useCallback(
    (index: number) => {
      waveRef.current = index;
      hazardsRef.current = [];
      walleRef.current = 0.5;
      moveRef.current = 0;
      shieldUpRef.current = false;
      shieldRef.current = MAX_SHIELD;
      overheatRef.current = false;
      scanRef.current = 0;
      scanShownRef.current = 0;
      spawnRef.current = 0;
      columnRef.current = 0;
      lastRef.current = 0;
      paintMeters();
      setOverheated(false);
      setScan(0);
      setWave(index);
      phaseRef.current = "guarding";
      setPhase("guarding");
    },
    [paintMeters]
  );

  const restart = useCallback(() => {
    healthRef.current = START_HEALTH;
    caughtRef.current = 0;
    scoreRef.current = 0;
    particlesRef.current = [];
    bloomRef.current = 0;
    setHealth(START_HEALTH);
    setCaught(0);
    setScore(0);
    setNote(null);
    startWave(0);
  }, [startWave]);

  useEffect(() => {
    restart();
  }, [restart]);

  const endRun = useCallback(
    (outcome: "withered" | "secured") => {
      moveRef.current = 0;
      shieldUpRef.current = false;
      audio.stopDrone();
      if (outcome === "secured") {
        bloomRef.current = performance.now();
        audio.win();
      } else {
        shakeRef.current = performance.now();
        audio.fail();
      }
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const clearWave = useCallback(() => {
    const bonus = 400 * (waveRef.current + 1) + healthRef.current * 150;
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `wave held +${bonus}`, good: true });
    if (waveRef.current + 1 >= WAVES.length) {
      endRun("secured");
      return;
    }
    audio.clear();
    moveRef.current = 0;
    shieldUpRef.current = false;
    phaseRef.current = "wave";
    setPhase("wave");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio, endRun]);

  /** One simulation step. The deliberate mode calls it with a fixed `dt`. */
  const tick = useCallback(
    (dt: number) => {
      const spec = WAVES[waveRef.current];
      const canvas = canvasRef.current;
      const width = canvas?.offsetWidth ?? 320;
      const height = canvas?.offsetHeight ?? 240;

      walleRef.current = Math.min(
        0.88,
        Math.max(0.12, walleRef.current + moveRef.current * MOVE_SPEED * dt)
      );

      // The shield reserve. Holding it is the expensive answer.
      if (shieldUpRef.current && !overheatRef.current) {
        shieldRef.current -= SHIELD_DRAIN * dt;
        if (shieldRef.current <= 0) {
          shieldRef.current = 0;
          overheatRef.current = true;
          shieldUpRef.current = false;
          setOverheated(true);
          audio.wrong();
          setNote({ id: performance.now(), text: "shield overheated", good: false });
        }
      } else {
        shieldRef.current = Math.min(MAX_SHIELD, shieldRef.current + SHIELD_RECHARGE * dt);
        if (overheatRef.current && shieldRef.current >= SHIELD_REARM) {
          overheatRef.current = false;
          setOverheated(false);
        }
      }

      // Spawns walk a fixed column list, so a wave is a pattern to learn.
      spawnRef.current += dt;
      if (spawnRef.current >= spec.interval) {
        spawnRef.current = 0;
        const column = spec.columns[columnRef.current % spec.columns.length];
        const kind = spec.kinds[columnRef.current % spec.kinds.length];
        columnRef.current += 1;
        idRef.current += 1;
        hazardsRef.current.push({
          id: idRef.current,
          x: column,
          y: 0,
          vx: kind === "spark" ? (column < 0.5 ? 0.06 : -0.06) : 0,
          kind,
        });
      }

      const survivors: Hazard[] = [];
      for (const hazard of hazardsRef.current) {
        const before = hazard.y;
        // The homer leans toward the boot; the rest fall as thrown.
        if (hazard.kind === "homer") {
          hazard.x += Math.sign(SPROUT_X - hazard.x) * 0.09 * dt;
        } else {
          hazard.x += hazard.vx * dt;
        }
        hazard.y += spec.speed * dt;

        // WALL·E's reach: a body-block, and the cheap way to keep the reserve.
        if (before < CATCH_Y && hazard.y >= CATCH_Y) {
          if (Math.abs(hazard.x - walleRef.current) <= REACH) {
            caughtRef.current += 1;
            scoreRef.current += 120;
            setCaught(caughtRef.current);
            setScore(scoreRef.current);
            audio.chirp(caughtRef.current);
            setNote({ id: performance.now(), text: "+120 caught", good: true });
            spawnParticles(hazard.x * width, CATCH_Y * height, 8, true);
            continue;
          }
        }

        // The dome: it stops everything above the boot, and it costs.
        if (before < SHIELD_Y && hazard.y >= SHIELD_Y) {
          if (
            shieldUpRef.current &&
            !overheatRef.current &&
            Math.abs(hazard.x - SPROUT_X) <= SHIELD_HALF
          ) {
            shieldRef.current = Math.max(0, shieldRef.current - SHIELD_BLOCK);
            scoreRef.current += 80;
            setScore(scoreRef.current);
            audio.thunk();
            spawnParticles(hazard.x * width, SHIELD_Y * height, 6, true);
            continue;
          }
        }

        // Ground. Only what lands on the sprout itself is a problem.
        if (hazard.y >= GROUND_Y) {
          if (Math.abs(hazard.x - SPROUT_X) <= SPROUT_HALF) {
            healthRef.current = Math.max(0, healthRef.current - 1);
            setHealth(healthRef.current);
            shakeRef.current = performance.now();
            audio.wrong();
            setNote({ id: performance.now(), text: "the sprout took it", good: false });
            spawnParticles(SPROUT_X * width, GROUND_Y * height, 10, false);
            if (healthRef.current <= 0) {
              endRun("withered");
              return;
            }
          } else {
            spawnParticles(hazard.x * width, GROUND_Y * height, 3, false);
          }
          continue;
        }
        survivors.push(hazard);
      }
      hazardsRef.current = survivors;

      scanRef.current += dt;
      publishScan();
      paintMeters();
      // A hair of tolerance: ten 0.6s beats do not sum to exactly 6.
      if (scanRef.current >= spec.scan - 1e-6) clearWave();
    },
    [audio, clearWave, endRun, paintMeters, publishScan, spawnParticles]
  );

  /** In the deliberate mode every input is also one beat of the world. */
  const step = useCallback(() => {
    if (phaseRef.current !== "guarding") return;
    tick(MEASURED_STEP);
    drawRef.current(performance.now());
  }, [tick]);

  const move = useCallback(
    (dir: number) => {
      if (phaseRef.current !== "guarding") return;
      audio.unlock();
      if (reducedRef.current) {
        walleRef.current = Math.min(0.88, Math.max(0.12, walleRef.current + dir * 0.08));
        step();
        return;
      }
      moveRef.current = dir;
    },
    [audio, step]
  );

  const release = useCallback(() => {
    moveRef.current = 0;
  }, []);

  const shield = useCallback(
    (up: boolean) => {
      if (phaseRef.current !== "guarding") return;
      audio.unlock();
      if (overheatRef.current) {
        if (up) {
          audio.wrong();
          setNote({ id: performance.now(), text: "reserve still cooling", good: false });
        }
        return;
      }
      if (reducedRef.current) {
        // A toggle, not a hold: one press raises or drops it, and time moves.
        shieldUpRef.current = !shieldUpRef.current;
        audio.tone({ freq: shieldUpRef.current ? 620 : 320, duration: 0.09, gain: 0.4 });
        step();
        return;
      }
      if (shieldUpRef.current === up) return;
      shieldUpRef.current = up;
      if (up) audio.tone({ freq: 620, slideTo: 880, duration: 0.09, gain: 0.4 });
    },
    [audio, step]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "guarding") {
      moveRef.current = 0;
      shieldUpRef.current = false;
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      phaseRef.current = "guarding";
      setPhase("guarding");
    }
  }, [audio]);

  useEffect(() => {
    const dirOf = (key: string) =>
      key === "ArrowLeft" || key === "a" || key === "A"
        ? -1
        : key === "ArrowRight" || key === "d" || key === "D"
          ? 1
          : 0;
    const onDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;
        event.preventDefault();
        if (event.repeat) return;
        shield(true);
        return;
      }
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePause();
        return;
      }
      const dir = dirOf(event.key);
      if (!dir) return;
      event.preventDefault();
      if (event.repeat && !reducedMotion) return;
      move(dir);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;
        event.preventDefault();
        if (!reducedMotion) shield(false);
        return;
      }
      if (!dirOf(event.key)) return;
      event.preventDefault();
      release();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [move, reducedMotion, release, shield, togglePause]);

  // The plot: sky, hazards, WALL·E, the dome, the boot, and the sprout that
  // grows a leaf for every wave it survives.
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
      // One palette read per frame; the strokes below all reuse it.
      const palette = getLiveThemePalette();
      const reduced = reducedRef.current;
      const spec = WAVES[waveRef.current];

      const shake =
        !reduced && shakeRef.current > 0 && now - shakeRef.current < 420
          ? (Math.random() - 0.5) * 8 * (1 - (now - shakeRef.current) / 420)
          : 0;

      context.save();
      context.translate(shake, 0);
      context.fillStyle = palette.inkSoft;
      context.fillRect(-10, 0, width + 20, height);

      // A dust sky that thickens with the wave.
      if (!reduced) {
        context.fillStyle = accentAlpha(0.05 + waveRef.current * 0.015);
        for (let i = 0; i < 26; i += 1) {
          const dx = ((i * 149 + now / 22) % (width + 40)) - 20;
          const dy = (i * 83) % Math.max(1, Math.round(height * GROUND_Y));
          context.fillRect(dx, dy, 2, 1);
        }
      }

      // Ground.
      const groundY = GROUND_Y * height;
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, groundY);
      context.lineTo(width, groundY);
      context.stroke();

      // The reach line WALL·E patrols, so interception is a visible rule.
      context.strokeStyle = accentAlpha(0.12);
      context.setLineDash([4, 6]);
      context.beginPath();
      context.moveTo(0, CATCH_Y * height);
      context.lineTo(width, CATCH_Y * height);
      context.stroke();
      context.setLineDash([]);

      // Falling things, drawn by kind so the threat is not colour alone.
      for (const hazard of hazardsRef.current) {
        const hx = hazard.x * width;
        const hy = hazard.y * height;
        const threat = Math.abs(hazard.x - SPROUT_X) <= SPROUT_HALF;
        context.strokeStyle = threat ? palette.bright : accentAlpha(0.5);
        context.lineWidth = threat ? 2 : 1;
        context.beginPath();
        if (hazard.kind === "bolt") {
          context.moveTo(hx, hy - 5);
          context.lineTo(hx, hy + 5);
          context.moveTo(hx - 3, hy + 2);
          context.lineTo(hx, hy + 6);
          context.lineTo(hx + 3, hy + 2);
        } else if (hazard.kind === "spark") {
          for (let i = 0; i < 3; i += 1) {
            const a = (i * Math.PI * 2) / 3 + (reduced ? 0 : now / 300);
            context.moveTo(hx, hy);
            context.lineTo(hx + Math.cos(a) * 6, hy + Math.sin(a) * 6);
          }
        } else {
          context.arc(hx, hy, 5, 0, Math.PI * 2);
          context.moveTo(hx - 7, hy);
          context.lineTo(hx + 7, hy);
        }
        context.stroke();
        // The homer trails a line toward what it wants.
        if (hazard.kind === "homer") {
          context.strokeStyle = accentAlpha(0.16);
          context.beginPath();
          context.moveTo(hx, hy);
          context.lineTo(SPROUT_X * width, groundY);
          context.stroke();
        }
      }
      context.lineWidth = 1;

      // WALL·E on his treads, arms out to the width of his reach.
      const wx = walleRef.current * width;
      const wy = CATCH_Y * height;
      context.strokeStyle = palette.bright;
      context.lineWidth = 1.6;
      context.strokeRect(wx - 9, wy - 8, 18, 15);
      context.beginPath();
      context.moveTo(wx - 9, wy - 8);
      context.lineTo(wx - 13, wy - 13);
      context.moveTo(wx + 9, wy - 8);
      context.lineTo(wx + 13, wy - 13);
      context.stroke();
      context.beginPath();
      context.arc(wx - 5, wy - 12, 3, 0, Math.PI * 2);
      context.arc(wx + 5, wy - 12, 3, 0, Math.PI * 2);
      context.stroke();
      // Arms spanning the block width.
      context.strokeStyle = accentAlpha(0.6);
      context.beginPath();
      context.moveTo(wx - REACH * width, wy + 2);
      context.lineTo(wx + REACH * width, wy + 2);
      context.stroke();
      context.lineWidth = 1;

      // The dome over the boot: solid while held, a ghost while cooling.
      const domeUp = shieldUpRef.current && !overheatRef.current;
      const reserve = Math.max(0, shieldRef.current) / MAX_SHIELD;
      context.strokeStyle = domeUp
        ? palette.bright
        : accentAlpha(overheatRef.current ? 0.1 : 0.2);
      context.lineWidth = domeUp ? 2 : 1;
      if (!domeUp) context.setLineDash([3, 4]);
      context.beginPath();
      context.ellipse(
        SPROUT_X * width,
        SHIELD_Y * height + 14,
        SHIELD_HALF * width,
        26,
        0,
        Math.PI,
        Math.PI * 2
      );
      context.stroke();
      context.setLineDash([]);
      context.lineWidth = 1;
      if (domeUp) {
        context.fillStyle = accentAlpha(0.06 + reserve * 0.08);
        context.fill();
      }

      // The boot, and the sprout — it puts out a leaf for every wave survived.
      const bx = SPROUT_X * width;
      context.strokeStyle = accentAlpha(0.5);
      context.strokeRect(bx - 11, groundY - 4, 22, height - groundY - 2);
      const alive = healthRef.current > 0;
      const growth =
        waveRef.current + Math.min(1, scanRef.current / spec.scan) + (bloomRef.current ? 1 : 0);
      const stem = 10 + growth * 5;
      context.strokeStyle = alive ? palette.bright : accentAlpha(0.18);
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(bx, groundY - 4);
      context.lineTo(bx, groundY - 4 - stem);
      context.stroke();
      const leaves = Math.max(1, Math.min(4, Math.round(growth) + 1));
      for (let i = 0; i < leaves; i += 1) {
        const ly = groundY - 6 - (i + 1) * (stem / (leaves + 1));
        const side = i % 2 === 0 ? -1 : 1;
        const sway = reduced ? 0 : Math.sin(now / 700 + i) * 1.6;
        context.beginPath();
        context.moveTo(bx, ly);
        context.quadraticCurveTo(
          bx + side * 6,
          ly - 5 + sway,
          bx + side * 11,
          ly - 1 + sway
        );
        context.stroke();
      }
      context.lineWidth = 1;

      // Health as pips, so remaining life is not a colour.
      for (let i = 0; i < START_HEALTH; i += 1) {
        context.strokeStyle = accentAlpha(i < healthRef.current ? 0.85 : 0.2);
        context.strokeRect(10 + i * 9, height - 14, 6, 6);
      }

      // The bloom: rings and petals when the scan locks.
      if (bloomRef.current > 0) {
        const t = reduced ? 1 : Math.min(1.6, (now - bloomRef.current) / 900);
        for (let ring = 0; ring < 3; ring += 1) {
          const rt = Math.max(0, t - ring * 0.22);
          if (rt <= 0 || rt > 1.4) continue;
          context.strokeStyle = accentAlpha(0.5 * Math.max(0, 1 - rt / 1.4));
          context.lineWidth = 2;
          context.beginPath();
          context.arc(bx, groundY - 12, rt * width * 0.42, 0, Math.PI * 2);
          context.stroke();
        }
        context.lineWidth = 1;
      }

      // Debris spray and bloom petals.
      if (!reduced) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.11;
          p.life -= 0.026;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(p.life * 0.65);
          context.fillRect(p.x, p.y, 2, 2);
        }
      }

      // Overheat wash: the frame reads hot while the reserve is unusable.
      if (overheatRef.current) {
        context.fillStyle = accentAlpha(reduced ? 0.1 : 0.06 + 0.05 * Math.abs(Math.sin(now / 260)));
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    };
    drawRef.current = draw;

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const last = lastRef.current || now;
        const dt = Math.min(0.05, (now - last) / 1000);
        lastRef.current = now;
        if (phaseRef.current === "guarding") tick(dt);
        draw(now);
      } else {
        lastRef.current = 0;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, tick]);

  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, phase, wave, health, scan]);

  // Damage shake, restarted imperatively so the canvas element survives.
  useEffect(() => {
    if (health === START_HEALTH || reducedMotion) return;
    const node = fieldRef.current;
    if (!node) return;
    node.classList.remove("walle-shake");
    void node.offsetWidth;
    node.classList.add("walle-shake");
  }, [health, reducedMotion]);

  // The scanner's carrier tone while a wave runs.
  useEffect(() => {
    if (phase !== "guarding" || audio.muted || reducedMotion) return;
    audio.startDrone(44 + wave * 6, "sine");
    return () => audio.stopDrone();
  }, [audio, phase, reducedMotion, wave]);

  const spec = WAVES[wave];
  const running = phase === "guarding";

  const status = useMemo(() => {
    if (phase === "withered")
      return `The sprout didn't make it through ${spec.label}. ${score} points.`;
    if (phase === "secured")
      return `Scan locked. The directive is complete — ${caught} intercepted, ${score} points.`;
    if (phase === "wave") return `${spec.label} held. ${score} points, ${health} life left.`;
    if (phase === "paused") return "Scan held.";
    if (overheated) return "Reserve overheated — body-block until it cools.";
    if (reducedMotion)
      return `Deliberate watch: every input moves the world one beat. Scan ${scan}% of ${spec.label}.`;
    return `Only what lands on the boot hurts. Catch what you can reach; save the dome for the rest.`;
  }, [caught, health, overheated, phase, reducedMotion, scan, score, spec]);

  return (
    <div
      data-sim-state={phase}
      data-sprout-wave={wave + 1}
      data-scan={scan}
      data-health={health}
      data-shield={Math.round(Math.max(0, shieldRef.current))}
      data-caught={caught}
      data-sprout-score={score}
      className="flex flex-col gap-3"
      onPointerDownCapture={markPress}
    >
      <WallEKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          wave <span className="text-accent">{wave + 1}</span>/{WAVES.length}
        </span>
        <WallEReadout label="scan" value={`${scan}%`} reducedMotion={reducedMotion} />
        <WallEReadout label="life" value={`${health}/${START_HEALTH}`} reducedMotion={reducedMotion} />
        <WallEReadout label="caught" value={caught} reducedMotion={reducedMotion} />
        <WallEReadout label="score" value={score} reducedMotion={reducedMotion} />
        <span className="flex items-center gap-1.5">
          reserve <span ref={shieldTextRef} className="text-accent">100%</span>
        </span>
        <span className="ml-auto flex gap-2">
          <WallEMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(running || phase === "paused") && (
            <WallEChip onClick={togglePause}>{phase === "paused" ? "resume" : "pause"}</WallEChip>
          )}
        </span>
      </div>

      {/* Scan clock, then the shield reserve under it. */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={scanBarRef} className="h-full bg-accent-bright/80" style={{ width: "0%" }} />
      </div>
      <div className="h-1 w-full bg-white/10" aria-hidden>
        <div ref={shieldBarRef} className="h-full bg-accent/70" style={{ width: "100%" }} />
      </div>

      {/* The plot */}
      <div ref={fieldRef} className="relative" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-56 w-full border border-accent/25 bg-ink/60 sm:h-72"
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-[10px] uppercase tracking-[0.2em] ${
              note.good ? "text-accent-bright" : "text-white/70"
            } ${reducedMotion ? "" : "walle-float"}`}
          >
            {note.text}
          </p>
        )}
        {phase === "secured" && !reducedMotion && (
          <div
            aria-hidden
            className="walle-bloom pointer-events-none absolute inset-0 border border-accent-bright/40"
          />
        )}
        {(phase === "paused" || phase === "wave" || phase === "withered" || phase === "secured") && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 px-4 text-center">
            <div className={reducedMotion ? "" : "walle-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "scan held"
                  : phase === "wave"
                    ? `${spec.label} held`
                    : phase === "withered"
                      ? "the sprout went"
                      : "scan locked"}
              </p>
              {phase !== "paused" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {caught} intercepted
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="min-h-[2.25rem] text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {running || phase === "paused" ? (
          <>
            <button
              type="button"
              onPointerDown={(event) => {
                // The deliberate mode acts on click instead, so a press never
                // counts as two beats of the world.
                if (reducedMotion) return;
                event.preventDefault();
                move(-1);
              }}
              onPointerUp={release}
              onPointerLeave={release}
              onClick={() => {
                if (reducedMotion) move(-1);
              }}
              aria-label="Move WALL·E left"
              style={{ touchAction: "none" }}
              className="walle-press border border-accent/30 px-4 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ← move
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                if (reducedMotion) return;
                event.preventDefault();
                shield(true);
              }}
              onPointerUp={() => {
                if (!reducedMotion) shield(false);
              }}
              onPointerLeave={() => {
                if (!reducedMotion) shield(false);
              }}
              onClick={() => {
                if (reducedMotion) shield(true);
              }}
              onKeyDown={(event: ReactKeyboardEvent) => {
                // Reduced motion leaves the key to the native click, which
                // toggles once; the hold mode needs both edges of the press.
                if (reducedMotion) return;
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                if (event.repeat) return;
                shield(true);
              }}
              onKeyUp={(event: ReactKeyboardEvent) => {
                if (reducedMotion) return;
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                shield(false);
              }}
              aria-label={reducedMotion ? "Toggle the shield" : "Hold the shield over the sprout"}
              style={{ touchAction: "none" }}
              className={`walle-press border px-5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                overheated
                  ? "border-white/20 text-white/40"
                  : "border-accent/60 text-accent-bright hover:bg-accent/15"
              }`}
            >
              {overheated ? "Cooling" : "Shield"}
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                if (reducedMotion) return;
                event.preventDefault();
                move(1);
              }}
              onPointerUp={release}
              onPointerLeave={release}
              onClick={() => {
                if (reducedMotion) move(1);
              }}
              aria-label="Move WALL·E right"
              style={{ touchAction: "none" }}
              className="walle-press border border-accent/30 px-4 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              move →
            </button>
            <span className="max-w-[18rem] text-white/35">
              {reducedMotion
                ? "each input advances the wave one beat · shield toggles"
                : "← → move · hold space for the dome · P holds the scan"}
            </span>
          </>
        ) : phase === "wave" ? (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) startWave(wave + 1);
            }}
          >
            Next wave — {WAVES[Math.min(wave + 1, WAVES.length - 1)].label}
          </WallEChip>
        ) : (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) restart();
            }}
          >
            {phase === "secured" ? "Guard it again" : "Plant it again"}
          </WallEChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function WallEProtectSprout({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="wall-e-sprout-title"
      gameId="wall-e-sprout"
      eyebrow="Directive: protect"
      title="Protect the sprout"
      startLabel="Raise the cover"
      stage
      howToPlay={{
        objective:
          "Keep the sprout standing until the scan fills, through three waves.",
        controls: [
          { keys: "← → / A D", does: "walk WALL·E across the plot" },
          { keys: "Space", does: "hold to raise the dome over the sprout" },
          { keys: "click", does: "the move and shield buttons do the same" },
          { keys: "P", does: "hold the scan" },
        ],
        tip: "Body-blocking a falling piece is free; the dome drains a reserve and overheats if you lean on it. Most of what falls lands nowhere near the boot, so the job is deciding which piece is actually a problem. Under reduced motion the dome is a toggle and each input advances the wave one beat.",
      }}
      reference={{
        quote: "Directive?",
        scene: "WALL·E (2008) · the green thing in the boot",
      }}
      onClose={onClose}
    >
      <ProtectSprout />
    </SimulationShell>
  );
}
