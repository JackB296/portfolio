"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { useFreshPress } from "@/lib/useFreshPress";
import {
  KEEPSAKES,
  drawKeepsake,
  type KeepsakeKind,
} from "@/components/film-experience/simulations/ParasiteStairsArt";
import {
  BANK_FLOOR,
  BREATH_REFILL,
  CAPACITY,
  CLIMB_SPEED,
  FLOORS,
  LANDING,
  LEVELS,
  LOAD_DRAG,
  MAX_BREATH,
  REACH_FLOOR,
  REACH_X,
  STAIR_X_TOLERANCE,
  STEP_FLOORS,
  STEP_SECONDS,
  STEP_X,
  SWIM_FACTOR,
  VISIBLE_FLOORS,
  WALK_SPEED,
  itemValue,
  stairXBetween,
} from "@/components/film-experience/simulations/ParasiteStairsLevels";
import {
  ParasiteChip,
  ParasiteKeyframes,
  ParasiteMuteButton,
  useParasiteAudio,
} from "@/components/film-experience/simulations/ParasiteShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * A flooding house on one long night, played across two axes.
 *
 * Down the shaft and along each corridor: the stairwells do not line up, so
 * getting to a keepsake three floors below is a route rather than a held key.
 * The flood starts partway up — some things are already under when you begin —
 * and the only way to them is to dive, on a breath meter. Everything you pick
 * up has a weight as well as a value, so a full back is a slow back, and the
 * heavy, valuable things are exactly the ones that cost you the climb.
 *
 * Geometry, tuning and layouts live in ParasiteStairsLevels.ts; the keepsake
 * vector art lives in ParasiteStairsArt.ts. This file is the loop.
 */

const SCORE_ID = "parasite-stairs";
const MAX_PARTICLES = 120;
/** Corridor inset — 0 on the model maps to this fraction of the canvas width. */
const CORRIDOR_L = 0.09;
const CORRIDOR_W = 0.82;
/** How far ahead the dashed forecast line reads the flood. */
const FORECAST_SECONDS = 3;

type Phase = "running" | "paused" | "landing" | "drowned" | "done";
type Carried = { kind: KeepsakeKind; value: number; weight: number };
type LiveItem = { kind: KeepsakeKind; floor: number; x: number; taken: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

function UpAndDown() {
  const [phase, setPhase] = useState<Phase>("running");
  const [level, setLevel] = useState(0);
  const [banked, setBanked] = useState(0);
  const [carried, setCarried] = useState<Carried[]>([]);
  const [score, setScore] = useState(0);
  const [rescued, setRescued] = useState(0);
  const [onLanding, setOnLanding] = useState(true);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [failReason, setFailReason] = useState<"breath" | "flood" | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useParasiteAudio();

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const breathBarRef = useRef<HTMLDivElement>(null);
  const breathTextRef = useRef<HTMLSpanElement>(null);
  const waterTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // The simulation lives in refs; React only hears about scored events.
  const pxRef = useRef(0.5);
  const pyRef = useRef(LANDING);
  const cameraRef = useRef(LANDING);
  const waterRef = useRef(LEVELS[0].waterStart);
  const breathRef = useRef(MAX_BREATH);
  const inputXRef = useRef(0);
  const inputYRef = useRef(0);
  const targetRef = useRef<{ x: number; floor: number } | null>(null);
  const climbGapRef = useRef<number | null>(null);
  // Seeded with the first descent so the game is playable straight off the
  // mount, without waiting for a startLevel call that only restarts make.
  const itemsRef = useRef<LiveItem[]>(
    LEVELS[0].items.map((item) => ({ ...item, taken: false }))
  );
  const carriedRef = useRef<Carried[]>([]);
  const loadRef = useRef(0);
  const bankedRef = useRef(0);
  const rescuedRef = useRef(0);
  const scoreRef = useRef(0);
  const levelRef = useRef(0);
  const phaseRef = useRef<Phase>("running");
  const onLandingRef = useRef(true);
  const lastRef = useRef(0);
  const splashRef = useRef(-1);
  const shakeRef = useRef(-1);
  const bankFlashRef = useRef(-1);
  const overloadRef = useRef(-1);
  const walkPhaseRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Guard against the trailing click of the gesture that revealed a control:
  // a press only counts if it began after the control appeared. The control can
  // be revealed by a phase change, a landing, or a bank, so key on all three.
  const { freshPress, markPress } = useFreshPress(`${phase}:${onLanding}:${banked}`);
  useEffect(() => {
    const onDown = () => markPress();
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [markPress]);

  const paintMeters = useCallback(() => {
    const fraction = breathRef.current / MAX_BREATH;
    if (breathBarRef.current) {
      breathBarRef.current.style.width = `${(fraction * 100).toFixed(1)}%`;
    }
    if (breathTextRef.current) {
      breathTextRef.current.textContent = `${Math.round(fraction * 100)}%`;
    }
    if (waterTextRef.current) {
      const gap = pyRef.current - waterRef.current;
      waterTextRef.current.textContent =
        gap <= 0 ? "over your head" : `${gap.toFixed(1)} fl below`;
    }
    // Position is written straight onto the root so the hooks track the
    // simulation rather than the last React render.
    const root = rootRef.current;
    if (root) {
      root.dataset.floor = String(Math.round(pyRef.current));
      root.dataset.lane = String(Math.round(pxRef.current * 100));
      root.dataset.submerged = pyRef.current < waterRef.current ? "yes" : "no";
    }
  }, []);

  // Seed the meters and position hooks before the first tick, so reduced
  // motion (which runs no loop) still reports where the figure is standing.
  useEffect(() => {
    paintMeters();
  }, [paintMeters]);

  const spawn = useCallback(
    (x: number, y: number, count: number) => {
      if (reducedMotion) return;
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 2.4,
          vy: -0.6 - Math.random() * 2.2,
          life: 1,
        });
      }
    },
    [reducedMotion]
  );

  const startLevel = useCallback(
    (index: number) => {
      const spec = LEVELS[index];
      levelRef.current = index;
      itemsRef.current = spec.items.map((item) => ({ ...item, taken: false }));
      pxRef.current = 0.5;
      pyRef.current = LANDING;
      cameraRef.current = LANDING - (VISIBLE_FLOORS / 2 - 1.2);
      waterRef.current = spec.waterStart;
      breathRef.current = MAX_BREATH;
      carriedRef.current = [];
      loadRef.current = 0;
      bankedRef.current = 0;
      inputXRef.current = 0;
      inputYRef.current = 0;
      targetRef.current = null;
      climbGapRef.current = null;
      onLandingRef.current = true;
      lastRef.current = performance.now();
      paintMeters();
      setLevel(index);
      setCarried([]);
      setBanked(0);
      setOnLanding(true);
      setFailReason(null);
      phaseRef.current = "running";
      setPhase("running");
    },
    [paintMeters]
  );

  const restart = useCallback(() => {
    scoreRef.current = 0;
    rescuedRef.current = 0;
    particlesRef.current = [];
    setScore(0);
    setRescued(0);
    setNote(null);
    startLevel(0);
  }, [startLevel]);

  const endRun = useCallback(
    (outcome: "drowned" | "done", reason: "breath" | "flood" | null) => {
      inputXRef.current = 0;
      inputYRef.current = 0;
      targetRef.current = null;
      audio.stopDrone();
      if (outcome === "drowned") audio.fail();
      else audio.win();
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      setFailReason(reason);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const clearLevel = useCallback(() => {
    const bonus =
      280 * (levelRef.current + 1) +
      Math.round((breathRef.current / MAX_BREATH) * 200);
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `out in time +${bonus}` });
    audio.clear();
    if (levelRef.current + 1 >= LEVELS.length) {
      endRun("done", null);
      return;
    }
    inputXRef.current = 0;
    inputYRef.current = 0;
    targetRef.current = null;
    phaseRef.current = "landing";
    setPhase("landing");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio, endRun]);

  const bankLoad = useCallback(() => {
    const load = carriedRef.current;
    if (!load.length) return;
    const gained = load.reduce((sum, item) => sum + item.value, 0);
    bankedRef.current += gained;
    scoreRef.current += gained;
    rescuedRef.current += load.length;
    carriedRef.current = [];
    loadRef.current = 0;
    bankFlashRef.current = performance.now();
    setCarried([]);
    setBanked(bankedRef.current);
    setScore(scoreRef.current);
    setRescued(rescuedRef.current);
    setNote({ id: performance.now(), text: `banked +${gained}` });
    audio.ok();
  }, [audio]);

  /**
   * One simulation tick. `dt` is seconds. The reduced-motion mode calls this
   * with a fixed step after each deliberate press instead of running a loop.
   */
  const tick = useCallback(
    (dt: number, deliberate: boolean) => {
      const canvas = canvasRef.current;
      const width = canvas?.offsetWidth ?? 320;
      const height = canvas?.offsetHeight ?? 260;
      const spec = LEVELS[levelRef.current];

      const submergedBefore = pyRef.current < waterRef.current;
      const load = loadRef.current;
      const drag = 1 - LOAD_DRAG * (load / CAPACITY);
      const speedMul = drag * (submergedBefore ? SWIM_FACTOR : 1);

      // --- Intent: keys, or the auto-route that a drag on the shaft asks for.
      let ix = inputXRef.current;
      let iy = inputYRef.current;
      const target = targetRef.current;
      if (target) {
        const df = target.floor - pyRef.current;
        const dx = target.x - pxRef.current;
        if (Math.abs(df) > 0.3) {
          if (submergedBefore) {
            iy = Math.sign(df);
            ix = Math.abs(dx) > 0.04 ? Math.sign(dx) : 0;
          } else if (climbGapRef.current !== null) {
            iy = Math.sign(df);
            ix = 0;
          } else {
            const gap = df > 0 ? Math.round(pyRef.current) : Math.round(pyRef.current) - 1;
            if (gap < 0 || gap > FLOORS - 2) {
              ix = 0;
              iy = 0;
            } else {
              const sx = stairXBetween(gap);
              if (Math.abs(pxRef.current - sx) > STAIR_X_TOLERANCE * 0.5) {
                ix = Math.sign(sx - pxRef.current);
                iy = 0;
              } else {
                ix = 0;
                iy = Math.sign(df);
              }
            }
          }
        } else {
          iy = 0;
          ix = Math.abs(dx) > 0.02 ? Math.sign(dx) : 0;
        }
      }

      // --- Vertical. On the stairs you must be standing on a stairwell; under
      // the surface you swim, which is what makes the dive worth the breath.
      const nearest = Math.round(pyRef.current);
      const settled = Math.abs(pyRef.current - nearest) < 0.04;
      if (settled) climbGapRef.current = null;

      const stepY = deliberate ? STEP_FLOORS : CLIMB_SPEED * speedMul * dt;
      if (iy !== 0) {
        if (submergedBefore || (deliberate && reducedMotion)) {
          // The deliberate mode takes the nearest stairwell for you — the
          // two-axis route stays, the frame-perfect footwork does not.
          pyRef.current = clamp(pyRef.current + iy * stepY, 0, LANDING);
        } else {
          if (climbGapRef.current === null) {
            const gap = iy > 0 ? nearest : nearest - 1;
            if (
              gap >= 0 &&
              gap <= FLOORS - 2 &&
              Math.abs(pxRef.current - stairXBetween(gap)) <= STAIR_X_TOLERANCE
            ) {
              climbGapRef.current = gap;
            }
          }
          const gap = climbGapRef.current;
          if (gap !== null) {
            pyRef.current = clamp(pyRef.current + iy * stepY, gap, gap + 1);
            const sx = stairXBetween(gap);
            pxRef.current += (sx - pxRef.current) * Math.min(1, dt * 12 || 1);
          }
        }
      }

      // --- Lateral. Only along a floor (or anywhere, once swimming).
      // Stepping sideways while halfway up a flight puts you on the nearer
      // landing rather than stranding you on the steps, where walking is not
      // allowed and nothing would respond.
      if (
        ix !== 0 &&
        !submergedBefore &&
        climbGapRef.current !== null &&
        Math.abs(pyRef.current - Math.round(pyRef.current)) >= 0.14
      ) {
        pyRef.current = clamp(
          Math.round(pyRef.current),
          climbGapRef.current,
          climbGapRef.current + 1
        );
        climbGapRef.current = null;
      }
      const onFloorNow = Math.abs(pyRef.current - Math.round(pyRef.current)) < 0.14;
      if (ix !== 0 && (submergedBefore || onFloorNow || (deliberate && reducedMotion))) {
        const stepX = deliberate ? STEP_X : WALK_SPEED * speedMul * dt;
        pxRef.current = clamp(pxRef.current + ix * stepX, 0.03, 0.97);
      }
      if (ix !== 0 || iy !== 0) walkPhaseRef.current += 0.5 + dt * 14;

      // --- The camera trails the climb, clamped inside the shaft.
      const margin = VISIBLE_FLOORS / 2 - 1.2;
      const camTarget = clamp(pyRef.current, margin, LANDING - margin);
      cameraRef.current += (camTarget - cameraRef.current) * Math.min(1, dt * 6 || 1);

      // --- The flood.
      waterRef.current += spec.rise * dt;
      const submerged = pyRef.current < waterRef.current;
      if (!submergedBefore && submerged) {
        splashRef.current = performance.now();
        audio.drip();
        spawn(width * (CORRIDOR_L + pxRef.current * CORRIDOR_W), height / 2, 14);
      }

      if (submerged) {
        breathRef.current = Math.max(0, breathRef.current - dt * 1000);
      } else {
        breathRef.current = Math.min(
          MAX_BREATH,
          breathRef.current + dt * 1000 * BREATH_REFILL
        );
      }

      // --- Picking things up: within reach, and only if there is room on
      // your back. A full load refuses the grab rather than silently failing.
      for (const item of itemsRef.current) {
        if (item.taken) continue;
        if (Math.abs(pyRef.current - item.floor) > REACH_FLOOR) continue;
        if (Math.abs(pxRef.current - item.x) > REACH_X) continue;
        const spec2 = KEEPSAKES[item.kind];
        if (loadRef.current + spec2.weight > CAPACITY) {
          if (performance.now() - overloadRef.current > 900) {
            overloadRef.current = performance.now();
            setNote({ id: performance.now(), text: `${spec2.label} — no room` });
            audio.wrong();
          }
          continue;
        }
        item.taken = true;
        const wasUnder = item.floor < waterRef.current;
        const value = itemValue(item.kind, levelRef.current, wasUnder);
        loadRef.current += spec2.weight;
        carriedRef.current = [
          ...carriedRef.current,
          { kind: item.kind, value, weight: spec2.weight },
        ];
        setCarried(carriedRef.current);
        setNote({
          id: performance.now(),
          text: `${spec2.label} +${value}${wasUnder ? " (dived)" : ""}`,
        });
        audio.blip(carriedRef.current.length);
        spawn(
          width * (CORRIDOR_L + item.x * CORRIDOR_W),
          height / 2 - (item.floor - cameraRef.current) * (height / VISIBLE_FLOORS),
          16
        );
      }

      // --- The landing banks whatever you brought up.
      const atLanding = pyRef.current >= BANK_FLOOR;
      if (atLanding !== onLandingRef.current) {
        onLandingRef.current = atLanding;
        setOnLanding(atLanding);
      }
      if (atLanding && carriedRef.current.length) bankLoad();

      paintMeters();

      // --- Endings. Out of breath ends the run; the flood cresting the
      // landing ends the descent, and whether that is a pass depends on
      // whether the target is already banked.
      if (breathRef.current <= 0) {
        shakeRef.current = performance.now();
        endRun("drowned", "breath");
        return;
      }
      if (waterRef.current >= LANDING - 0.15) {
        shakeRef.current = performance.now();
        if (bankedRef.current >= spec.target) clearLevel();
        else endRun("drowned", "flood");
      }
    },
    [audio, bankLoad, clearLevel, endRun, paintMeters, reducedMotion, spawn]
  );

  /** One deliberate move — the reduced-motion mode's whole vocabulary. */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (phaseRef.current !== "running") return;
      audio.unlock();
      audio.startDrone(44 + levelRef.current * 7, "sine");
      inputXRef.current = dx;
      inputYRef.current = dy;
      tick(STEP_SECONDS, true);
      inputXRef.current = 0;
      inputYRef.current = 0;
      drawRef.current(performance.now());
    },
    [audio, tick]
  );

  const hold = useCallback(
    (dx: number, dy: number) => {
      if (phaseRef.current !== "running") return;
      audio.unlock();
      audio.startDrone(44 + levelRef.current * 7, "sine");
      if (reducedMotion) {
        nudge(dx, dy);
        return;
      }
      targetRef.current = null;
      if (dx !== 0) inputXRef.current = dx;
      if (dy !== 0) inputYRef.current = dy;
    },
    [audio, nudge, reducedMotion]
  );

  const release = useCallback((axis: "x" | "y") => {
    if (axis === "x") inputXRef.current = 0;
    else inputYRef.current = 0;
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      inputXRef.current = 0;
      inputYRef.current = 0;
      targetRef.current = null;
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "running";
      setPhase("running");
    }
  }, [audio]);

  // Keyboard: both axes, hold-to-move. Reduced motion turns each press into a
  // single deliberate step instead.
  useEffect(() => {
    const axisOf = (key: string): [number, number] | null => {
      switch (key) {
        case "ArrowUp":
        case "w":
        case "W":
          return [0, 1];
        case "ArrowDown":
        case "s":
        case "S":
          return [0, -1];
        case "ArrowLeft":
        case "a":
        case "A":
          return [-1, 0];
        case "ArrowRight":
        case "d":
        case "D":
          return [1, 0];
        default:
          return null;
      }
    };
    const onDown = (event: KeyboardEvent) => {
      const axis = axisOf(event.key);
      if (!axis) return;
      event.preventDefault();
      if (event.repeat && !reducedMotion) return;
      hold(axis[0], axis[1]);
    };
    const onUp = (event: KeyboardEvent) => {
      const axis = axisOf(event.key);
      if (!axis) return;
      event.preventDefault();
      release(axis[0] !== 0 ? "x" : "y");
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [hold, release, reducedMotion]);

  // The shaft: parallax city, corridors, stairwells, keepsakes, the flood and
  // its forecast line, the figure, and the load riding on its back.
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
      const palette = getLiveThemePalette();
      const perFloor = height / VISIBLE_FLOORS;
      const camera = cameraRef.current;
      const yOf = (floor: number) => height / 2 - (floor - camera) * perFloor;
      const xOf = (nx: number) => width * (CORRIDOR_L + nx * CORRIDOR_W);

      const shake =
        !reducedMotion && shakeRef.current > 0 && now - shakeRef.current < 460
          ? (Math.random() - 0.5) * 7 * (1 - (now - shakeRef.current) / 460)
          : 0;

      context.save();
      context.translate(shake, 0);
      context.fillStyle = palette.inkSoft;
      context.fillRect(-10, 0, width + 20, height);

      // Far layer: the city outside, drifting at a fraction of the climb.
      const farOffset = camera * perFloor * 0.22;
      context.fillStyle = accentAlpha(0.11);
      for (let i = 0; i < 44; i += 1) {
        const wx = ((i * 67) % Math.max(1, Math.round(width))) + 3;
        const wy = (((i * 149) % (height * 2)) + farOffset) % (height * 2);
        context.fillRect(wx, wy - height * 0.5, 3, 4);
      }

      // The light at the top of the house, fading as you go down.
      const glow = context.createLinearGradient(0, 0, 0, height);
      glow.addColorStop(0, accentAlpha(Math.max(0, 0.18 - camera * 0.006)));
      glow.addColorStop(1, accentAlpha(0));
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      // Corridors, one per floor, with the landing drawn heaviest.
      context.font = "8px monospace";
      for (let floor = 0; floor < FLOORS; floor += 1) {
        const y = yOf(floor);
        if (y < -perFloor || y > height + perFloor) continue;
        const isLanding = floor === LANDING;
        const brightness = 0.1 + (floor / FLOORS) * 0.26;
        context.strokeStyle = accentAlpha(isLanding ? 0.65 : brightness);
        context.lineWidth = isLanding ? 2 : 1;
        context.beginPath();
        context.moveTo(xOf(0) - 6, y);
        context.lineTo(xOf(1) + 6, y);
        context.stroke();
        context.save();
        context.textAlign = "right";
        context.fillStyle = accentAlpha(brightness + 0.34);
        context.fillText(
          isLanding ? "landing" : floor === 0 ? "B" : `${floor}`,
          width - 4,
          y - 3
        );
        context.restore();
      }

      // Stairwells: the zigzag that makes the route a route. Drawn brightly so
      // the way down is never a guess.
      for (let gap = 0; gap < FLOORS - 1; gap += 1) {
        const sx = xOf(stairXBetween(gap));
        const yTop = yOf(gap + 1);
        const yBottom = yOf(gap);
        if (yTop > height + 20 || yBottom < -20) continue;
        context.strokeStyle = accentAlpha(0.34);
        context.lineWidth = 1;
        const treads = 5;
        for (let i = 0; i <= treads; i += 1) {
          const t = i / treads;
          const ty = yBottom + (yTop - yBottom) * t;
          const tx = sx - 9 + t * 18;
          context.beginPath();
          context.moveTo(tx - 7, ty);
          context.lineTo(tx + 7, ty);
          context.stroke();
        }
        context.strokeStyle = accentAlpha(0.2);
        context.beginPath();
        context.moveTo(sx - 16, yBottom);
        context.lineTo(sx + 2, yTop);
        context.stroke();
      }

      const waterY = yOf(waterRef.current);

      // Keepsakes, in their own vector shapes. Anything under the surface
      // sways and dims — you can see what the dive is for.
      for (const item of itemsRef.current) {
        if (item.taken) continue;
        const iy = yOf(item.floor);
        if (iy < -24 || iy > height + 24) continue;
        const under = item.floor < waterRef.current;
        const sway = reducedMotion || !under ? 0 : Math.sin(now / 620 + item.floor) * 2.4;
        const pulse = reducedMotion
          ? 0.85
          : 0.6 + 0.3 * Math.abs(Math.sin(now / 520 + item.floor * 1.7));
        drawKeepsake({
          ctx: context,
          kind: item.kind,
          x: xOf(item.x) + sway,
          y: iy - 14,
          size: 21,
          alpha: under ? pulse * 0.75 : pulse,
          bright: palette.bright,
        });
        // Weight pips beside each one: heavier things visibly read heavier,
        // which is the whole reason to think before grabbing the stone.
        const weight = KEEPSAKES[item.kind].weight;
        context.fillStyle = accentAlpha(0.55);
        for (let i = 0; i < weight; i += 1) {
          context.fillRect(xOf(item.x) - weight * 2.1 + i * 4.2, iy - 4, 3, 3);
        }
      }

      // The flood: surface, body, bubbles, and a dashed line showing where it
      // will be in three seconds. The water is never a surprise.
      if (waterY < height + 8) {
        const amplitude = reducedMotion ? 0 : 2.8;
        const wave = (x: number) => waterY + Math.sin(x / 24 + now / 380) * amplitude;
        context.beginPath();
        context.moveTo(0, Math.max(-6, wave(0)));
        for (let x = 0; x <= width; x += 8) context.lineTo(x, wave(x));
        context.lineTo(width, height);
        context.lineTo(0, height);
        context.closePath();
        context.fillStyle = accentAlpha(0.17);
        context.fill();
        context.strokeStyle = accentAlpha(0.62);
        context.lineWidth = 1.5;
        context.beginPath();
        for (let x = 0; x <= width; x += 8) {
          if (x === 0) context.moveTo(x, wave(x));
          else context.lineTo(x, wave(x));
        }
        context.stroke();
        if (!reducedMotion) {
          for (let i = 0; i < 9; i += 1) {
            const bx = (i * 89) % Math.max(1, Math.round(width));
            const span = Math.max(1, height - waterY);
            const by = height - ((now / 8 + i * 130) % span);
            context.fillStyle = accentAlpha(0.2);
            context.beginPath();
            context.arc(bx, Math.max(waterY, by), 1.4 + (i % 3), 0, Math.PI * 2);
            context.fill();
          }
        }
      }
      // Forecast: dashed, labelled, always drawn while it is still on screen.
      const forecast = waterRef.current + LEVELS[levelRef.current].rise * FORECAST_SECONDS;
      const forecastY = yOf(forecast);
      if (forecastY > -10 && forecastY < height + 10) {
        context.save();
        context.setLineDash([5, 5]);
        context.strokeStyle = accentAlpha(0.4);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, forecastY);
        context.lineTo(width, forecastY);
        context.stroke();
        context.restore();
        context.fillStyle = accentAlpha(0.55);
        context.font = "8px monospace";
        context.fillText("water in 3s", 6, forecastY - 4);
      }

      // The splash ring the moment the water closes over you.
      if (!reducedMotion && splashRef.current > 0) {
        const t = Math.max(0, (now - splashRef.current) / 620);
        if (t < 1) {
          context.strokeStyle = accentAlpha(0.55 * (1 - t));
          context.lineWidth = 2;
          context.beginPath();
          context.arc(xOf(pxRef.current), waterY, 6 + t * width * 0.4, 0, Math.PI * 2);
          context.stroke();
        }
      }

      // The figure: upright walking, horizontal once it is swimming.
      const fx = xOf(pxRef.current);
      const fy = yOf(pyRef.current);
      const submerged = pyRef.current < waterRef.current;
      context.fillStyle = palette.bright;
      context.strokeStyle = palette.bright;
      if (submerged) {
        context.beginPath();
        context.arc(fx + 5, fy - 5, 3.2, 0, Math.PI * 2);
        context.fill();
        context.fillRect(fx - 7, fy - 6.6, 12, 3.2);
        context.lineWidth = 1.5;
        const kick = reducedMotion ? 0 : Math.sin(now / 120) * 3;
        context.beginPath();
        context.moveTo(fx - 7, fy - 5);
        context.lineTo(fx - 13, fy - 5 + kick);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(fx, fy - 12, 3.4, 0, Math.PI * 2);
        context.fill();
        context.fillRect(fx - 2, fy - 9, 4, 8);
        const swing = reducedMotion ? 0 : Math.sin(walkPhaseRef.current) * 3.2;
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(fx, fy - 1.5);
        context.lineTo(fx - 2 + swing, fy + 3.5);
        context.moveTo(fx, fy - 1.5);
        context.lineTo(fx + 2 - swing, fy + 3.5);
        context.stroke();
      }

      // The load on your back, drawn as the actual things you picked up.
      carriedRef.current.forEach((item, index) => {
        drawKeepsake({
          ctx: context,
          kind: item.kind,
          x: fx + 12 + (index % 3) * 13,
          y: fy - 20 - Math.floor(index / 3) * 13,
          size: 10,
          alpha: 0.85,
          bright: palette.bright,
        });
      });

      // A bright sweep across the landing whenever a load is banked.
      if (bankFlashRef.current > 0) {
        const t = reducedMotion ? 1 : Math.max(0, (now - bankFlashRef.current) / 520);
        if (t < 1) {
          context.strokeStyle = accentAlpha(0.7 * (1 - t));
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(xOf(0) - 6, yOf(LANDING));
          context.lineTo(xOf(0) - 6 + (xOf(1) - xOf(0) + 12) * Math.min(1, t * 1.6), yOf(LANDING));
          context.stroke();
        }
      }

      if (!reducedMotion) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.09;
          p.life -= 0.024;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(p.life * 0.75);
          context.fillRect(p.x, p.y, 2, 2);
        }
      }

      // The frame closes in as the breath runs out.
      const breathFraction = breathRef.current / MAX_BREATH;
      if (breathFraction < 0.999) {
        context.fillStyle = accentAlpha(0.04 + (1 - breathFraction) * 0.24);
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    };
    drawRef.current = draw;

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    lastRef.current = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = Math.min(0.05, (now - lastRef.current) / 1000);
        lastRef.current = now;
        if (phaseRef.current === "running") tick(dt, false);
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, tick]);

  // Reduced motion repaints on state change instead of running a loop.
  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, phase, level, carried, banked]);

  // A low bed while the water is running; it stops with the run.
  useEffect(() => {
    if (phase !== "running" || audio.muted) return;
    audio.startDrone(44 + level * 7, "sine");
    return () => audio.stopDrone();
  }, [audio, level, phase]);

  const spec = LEVELS[level];
  const load = carried.reduce((sum, item) => sum + item.weight, 0);
  const targetMet = banked >= spec.target;
  const canEscape = phase === "running" && onLanding && targetMet;

  const status = useMemo(() => {
    if (phase === "drowned")
      return failReason === "breath"
        ? `Out of breath on descent ${level + 1}. ${score} points, ${rescued} things saved.`
        : `The water took the landing on descent ${level + 1} with only ${banked} of ${spec.target} banked. ${score} points.`;
    if (phase === "done")
      return `All three descents made. ${rescued} things saved, ${score} points.`;
    if (phase === "landing")
      return `Descent ${level + 1} banked ${banked} against a target of ${spec.target}. ${score} points so far.`;
    if (phase === "paused") return "Held on the stairs.";
    if (canEscape)
      return `Target met — ${banked} of ${spec.target} banked. Get out now, or go back down for more before the water reaches the landing.`;
    if (load >= CAPACITY) return "Your back is full. Nothing else fits until you bank it on the landing.";
    return `Descent ${level + 1} of ${LEVELS.length} — ${banked} of ${spec.target} banked, load ${load}/${CAPACITY}. Walk the corridors, take the stairwells, dive for what is already under.`;
  }, [banked, canEscape, failReason, level, load, phase, rescued, score, spec.target]);

  const dpad = (
    label: string,
    dx: number,
    dy: number,
    glyph: string
  ) => (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        hold(dx, dy);
      }}
      onPointerUp={() => release(dx !== 0 ? "x" : "y")}
      onPointerLeave={() => release(dx !== 0 ? "x" : "y")}
      onPointerCancel={() => release(dx !== 0 ? "x" : "y")}
      aria-label={label}
      style={{ touchAction: "none" }}
      className="para-press border border-accent/30 px-3 py-2 text-[13px] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-sim-state={phase}
      data-level={level + 1}
      data-banked={banked}
      data-target={spec.target}
      data-load={load}
      data-carried={carried.length}
      data-reached={rescued}
      data-stairs-score={score}
      className="flex flex-col gap-3"
    >
      <ParasiteKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          descent <span className="text-accent">{level + 1}</span>/{LEVELS.length}
        </span>
        <span>
          banked{" "}
          <span key={banked} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {banked}
          </span>
          /{spec.target}
          {targetMet && (
            <span aria-hidden className="ml-1 text-accent-bright">
              ✓
            </span>
          )}
        </span>
        <span>
          load <span className="text-accent">{load}</span>/{CAPACITY}
          <span aria-hidden className="ml-1 text-accent/70">
            {"▮".repeat(load)}
            {"▯".repeat(Math.max(0, CAPACITY - load))}
          </span>
        </span>
        <span>
          saved <span className="text-accent">{rescued}</span>
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {score}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          breath <span ref={breathTextRef} className="text-accent">100%</span>
        </span>
        <span className="flex items-center gap-1.5">
          water <span ref={waterTextRef} className="text-accent">—</span>
        </span>
        <span className="ml-auto flex gap-2">
          <ParasiteMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "running" || phase === "paused") && (
            <ParasiteChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </ParasiteChip>
          )}
        </span>
      </div>

      {/* Breath meter */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={breathBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      {/* The shaft */}
      <div
        className="relative"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (phaseRef.current !== "running" || reducedMotion) return;
          audio.unlock();
          audio.startDrone(44 + levelRef.current * 7, "sine");
          event.currentTarget.setPointerCapture(event.pointerId);
          const box = event.currentTarget.getBoundingClientRect();
          const perFloor = box.height / VISIBLE_FLOORS;
          targetRef.current = {
            floor: cameraRef.current + (box.height / 2 - (event.clientY - box.top)) / perFloor,
            x: ((event.clientX - box.left) / box.width - CORRIDOR_L) / CORRIDOR_W,
          };
        }}
        onPointerMove={(event) => {
          if (targetRef.current === null) return;
          const box = event.currentTarget.getBoundingClientRect();
          const perFloor = box.height / VISIBLE_FLOORS;
          targetRef.current = {
            floor: cameraRef.current + (box.height / 2 - (event.clientY - box.top)) / perFloor,
            x: ((event.clientX - box.left) / box.width - CORRIDOR_L) / CORRIDOR_W,
          };
        }}
        onPointerUp={() => {
          targetRef.current = null;
        }}
        onPointerCancel={() => {
          targetRef.current = null;
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-72 w-full border border-accent/25 bg-ink/60 sm:h-[26rem]"
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-4 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "para-float"
            }`}
          >
            {note.text}
          </p>
        )}
        {phase !== "running" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 px-4 text-center">
            <div className={reducedMotion ? "" : "para-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "paused"
                  : phase === "landing"
                    ? `descent ${level + 1} clear`
                    : phase === "drowned"
                      ? failReason === "breath"
                        ? "the breath ran out"
                        : "the water took the landing"
                      : "everything that mattered, upstairs"}
              </p>
              {phase !== "paused" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {rescued} saved
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/65">
        {status}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "running" || phase === "paused" ? (
          <>
            <div className="flex items-center gap-1.5">
              {dpad("Move left along this floor", -1, 0, "←")}
              <div className="flex flex-col gap-1.5">
                {dpad("Climb toward the landing", 0, 1, "↑")}
                {dpad("Descend toward the semi-basement", 0, -1, "↓")}
              </div>
              {dpad("Move right along this floor", 1, 0, "→")}
            </div>
            {canEscape && (
              <button
                ref={actionRef}
                type="button"
                onClick={() => {
                  if (freshPress()) clearLevel();
                }}
                aria-label={`Get out now with ${banked} points banked`}
                className="para-press border border-accent/60 px-3 py-2 text-accent-bright hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                get out now
              </button>
            )}
            <span className="max-w-full text-white/35">
              {reducedMotion
                ? "each press is one deliberate move and the water answers — the deliberate mode takes the nearest stairwell for you"
                : "arrows or WASD to walk and climb · drag the shaft to send him somewhere · stairwells only line up where the steps are drawn"}
            </span>
          </>
        ) : phase === "landing" ? (
          <ParasiteChip
            innerRef={actionRef}
            onClick={() => {
              if (freshPress()) startLevel(level + 1);
            }}
            bright
          >
            Down again — {LEVELS[Math.min(level + 1, LEVELS.length - 1)].label}
          </ParasiteChip>
        ) : (
          <ParasiteChip
            innerRef={actionRef}
            onClick={() => {
              if (freshPress()) restart();
            }}
            bright
          >
            {phase === "done" ? "Take the stairs again" : "Go back down"}
          </ParasiteChip>
        )}
      </div>

      {/* What is still down there, in words — the canvas is aria-hidden. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] normal-case tracking-normal text-white/40">
        {spec.items.map((item, index) => {
          const taken = itemsRef.current[index]?.taken ?? false;
          const info = KEEPSAKES[item.kind];
          return (
            <li key={`${item.kind}-${item.floor}-${item.x}`}>
              <span className={taken ? "text-accent/70" : ""}>
                {info.label} — floor {item.floor === 0 ? "B" : item.floor}, weight {info.weight},{" "}
                {info.value} pts
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ParasiteUpAndDown({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="parasite-stairs-title"
      gameId="parasite-stairs"
      eyebrow="Vertical descent"
      title="Up and down"
      startLabel="Take the stairs"
      stage
      howToPlay={{
        objective:
          "Carry enough of the family's things up to the landing to hit each descent's target before the flood reaches it — three descents, each one faster and deeper than the last.",
        controls: [
          { keys: "← →  / A D", does: "walk along the floor you are on" },
          { keys: "↑ ↓ / W S", does: "climb or descend — but only where a stairwell is drawn" },
          { keys: "drag", does: "drag anywhere on the shaft and he routes himself there" },
          { keys: "get out now", does: "bank the descent once the target is met, instead of pushing your luck" },
          { keys: "pause", does: "hold on the stairs" },
        ],
        tip: "The stairwells zigzag, so reaching a floor is a route across the corridor as well as a climb. Some keepsakes are already underwater when you start: you can swim freely in any direction while submerged, and things taken from under the surface are worth half again — but the breath meter is the whole clock. Every item has a weight, you can only carry six units at once, and a full back is a slow back. Reaching the landing banks whatever you are carrying.",
      }}
      reference={{
        scene: "Parasite (2019) · the long flood-night descent, mansion to semi-basement",
      }}
      onClose={onClose}
    >
      <UpAndDown />
    </SimulationShell>
  );
}
