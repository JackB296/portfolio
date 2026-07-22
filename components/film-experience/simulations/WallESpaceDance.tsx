"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
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
import { useFreshPress } from "@/lib/useFreshPress";

// A fire extinguisher, zero gravity, and EVE. Nothing here slows you down: a
// puff is a permanent change of course, and the only way to turn is to spend
// more of a tank that will not refill fast enough. The dance is a band of sky
// around EVE — ride it, and every full turn you complete without falling out of
// the band is a pirouette worth having. Hull plating drifts through it.
//
// COORDINATES. Everything below — position, velocity, debris, the band radii —
// lives in FIELD UNITS: distances from the centre of the canvas measured in
// `scale` (the canvas's shorter side), which is exactly how the band is drawn.
// The band the game tests is therefore the band you can see. The earlier model
// stored position as a fraction of width and height separately, so on a wide
// canvas a horizontal distance of 0.24 was drawn a couple of hundred pixels out
// while the radius test read it as comfortably inside a band drawn 89px wide —
// the readout and the picture disagreed by the canvas's aspect ratio.

const SCORE_ID = "wall-e-dance";
const IMPULSE = 0.115; // velocity added per puff, field units/second
const DRAG = 0.16; // a whisper — enough that a run is recoverable
const COST = 8; // charge per puff
const REGEN = 4.2; // charge per second
const MAX_CHARGE = 100;
const MEASURED_STEP = 1; // seconds the deliberate mode advances per press
const MEASURED_ARC = 0.62; // radians swung per press in the deliberate mode
const MEASURED_COST = 3;
const MAX_HITS = 3;
const MAX_TRAIL = 90;

type Phase = "drifting" | "paused" | "adrift" | "movement" | "done";
type Dir = "up" | "down" | "left" | "right";
type Band = "in" | "close" | "wide";
type Debris = { x: number; y: number; vx: number; vy: number; r: number; spin: number };
/** The canvas in field units: pixels per unit, and how far the sky reaches. */
type Field = { scale: number; cx: number; cy: number; hx: number; hy: number };

const MOVEMENTS = [
  { label: "first contact", inner: 0.17, outer: 0.31, target: 5, debris: 2, speed: 0.05 },
  { label: "the long turn", inner: 0.19, outer: 0.3, target: 7, debris: 4, speed: 0.07 },
  { label: "the whole sky", inner: 0.21, outer: 0.29, target: 9, debris: 6, speed: 0.095 },
] as const;

const BAND_WORD: Readonly<Record<Band, string>> = {
  in: "in the band",
  close: "too close",
  wide: "too wide",
};

function fieldOf(width: number, height: number): Field {
  const scale = Math.max(1, Math.min(width, height));
  return {
    scale,
    cx: width / 2,
    cy: height / 2,
    hx: width / (2 * scale),
    hy: height / (2 * scale),
  };
}

function bandOf(radius: number, inner: number, outer: number): Band {
  if (radius < inner) return "close";
  if (radius > outer) return "wide";
  return "in";
}

function SpaceDance() {
  const [phase, setPhase] = useState<Phase>("drifting");
  const [movement, setMovement] = useState(0);
  const [orbit, setOrbit] = useState(0);
  const [revolutions, setRevolutions] = useState(0);
  const [hits, setHits] = useState(0);
  const [score, setScore] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useWallEAudio();

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const chargeBarRef = useRef<HTMLDivElement>(null);
  const chargeTextRef = useRef<HTMLSpanElement>(null);
  const bandTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("drifting");
  const movementRef = useRef(0);
  // Field units, measured from the centre of the sky — the same units the band
  // is drawn in.
  const posRef = useRef({ x: 0, y: -0.24 });
  const velRef = useRef({ x: 0.1, y: 0 });
  const bandRef = useRef<Band>("in");
  const chargeRef = useRef(MAX_CHARGE);
  const orbitRef = useRef(0);
  const orbitShownRef = useRef(0);
  const sweepRef = useRef(0); // signed radians banked inside the band
  const lastAngleRef = useRef(0);
  const revolutionsRef = useRef(0);
  const hitsRef = useRef(0);
  const scoreRef = useRef(0);
  const debrisRef = useRef<Debris[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const puffRef = useRef<{ dir: Dir; at: number } | null>(null);
  const spinRef = useRef(0);
  const seedRef = useRef(1);
  const lastRef = useRef(0);
  const shakeRef = useRef(0);
  const drawRef = useRef<(now: number) => void>(() => {});
  const reducedRef = useRef(false);
  // Hazard (a): the action button is replaced in place when a movement resolves.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /** Deterministic scatter — no Math.random inside the loop. */
  const random = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) & 0x7fffffff;
    return seedRef.current / 0x7fffffff;
  }, []);

  /**
   * The band clock ticks every frame but only needs to reach React when the
   * tenth of a second it displays actually changes — otherwise the HUD would
   * force a re-render at 60fps.
   */
  const publishOrbit = useCallback(() => {
    const shown = Math.round(orbitRef.current * 10) / 10;
    if (shown === orbitShownRef.current) return;
    orbitShownRef.current = shown;
    setOrbit(shown);
  }, []);

  /** The canvas in field units. The canvas element is the authority. */
  const field = useCallback((): Field => {
    const canvas = canvasRef.current;
    return fieldOf(canvas?.offsetWidth || 640, canvas?.offsetHeight || 288);
  }, []);

  const paintMeters = useCallback(() => {
    const fraction = Math.max(0, chargeRef.current) / MAX_CHARGE;
    if (chargeBarRef.current) {
      chargeBarRef.current.style.width = `${(fraction * 100).toFixed(1)}%`;
    }
    if (chargeTextRef.current) {
      chargeTextRef.current.textContent = `${Math.round(fraction * 100)}%`;
    }
    const spec = MOVEMENTS[movementRef.current];
    const pos = posRef.current;
    const band = bandOf(Math.hypot(pos.x, pos.y), spec.inner, spec.outer);
    const root = rootRef.current;
    // Written on transitions only — the band clock ticks 60 times a second and
    // the DOM does not need to hear about all of them.
    if (band !== bandRef.current || root?.getAttribute("data-dance-band") !== band) {
      bandRef.current = band;
      if (bandTextRef.current) bandTextRef.current.textContent = BAND_WORD[band];
      root?.setAttribute("data-dance-band", band);
    }
  }, []);

  const startMovement = useCallback(
    (index: number) => {
      const spec = MOVEMENTS[index];
      movementRef.current = index;
      const radius = (spec.inner + spec.outer) / 2;
      posRef.current = { x: 0, y: -radius };
      // Enough tangential speed to be genuinely orbiting from the first frame.
      velRef.current = reducedRef.current ? { x: 0, y: 0 } : { x: 0.1, y: 0 };
      lastAngleRef.current = Math.atan2(-radius, 0);
      chargeRef.current = MAX_CHARGE;
      orbitRef.current = 0;
      orbitShownRef.current = 0;
      sweepRef.current = 0;
      trailRef.current = [];
      seedRef.current = 7 + index * 31;
      debrisRef.current = reducedRef.current
        ? []
        : Array.from({ length: spec.debris }, () => {
            const angle = random() * Math.PI * 2;
            const heading = random() * Math.PI * 2;
            return {
              x: Math.cos(angle) * 0.45,
              y: Math.sin(angle) * 0.45,
              vx: Math.cos(heading) * spec.speed,
              vy: Math.sin(heading) * spec.speed,
              r: 0.014 + random() * 0.012,
              spin: random() * Math.PI,
            };
          });
      lastRef.current = 0;
      paintMeters();
      setMovement(index);
      setOrbit(0);
      phaseRef.current = "drifting";
      setPhase("drifting");
    },
    [paintMeters, random]
  );

  const restart = useCallback(() => {
    revolutionsRef.current = 0;
    hitsRef.current = 0;
    scoreRef.current = 0;
    setRevolutions(0);
    setHits(0);
    setScore(0);
    setNote(null);
    startMovement(0);
  }, [startMovement]);

  useEffect(() => {
    restart();
  }, [restart]);

  const endRun = useCallback(
    (outcome: "adrift" | "done") => {
      audio.stopDrone();
      if (outcome === "done") audio.win();
      else audio.fail();
      shakeRef.current = performance.now();
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const closeMovement = useCallback(() => {
    const spec = MOVEMENTS[movementRef.current];
    const bonus = 400 * (movementRef.current + 1) + Math.round(chargeRef.current * 3);
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `${spec.label} held +${bonus}`, good: true });
    audio.clear();
    if (movementRef.current + 1 >= MOVEMENTS.length) {
      endRun("done");
      return;
    }
    phaseRef.current = "movement";
    setPhase("movement");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio, endRun]);

  /** One simulation step. `dt` is seconds; the deliberate mode uses a fixed one. */
  const tick = useCallback(
    (dt: number) => {
      const spec = MOVEMENTS[movementRef.current];
      const pos = posRef.current;
      const vel = velRef.current;

      if (!reducedRef.current) {
        const damp = Math.exp(-DRAG * dt);
        vel.x *= damp;
        vel.y *= damp;
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
      }

      chargeRef.current = Math.min(MAX_CHARGE, chargeRef.current + REGEN * dt);

      const view = field();

      // Off the edge of the sky: nothing out there to push against.
      if (Math.abs(pos.x) > view.hx - 0.02 || Math.abs(pos.y) > view.hy - 0.02) {
        scoreRef.current += Math.round(orbitRef.current * 20);
        setScore(scoreRef.current);
        endRun("adrift");
        return;
      }

      // Drifting plating. A hit spins WALL·E off and costs a third of the tank.
      if (!reducedRef.current) {
        for (const rock of debrisRef.current) {
          rock.x += rock.vx * dt;
          rock.y += rock.vy * dt;
          rock.spin += dt * 0.6;
          if (rock.x < -view.hx - 0.06) rock.x = view.hx + 0.06;
          if (rock.x > view.hx + 0.06) rock.x = -view.hx - 0.06;
          if (rock.y < -view.hy - 0.06) rock.y = view.hy + 0.06;
          if (rock.y > view.hy + 0.06) rock.y = -view.hy - 0.06;
          const dx = rock.x - pos.x;
          const dy = rock.y - pos.y;
          if (Math.hypot(dx, dy) < rock.r + 0.02) {
            const away = Math.max(0.001, Math.hypot(dx, dy));
            vel.x -= (dx / away) * 0.16;
            vel.y -= (dy / away) * 0.16;
            rock.vx += (dx / away) * 0.03;
            rock.vy += (dy / away) * 0.03;
            chargeRef.current = Math.max(0, chargeRef.current - 30);
            hitsRef.current += 1;
            setHits(hitsRef.current);
            sweepRef.current = 0;
            shakeRef.current = performance.now();
            audio.wrong();
            setNote({ id: performance.now(), text: "clipped a panel", good: false });
            if (hitsRef.current >= MAX_HITS) {
              scoreRef.current += Math.round(orbitRef.current * 20);
              setScore(scoreRef.current);
              endRun("adrift");
              return;
            }
          }
        }
      }

      // The band, the clock, and the pirouette count. Same units as the band
      // on screen, so what the HUD says is what the picture shows.
      const radius = Math.hypot(pos.x, pos.y);
      const angle = Math.atan2(pos.y, pos.x);
      const inBand = radius >= spec.inner && radius <= spec.outer;
      if (inBand) {
        orbitRef.current += dt;
        publishOrbit();
        let delta = angle - lastAngleRef.current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        // Only a consistent direction counts — a wobble is not a pirouette.
        if (sweepRef.current === 0 || Math.sign(delta) === Math.sign(sweepRef.current)) {
          sweepRef.current += delta;
        } else {
          sweepRef.current = delta;
        }
        if (Math.abs(sweepRef.current) >= Math.PI * 2) {
          sweepRef.current = 0;
          revolutionsRef.current += 1;
          setRevolutions(revolutionsRef.current);
          const bonus = 250 * (1 + revolutionsRef.current);
          scoreRef.current += bonus;
          setScore(scoreRef.current);
          setNote({ id: performance.now(), text: `pirouette +${bonus}`, good: true });
          audio.ok();
        }
      } else if (orbitRef.current > 0) {
        // Falling out of the band bleeds the clock instead of zeroing it.
        orbitRef.current = Math.max(0, orbitRef.current - dt * 0.6);
        publishOrbit();
        sweepRef.current = 0;
      }
      lastAngleRef.current = angle;

      if (!reducedRef.current) {
        const trail = trailRef.current;
        trail.push({ x: pos.x, y: pos.y });
        if (trail.length > MAX_TRAIL) trail.shift();
      }

      paintMeters();

      // A hair of tolerance, so a whole number of deliberate beats lands.
      if (orbitRef.current >= spec.target - 1e-6) {
        scoreRef.current += Math.round(spec.target * 20);
        setScore(scoreRef.current);
        closeMovement();
      }
    },
    [audio, closeMovement, endRun, field, paintMeters, publishOrbit]
  );

  const puff = useCallback(
    (dir: Dir) => {
      if (phaseRef.current !== "drifting") return;
      audio.unlock();
      const cost = reducedRef.current ? MEASURED_COST : COST;
      if (chargeRef.current < cost) {
        audio.wrong();
        setNote({ id: performance.now(), text: "tank dry", good: false });
        return;
      }
      chargeRef.current -= cost;
      puffRef.current = { dir, at: performance.now() };
      audio.hiss();

      if (reducedRef.current) {
        // The deliberate dance: ← → swing around EVE, ↑ ↓ change the radius.
        // Every press is one measured beat, and the world answers once.
        const pos = posRef.current;
        let radius = Math.hypot(pos.x, pos.y);
        let angle = Math.atan2(pos.y, pos.x);
        if (dir === "left") angle -= MEASURED_ARC;
        else if (dir === "right") angle += MEASURED_ARC;
        else if (dir === "up") radius = Math.max(0.04, radius - 0.025);
        else radius = Math.min(0.45, radius + 0.025);
        pos.x = Math.cos(angle) * radius;
        pos.y = Math.sin(angle) * radius;
        spinRef.current += dir === "left" ? -0.6 : dir === "right" ? 0.6 : 0;
        tick(MEASURED_STEP);
        drawRef.current(performance.now());
        return;
      }

      const vel = velRef.current;
      if (dir === "up") vel.y -= IMPULSE;
      else if (dir === "down") vel.y += IMPULSE;
      else if (dir === "left") vel.x -= IMPULSE;
      else vel.x += IMPULSE;
      spinRef.current += 0.4;
      paintMeters();
    },
    [audio, paintMeters, tick]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "drifting") {
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      phaseRef.current = "drifting";
      setPhase("drifting");
    }
  }, [audio]);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePause();
        return;
      }
      const dir = map[event.key];
      if (!dir) return;
      event.preventDefault();
      if (event.repeat) return;
      puff(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puff, togglePause]);

  // The sky: stars, EVE, the band, the trail, the plating, and WALL·E.
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
      const spec = MOVEMENTS[movementRef.current];
      const { scale, cx, cy, hx, hy } = fieldOf(width, height);
      const pos = posRef.current;
      const radius = Math.hypot(pos.x, pos.y);
      const band = bandOf(radius, spec.inner, spec.outer);
      const inBand = band === "in";
      // Field units → pixels. Every mark below goes through this pair, which is
      // why the band that is drawn is the band that is scored.
      const toX = (x: number) => cx + x * scale;
      const toY = (y: number) => cy + y * scale;

      const shake =
        !reduced && shakeRef.current > 0 && now - shakeRef.current < 400
          ? (Math.random() - 0.5) * 8 * (1 - (now - shakeRef.current) / 400)
          : 0;

      context.save();
      context.translate(shake, 0);
      context.fillStyle = palette.inkSoft;
      context.fillRect(-10, 0, width + 20, height);

      // Stars, fixed positions, breathing slightly.
      context.fillStyle = accentAlpha(0.3);
      for (let i = 0; i < 70; i += 1) {
        const sx = (i * 197) % Math.max(1, Math.round(width));
        const sy = (i * 113) % Math.max(1, Math.round(height));
        const twinkle = reduced ? 0.3 : 0.18 + 0.22 * Math.abs(Math.sin(now / 900 + i));
        context.globalAlpha = twinkle;
        context.fillRect(sx, sy, 1.5, 1.5);
      }
      context.globalAlpha = 1;

      // THE BAND — the sky worth being in, and the only place the clock runs.
      // Filled, edged, and centre-lined, and it changes state when WALL·E is
      // inside it: solid edges and a filled ring when he is in, dashed edges
      // and a hollow ring when he is not. Never colour alone.
      const innerPx = spec.inner * scale;
      const outerPx = spec.outer * scale;
      const midPx = (innerPx + outerPx) / 2;
      context.fillStyle = accentAlpha(inBand ? 0.13 : 0.06);
      context.beginPath();
      context.arc(cx, cy, outerPx, 0, Math.PI * 2);
      context.arc(cx, cy, innerPx, 0, Math.PI * 2, true);
      context.fill();
      context.strokeStyle = accentAlpha(inBand ? 0.75 : 0.34);
      context.lineWidth = inBand ? 2 : 1;
      if (!inBand) context.setLineDash([5, 4]);
      for (const r of [innerPx, outerPx]) {
        context.beginPath();
        context.arc(cx, cy, r, 0, Math.PI * 2);
        context.stroke();
      }
      context.setLineDash([]);
      context.lineWidth = 1;
      // The line to ride, and the word for where you are, written on the band.
      context.strokeStyle = accentAlpha(0.22);
      context.setLineDash([2, 6]);
      context.beginPath();
      context.arc(cx, cy, midPx, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.font = "9px monospace";
      context.textAlign = "center";
      context.fillStyle = accentAlpha(inBand ? 0.85 : 0.5);
      context.fillText(
        inBand ? "◆ IN THE BAND" : band === "close" ? "TOO CLOSE" : "TOO WIDE",
        cx,
        cy - outerPx - 8
      );
      context.fillText("RIDE THIS RING", cx, cy + outerPx + 14);
      context.textAlign = "left";

      // Orbit progress drawn as an arc on the band's midline.
      const progress = Math.min(1, orbitRef.current / spec.target);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(cx, cy, midPx, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      context.stroke();
      context.lineWidth = 1;

      // EVE: a smooth shell and a scanning eye that tracks WALL·E.
      const toWallE = Math.atan2(pos.y, pos.x);
      context.fillStyle = accentAlpha(0.14);
      context.beginPath();
      context.arc(cx, cy, 22, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = palette.bright;
      context.beginPath();
      context.ellipse(cx, cy, 11, 15, 0, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = palette.bright;
      context.beginPath();
      context.ellipse(
        cx + Math.cos(toWallE) * 2.5,
        cy - 3 + Math.sin(toWallE) * 2,
        5.5,
        2.6,
        0,
        0,
        Math.PI * 2
      );
      context.fill();

      // The trail: the shape the dance actually drew.
      const trail = trailRef.current;
      if (trail.length > 1) {
        context.strokeStyle = accentAlpha(0.28);
        context.beginPath();
        trail.forEach((point, index) => {
          if (index === 0) context.moveTo(toX(point.x), toY(point.y));
          else context.lineTo(toX(point.x), toY(point.y));
        });
        context.stroke();
      }

      // Drifting plating.
      context.strokeStyle = accentAlpha(0.55);
      for (const rock of debrisRef.current) {
        context.save();
        context.translate(toX(rock.x), toY(rock.y));
        context.rotate(reduced ? 0 : rock.spin);
        context.beginPath();
        context.moveTo(-rock.r * scale, 0);
        context.lineTo(0, -rock.r * scale * 0.8);
        context.lineTo(rock.r * scale, rock.r * scale * 0.2);
        context.lineTo(0, rock.r * scale);
        context.closePath();
        context.stroke();
        context.restore();
      }

      // WALL·E: a boxy body, treads, and the extinguisher plume.
      const px = toX(pos.x);
      const py = toY(pos.y);

      // Out of the band? Say so, and point at the way back — a dashed tether to
      // the nearest point on the ring, an arrowhead on it, and the distance in
      // words. A glance is enough to know which way to puff.
      if (!inBand && radius > 0.001) {
        const goal = band === "close" ? innerPx : outerPx;
        const ux = pos.x / radius;
        const uy = pos.y / radius;
        const gx = cx + ux * goal;
        const gy = cy + uy * goal;
        const sign = band === "close" ? 1 : -1;
        context.strokeStyle = accentAlpha(0.55);
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(gx, gy);
        context.stroke();
        context.setLineDash([]);
        // Arrowhead at the midpoint, pointing the way to go.
        const mx = (px + gx) / 2;
        const my = (py + gy) / 2;
        const head = Math.atan2(uy * sign, ux * sign);
        context.save();
        context.translate(mx, my);
        context.rotate(head);
        context.beginPath();
        context.moveTo(7, 0);
        context.lineTo(-4, -5);
        context.lineTo(-4, 5);
        context.closePath();
        context.fillStyle = accentAlpha(0.8);
        context.fill();
        context.restore();
        context.font = "9px monospace";
        context.fillStyle = accentAlpha(0.8);
        context.textAlign = "center";
        context.fillText(band === "close" ? "PUSH OUT →" : "← PULL IN", mx, my - 9);
        context.textAlign = "left";
      }

      // A marker around WALL·E: filled ring when he is in the band, a dashed
      // hoop when he is not, so the state reads without reference to hue.
      context.strokeStyle = accentAlpha(inBand ? 0.8 : 0.45);
      if (!inBand) context.setLineDash([3, 3]);
      context.beginPath();
      context.arc(px, py, inBand ? 13 : 11, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);

      context.save();
      context.translate(px, py);
      context.rotate(reduced ? 0 : spinRef.current * 0.25);
      context.strokeStyle = inBand ? palette.bright : accentAlpha(0.8);
      context.lineWidth = inBand ? 2 : 1.4;
      context.strokeRect(-6, -5, 12, 10);
      context.beginPath();
      context.moveTo(-6, -5);
      context.lineTo(-9, -9);
      context.moveTo(6, -5);
      context.lineTo(9, -9);
      context.stroke();
      context.beginPath();
      context.arc(-4, -8, 2.6, 0, Math.PI * 2);
      context.arc(4, -8, 2.6, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      context.lineWidth = 1;

      // The plume: a short cone opposite the puff, fading over its own life.
      const puffEvent = puffRef.current;
      if (puffEvent) {
        const age = (now - puffEvent.at) / 320;
        if (age >= 1) puffRef.current = null;
        else {
          const vector =
            puffEvent.dir === "up"
              ? [0, 1]
              : puffEvent.dir === "down"
                ? [0, -1]
                : puffEvent.dir === "left"
                  ? [1, 0]
                  : [-1, 0];
          context.fillStyle = accentAlpha(0.45 * (1 - age));
          for (let i = 0; i < 5; i += 1) {
            const spread = (i - 2) * 2.2;
            const reach = 8 + age * 22 + i;
            context.beginPath();
            context.arc(
              px + vector[0] * reach + vector[1] * spread,
              py + vector[1] * reach + vector[0] * spread,
              2.4 * (1 - age),
              0,
              Math.PI * 2
            );
            context.fill();
          }
        }
      }

      // Edge warning: the frame closes in as the sky runs out.
      const edge = Math.max(
        0,
        Math.max(Math.abs(pos.x) / hx, Math.abs(pos.y) / hy) - 0.7
      );
      if (edge > 0) {
        context.fillStyle = accentAlpha(Math.min(0.3, edge));
        context.fillRect(0, 0, width, height);
      }
      context.restore();

      // What was actually painted, published for the spec: WALL·E's drawn
      // offset from the drawn centre of the band, and the band's drawn radii,
      // both in CSS pixels. A hit test that stops agreeing with the picture
      // shows up here as a number, not as a bug report.
      const root = rootRef.current;
      if (root) {
        const drawn = `${Math.round(px - cx)},${Math.round(py - cy)}`;
        const bandPx = `${Math.round(innerPx)},${Math.round(outerPx)}`;
        if (root.getAttribute("data-dance-px") !== drawn) {
          root.setAttribute("data-dance-px", drawn);
        }
        if (root.getAttribute("data-dance-band-px") !== bandPx) {
          root.setAttribute("data-dance-band-px", bandPx);
        }
      }
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
        if (phaseRef.current === "drifting") tick(dt);
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
  }, [reducedMotion, phase, movement, orbit]);

  // Collision shake, restarted imperatively so the canvas element survives.
  useEffect(() => {
    if (!hits || reducedMotion) return;
    const node = skyRef.current;
    if (!node) return;
    node.classList.remove("walle-shake");
    void node.offsetWidth;
    node.classList.add("walle-shake");
  }, [hits, reducedMotion]);

  // A thin vacuum wash while the dance runs.
  useEffect(() => {
    if (phase !== "drifting" || audio.muted || reducedMotion) return;
    audio.startDrone(58 + movement * 7, "sine");
    return () => audio.stopDrone();
  }, [audio, movement, phase, reducedMotion]);

  const spec = MOVEMENTS[movement];
  const running = phase === "drifting";

  const status = useMemo(() => {
    if (phase === "adrift")
      return hits >= MAX_HITS
        ? `Three panels and the tank was gone. ${revolutions} pirouettes, ${score} points.`
        : `Spun off into the black. ${revolutions} pirouettes, ${score} points.`;
    if (phase === "done")
      return `All three movements held. ${revolutions} pirouettes, ${score} points.`;
    if (phase === "movement")
      return `${spec.label} closed. ${orbit.toFixed(1)}s in the band, ${score} points.`;
    if (phase === "paused") return "Holding still in the black.";
    if (reducedMotion)
      return `Measured dance: ← → swing around EVE, ↑ ↓ change your radius. Stay on the drawn ring for ${spec.target}s.`;
    return `Ride the ring drawn around EVE — the clock only runs inside it, and the arrow points the way back. Band ${Math.min(orbit, spec.target).toFixed(1)}/${spec.target}s.`;
  }, [hits, orbit, phase, reducedMotion, revolutions, score, spec]);

  const arrow = (dir: Dir, glyph: string, label: string) => (
    <button
      type="button"
      onClick={() => puff(dir)}
      aria-label={label}
      className="walle-press border border-accent/30 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {glyph}
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-sim-state={phase}
      data-dance-movement={movement + 1}
      data-orbit={orbit.toFixed(1)}
      data-dance-revolutions={revolutions}
      data-dance-hits={hits}
      data-dance-score={score}
      className="flex flex-col gap-3"
      onPointerDownCapture={markPress}
    >
      <WallEKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          movement <span className="text-accent">{movement + 1}</span>/{MOVEMENTS.length}
        </span>
        <WallEReadout
          label="band"
          value={`${Math.min(orbit, spec.target).toFixed(1)}/${spec.target}s`}
          reducedMotion={reducedMotion}
        />
        <WallEReadout label="pirouettes" value={revolutions} reducedMotion={reducedMotion} />
        <WallEReadout label="score" value={score} reducedMotion={reducedMotion} />
        <span className="flex items-center gap-1.5">
          tank <span ref={chargeTextRef} className="text-accent">100%</span>
        </span>
        <span className="flex items-center gap-1.5" aria-live="polite">
          where <span ref={bandTextRef} className="text-accent">in the band</span>
        </span>
        <span>
          panels <span className="text-accent">{hits}</span>/{MAX_HITS}
        </span>
        <span className="ml-auto flex gap-2">
          <WallEMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(running || phase === "paused") && (
            <WallEChip onClick={togglePause}>{phase === "paused" ? "resume" : "pause"}</WallEChip>
          )}
        </span>
      </div>

      {/* Extinguisher charge */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={chargeBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      {/* The sky */}
      <div ref={skyRef} className="relative" style={{ touchAction: "none" }}>
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
        {(phase === "paused" || phase === "movement" || phase === "adrift" || phase === "done") && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 px-4 text-center">
            <div className={reducedMotion ? "" : "walle-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "holding still"
                  : phase === "movement"
                    ? `${spec.label} closed`
                    : phase === "adrift"
                      ? "lost in the black"
                      : "the whole dance"}
              </p>
              {phase !== "paused" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {revolutions} pirouettes
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="min-h-[2.25rem] text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.12em]">
        {running || phase === "paused" ? (
          <>
            <div className="grid w-32 grid-cols-3 gap-1">
              <span aria-hidden />
              {arrow("up", "↑", reducedMotion ? "Tighten the orbit" : "Puff up")}
              <span aria-hidden />
              {arrow("left", "←", reducedMotion ? "Swing counter-clockwise" : "Puff left")}
              {arrow("down", "↓", reducedMotion ? "Widen the orbit" : "Puff down")}
              {arrow("right", "→", reducedMotion ? "Swing clockwise" : "Puff right")}
            </div>
            <span className="max-w-[16rem] text-white/35">
              {reducedMotion
                ? "each press is one measured beat of the dance"
                : "arrows or W A S D puff · the tank refills slower than you spend it · P holds"}
            </span>
          </>
        ) : phase === "movement" ? (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) startMovement(movement + 1);
            }}
          >
            Next movement — {MOVEMENTS[Math.min(movement + 1, MOVEMENTS.length - 1)].label}
          </WallEChip>
        ) : (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) restart();
            }}
          >
            {phase === "done" ? "Dance it again" : "Push off again"}
          </WallEChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function WallESpaceDance({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="wall-e-dance-title"
      gameId="wall-e-dance"
      eyebrow="Zero-g trial"
      title="Space dance"
      startLabel="Fire the extinguisher"
      stage
      howToPlay={{
        objective:
          "Hold the drawn ring around EVE for the full count in each of three movements without spinning off into the black.",
        controls: [
          { keys: "↑ ↓ ← → / WASD", does: "fire one extinguisher puff in that direction" },
          { keys: "click", does: "the on-screen arrow pad fires the same puffs" },
          { keys: "P", does: "hold still" },
        ],
        tip: "The band is the shaded ring drawn around EVE: inside it the clock runs and WALL·E wears a solid marker, outside it the ring goes dashed and an arrow points the way back. A puff is an impulse, not steering — it adds velocity and almost nothing takes it away, so plan on cancelling your own momentum before you overshoot. The tank refills slower than you spend it, and three panel hits end the run. Reduced motion swaps the drift for measured swings around EVE.",
      }}
      reference={{
        quote: "Define dancing.",
        scene: "WALL·E (2008) · a fire extinguisher, zero gravity, and EVE",
      }}
      onClose={onClose}
    >
      <SpaceDance />
    </SimulationShell>
  );
}
