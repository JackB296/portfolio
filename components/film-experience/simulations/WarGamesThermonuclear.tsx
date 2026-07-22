"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  WarGamesKeyframes,
  WarGamesMuteButton,
  alphaFrom,
  fitCanvas,
  paintCrt,
  useWarGamesAudio,
  withAlpha,
} from "@/components/film-experience/simulations/WarGamesShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// A vector globe, a target list, and a DEFCON ladder that only goes one way.
// Every strike is answered harder than it was thrown; the board can be played
// to the end, but the end is the same board with nobody on it. The refusal is
// the scored win — and refusing early scores highest, because the score is
// simply what is left standing.

type Vec = { x: number; y: number; z: number };

type Target = {
  id: string;
  name: string;
  /** Degrees. */
  lat: number;
  lon: number;
  /** Hardened silo fields blunt the answer; soft targets provoke it. */
  hardened: boolean;
  hit: boolean;
};

const START_CITIES = 8;
const START_INTERCEPTS = 3;
const OUTBOUND_MS = 900;
const REDUCED_OUTBOUND_MS = 350;
const REDUCED_INCOMING_MS = 4000;
const CYCLE_STEP_MS = 90;
const CYCLE_STEPS = 22;
const SCORE_ID = "wargames-thermonuclear";

const SCENARIOS = [
  "ARCTIC FEINT",
  "SUBMARINE SORTIE",
  "PALMYRA GAMBIT",
  "COUNTERFORCE ALPHA",
  "DELTA STRIKE",
  "MASSIVE RETALIATION",
  "SILO SUPPRESSION",
  "ATLANTIC SWEEP",
  "PRE-EMPTIVE FEINT",
  "CIVILIAN ESCALATION",
  "LIMITED EXCHANGE",
] as const;

/** Their side of the sphere: five targets, two of them hardened. */
const TARGET_SEED: readonly Omit<Target, "hit">[] = [
  { id: "t1", name: "Northern silo field", lat: 62, lon: 44, hardened: true },
  { id: "t2", name: "Coastal submarine yard", lat: 43, lon: 132, hardened: false },
  { id: "t3", name: "Central command grid", lat: 55, lon: 37, hardened: true },
  { id: "t4", name: "Steppe launch corridor", lat: 50, lon: 82, hardened: true },
  { id: "t5", name: "Delta industrial belt", lat: 34, lon: 108, hardened: false },
];

/** Our side: the cities the answer comes back to. */
const HOME: readonly { lat: number; lon: number }[] = [
  { lat: 47, lon: -122 }, { lat: 38, lon: -121 }, { lat: 34, lon: -118 },
  { lat: 41, lon: -87 }, { lat: 39, lon: -105 }, { lat: 30, lon: -95 },
  { lat: 40, lon: -74 }, { lat: 38, lon: -77 },
];

type Phase = "briefing" | "outbound" | "incoming" | "cycling" | "resolved" | "refused";

type Arc = {
  from: Vec;
  to: Vec;
  born: number;
  duration: number;
  ours: boolean;
  killed: boolean;
};

type Blast = { at: Vec; born: number };

const toVec = (lat: number, lon: number): Vec => {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return {
    x: Math.cos(phi) * Math.sin(theta),
    y: Math.sin(phi),
    z: Math.cos(phi) * Math.cos(theta),
  };
};

const spinVec = (v: Vec, angle: number): Vec => ({
  x: v.x * Math.cos(angle) + v.z * Math.sin(angle),
  y: v.y,
  z: -v.x * Math.sin(angle) + v.z * Math.cos(angle),
});

/** Great-circle interpolation, lofted so the arc leaves the surface. */
function loft(from: Vec, to: Vec, t: number): Vec {
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const z = from.z + (to.z - from.z) * t;
  const len = Math.hypot(x, y, z) || 1;
  const lift = 1 + 0.34 * Math.sin(Math.PI * t);
  return { x: (x / len) * lift, y: (y / len) * lift, z: (z / len) * lift };
}

function WarRoom() {
  const [phase, setPhase] = useState<Phase>("briefing");
  const [targets, setTargets] = useState<Target[]>(() =>
    TARGET_SEED.map((t) => ({ ...t, hit: false }))
  );
  const [selected, setSelected] = useState<string>(TARGET_SEED[0].id);
  const [ours, setOurs] = useState(START_CITIES);
  const [theirs, setTheirs] = useState(START_CITIES);
  const [defcon, setDefcon] = useState(5);
  const [intercepts, setIntercepts] = useState(START_INTERCEPTS);
  const [exchanges, setExchanges] = useState(0);
  const [scoreValue, setScoreValue] = useState(0);
  const [scenario, setScenario] = useState<string>(SCENARIOS[0]);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useWarGamesAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const arcsRef = useRef<Arc[]>([]);
  const blastsRef = useRef<Blast[]>([]);
  const timersRef = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("briefing");
  const reducedRef = useRef(false);
  const shakeUntilRef = useRef(0);
  const spinRef = useRef(0);
  // Home cities burn in a fixed order so the globe agrees with the counter.
  const homeLostRef = useRef(0);
  // Standing-city mirrors so the timer callbacks that resolve an exchange can
  // decide the outcome without nesting one setState inside another.
  const oursRef = useRef(START_CITIES);
  const theirsRef = useRef(START_CITIES);
  // Set once the last unstruck target is spent: there is nothing left to aim
  // at, so the exchange that follows is the last one.
  const spentRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    oursRef.current = ours;
  }, [ours]);
  useEffect(() => {
    theirsRef.current = theirs;
  }, [theirs]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 1400);
    return () => window.clearTimeout(timer);
  }, [note]);

  const bank = useCallback((standingOurs: number, standingTheirs: number) => {
    // The score IS what is left standing. Nothing else pays.
    const total = standingOurs * 150 + standingTheirs * 75;
    setScoreValue(total);
    if (total > 0) recordSimulationScore(SCORE_ID, total);
    return total;
  }, []);

  const refuse = useCallback(() => {
    clearTimers();
    arcsRef.current = [];
    audio.unlock();
    audio.play({ freq: 392, duration: 0.28, gain: 0.06 });
    audio.play({ freq: 523, duration: 0.5, gain: 0.06, delay: 0.15 });
    bank(ours, theirs);
    setPhase("refused");
    window.requestAnimationFrame(() => primaryRef.current?.focus());
  }, [audio, bank, clearTimers, ours, theirs]);

  const runFinale = useCallback(
    (standingOurs: number, standingTheirs: number) => {
      setPhase("cycling");
      let step = 0;
      const tick = () => {
        step += 1;
        setScenario(SCENARIOS[step % SCENARIOS.length]);
        if (step >= CYCLE_STEPS) {
          bank(standingOurs, standingTheirs);
          setPhase("resolved");
          audio.play({ freq: 330, duration: 0.5, gain: 0.06 });
          window.requestAnimationFrame(() => primaryRef.current?.focus());
          return;
        }
        later(tick, reducedRef.current ? CYCLE_STEP_MS * 2 : CYCLE_STEP_MS);
      };
      later(tick, CYCLE_STEP_MS);
    },
    [audio, bank, later]
  );

  const settleIncoming = useCallback(() => {
    if (phaseRef.current !== "incoming") return;
    const live = arcsRef.current.filter((arc) => !arc.ours && !arc.killed);
    const landed = live.length;
    arcsRef.current = [];
    const now = performance.now();
    for (let i = 0; i < landed; i += 1) {
      const index = (homeLostRef.current + i) % HOME.length;
      blastsRef.current.push({ at: toVec(HOME[index].lat, HOME[index].lon), born: now });
    }
    homeLostRef.current += landed;
    if (landed > 0) {
      shakeUntilRef.current = now + 420;
      audio.play({ freq: 110, slideTo: 55, duration: 0.5, gain: 0.07 });
    }
    const nextOurs = Math.max(0, oursRef.current - landed);
    oursRef.current = nextOurs;
    setOurs(nextOurs);
    if (nextOurs <= 0 || theirsRef.current <= 0 || spentRef.current) {
      runFinale(nextOurs, theirsRef.current);
    } else setPhase("briefing");
    setNote({
      id: now,
      text: landed === 0 ? "all incoming intercepted" : `${landed} city strike${landed > 1 ? "s" : ""}`,
    });
  }, [audio, runFinale]);

  const launch = useCallback(() => {
    if (phaseRef.current !== "briefing") return;
    const target = targets.find((t) => t.id === selected);
    if (!target || target.hit) return;
    audio.unlock();
    audio.play({ freq: 220, slideTo: 660, duration: 0.5, gain: 0.06 });

    const outbound = reducedRef.current ? REDUCED_OUTBOUND_MS : OUTBOUND_MS;
    const now = performance.now();
    arcsRef.current = [
      {
        from: toVec(HOME[0].lat, HOME[0].lon),
        to: toVec(target.lat, target.lon),
        born: now,
        duration: outbound,
        ours: true,
        killed: false,
      },
    ];
    setPhase("outbound");

    later(() => {
      // Impact: soft targets take two, hardened fields take one but blunt the
      // answer that comes back.
      const removed = target.hardened ? 1 : 2;
      blastsRef.current.push({ at: toVec(target.lat, target.lon), born: performance.now() });
      audio.play({ freq: 90, slideTo: 48, duration: 0.45, gain: 0.07 });
      const struck = targets.map((t) => (t.id === target.id ? { ...t, hit: true } : t));
      setTargets(struck);
      // Aim moves on to whatever is still standing; nothing left means this
      // exchange is the last one the board can host.
      const open = struck.find((t) => !t.hit);
      spentRef.current = !open;
      if (open) setSelected(open.id);
      const nextTheirs = Math.max(0, theirs - removed);
      theirsRef.current = nextTheirs;
      setTheirs(nextTheirs);

      const nextExchanges = exchanges + 1;
      setExchanges(nextExchanges);
      const nextDefcon = Math.max(1, defcon - 1);
      setDefcon(nextDefcon);
      // Every second exchange returns a spent interceptor to the rail.
      if (nextExchanges % 2 === 0) setIntercepts((v) => Math.min(START_INTERCEPTS, v + 1));

      const answer = Math.max(1, nextExchanges + (target.hardened ? -1 : 1));
      const flight = reducedRef.current ? REDUCED_INCOMING_MS : 1400 + nextDefcon * 260;
      const born = performance.now();
      arcsRef.current = Array.from({ length: answer }, (_, i) => {
        const source = TARGET_SEED[(i + nextExchanges) % TARGET_SEED.length];
        const home = HOME[(homeLostRef.current + i) % HOME.length];
        return {
          from: toVec(source.lat, source.lon),
          to: toVec(home.lat, home.lon),
          born: born + i * 90,
          duration: flight,
          ours: false,
          killed: false,
        };
      });
      audio.play({ freq: 160, duration: 0.3, gain: 0.05 });
      setNote({ id: born, text: `${answer} inbound` });
      setPhase("incoming");
      later(settleIncoming, flight + answer * 90);
    }, outbound);
  }, [audio, defcon, exchanges, later, selected, settleIncoming, targets, theirs]);

  const intercept = useCallback(() => {
    if (phaseRef.current !== "incoming") return;
    if (intercepts <= 0) return;
    const live = arcsRef.current.find((arc) => !arc.ours && !arc.killed);
    if (!live) return;
    live.killed = true;
    blastsRef.current.push({
      at: loft(live.from, live.to, 0.5),
      born: performance.now(),
    });
    setIntercepts((v) => v - 1);
    audio.play({ freq: 880, slideTo: 1320, duration: 0.16, gain: 0.05 });
    setNote({ id: performance.now(), text: "intercept" });
    if (!arcsRef.current.some((arc) => !arc.ours && !arc.killed)) {
      clearTimers();
      settleIncoming();
    }
  }, [audio, clearTimers, intercepts, settleIncoming]);

  const reset = useCallback(() => {
    clearTimers();
    arcsRef.current = [];
    blastsRef.current = [];
    homeLostRef.current = 0;
    oursRef.current = START_CITIES;
    theirsRef.current = START_CITIES;
    spentRef.current = false;
    setTargets(TARGET_SEED.map((t) => ({ ...t, hit: false })));
    setSelected(TARGET_SEED[0].id);
    setOurs(START_CITIES);
    setTheirs(START_CITIES);
    setDefcon(5);
    setIntercepts(START_INTERCEPTS);
    setExchanges(0);
    setScoreValue(0);
    setNote(null);
    setPhase("briefing");
  }, [clearTimers]);

  // Space fires the interceptor while anything is inbound — the war-room
  // reflex, available without hunting for the button.
  useEffect(() => {
    if (phase !== "incoming") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "INPUT") return;
      event.preventDefault();
      intercept();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intercept, phase]);

  // The globe: one rAF loop draws the wireframe, the silos, the arcs in
  // flight, and the blasts. Reduced motion repaints on state change only, with
  // arcs drawn complete instead of travelling.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let { width, height } = fitCanvas(canvas);
    const resize = () => {
      const next = fitCanvas(canvas);
      width = next.width;
      height = next.height;
    };
    window.addEventListener("resize", resize);
    // Sampled once: the grade cannot change while a simulation dialog is open,
    // and reading CSS custom properties inside a frame forces a style recalc.
    const palette = getLiveThemePalette();

    const paint = (now: number, animate: boolean) => {
      paintCrt(context, width, height, animate ? now : 0, palette);
      // One palette read per frame: the wireframe alone strokes hundreds of
      // segments, and re-reading the CSS variable per stroke costs a style
      // recalculation each time.
      const acc = alphaFrom(palette);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.4;
      if (animate) spinRef.current = (now / 26000) * Math.PI * 2;
      const spin = spinRef.current + 0.6;

      const project = (v: Vec) => {
        const r = spinVec(v, spin);
        return { x: cx + r.x * radius, y: cy - r.y * radius, z: r.z };
      };

      // Wireframe: parallels and meridians, back half dimmed not hidden, so
      // the sphere reads as glass the way a 1983 vector display would.
      const strokeRing = (points: Vec[]) => {
        let pen = false;
        for (const point of points) {
          const p = project(point);
          context.strokeStyle = p.z >= 0 ? acc(0.34) : acc(0.09);
          if (!pen) {
            context.beginPath();
            context.moveTo(p.x, p.y);
            pen = true;
          } else {
            context.lineTo(p.x, p.y);
            context.stroke();
            context.beginPath();
            context.moveTo(p.x, p.y);
          }
        }
        context.stroke();
      };
      context.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 30) {
        strokeRing(
          Array.from({ length: 49 }, (_, i) => toVec(lat, (i / 48) * 360))
        );
      }
      for (let lon = 0; lon < 360; lon += 30) {
        strokeRing(
          Array.from({ length: 37 }, (_, i) => toVec(-90 + (i / 36) * 180, lon))
        );
      }
      context.strokeStyle = acc(0.5);
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();

      // Silos: theirs on the far side, ours on the near. Struck ones go dark.
      const dot = (v: Vec, lit: boolean, ring: boolean) => {
        const p = project(v);
        const front = p.z >= 0;
        context.fillStyle = lit
          ? front
            ? palette.bright
            : acc(0.35)
          : acc(front ? 0.16 : 0.07);
        context.beginPath();
        context.arc(p.x, p.y, front ? 3 : 2, 0, Math.PI * 2);
        context.fill();
        if (ring && front) {
          context.strokeStyle = withAlpha(palette.bright, 0.8);
          context.lineWidth = 1;
          context.beginPath();
          context.arc(p.x, p.y, 8 + (animate ? Math.sin(now / 220) * 2 : 0), 0, Math.PI * 2);
          context.stroke();
        }
      };
      for (const target of TARGET_SEED) {
        const live = targets.find((t) => t.id === target.id);
        dot(toVec(target.lat, target.lon), !live?.hit, live?.id === selected && !live.hit);
      }
      for (let i = 0; i < HOME.length; i += 1) {
        dot(toVec(HOME[i].lat, HOME[i].lon), i >= homeLostRef.current, false);
      }

      // Arcs in flight.
      context.lineWidth = 1.4;
      for (const arc of arcsRef.current) {
        const raw = animate ? (now - arc.born) / arc.duration : 1;
        const t = Math.min(1, Math.max(0, raw));
        if (t <= 0) continue;
        context.strokeStyle = arc.killed
          ? acc(0.2)
          : arc.ours
            ? acc(0.75)
            : withAlpha(palette.bright, 0.85);
        context.beginPath();
        let pen = false;
        const steps = 26;
        for (let i = 0; i <= steps; i += 1) {
          const s = (i / steps) * t;
          const p = project(loft(arc.from, arc.to, s));
          if (!pen) {
            context.moveTo(p.x, p.y);
            pen = true;
          } else context.lineTo(p.x, p.y);
        }
        context.stroke();
        if (!arc.killed && t < 1) {
          const head = project(loft(arc.from, arc.to, t));
          context.fillStyle = palette.bright;
          context.beginPath();
          context.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
          context.fill();
        }
      }

      // Blasts: expanding rings that fade out of the phosphor.
      const life = 900;
      blastsRef.current = blastsRef.current.filter((b) => !animate || now - b.born < life);
      for (const blast of blastsRef.current) {
        const t = animate ? Math.min(1, (now - blast.born) / life) : 0.5;
        const p = project(blast.at);
        if (p.z < -0.1) continue;
        context.strokeStyle = withAlpha(palette.bright, (1 - t) * 0.9);
        context.lineWidth = 2 * (1 - t) + 0.4;
        context.beginPath();
        context.arc(p.x, p.y, 3 + t * 26, 0, Math.PI * 2);
        context.stroke();
      }
    };

    if (reducedMotion) {
      // No motion loop, just a slow beat that redraws the frozen frame: arcs
      // are drawn complete rather than travelling, the globe does not spin, and
      // the stage cannot be caught blank by a paint that landed before the
      // dialog was laid out.
      const redraw = () => {
        if (document.hidden) return;
        resize();
        paint(performance.now(), false);
      };
      redraw();
      const interval = window.setInterval(redraw, 300);
      // A resize re-fits (and so clears) the canvas; with no loop to cover for
      // it, the reduced-motion path has to repaint on the same event.
      window.addEventListener("resize", redraw);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("resize", redraw);
        window.removeEventListener("resize", resize);
      };
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) paint(performance.now(), true);
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [phase, reducedMotion, selected, targets]);

  const status = useMemo(() => {
    if (phase === "refused")
      return `Declined. ${ours + theirs} cities still standing — ${scoreValue} points banked.`;
    if (phase === "resolved") return "Winner: none. Every scenario ends on this board.";
    if (phase === "cycling") return `Running ${scenario}…`;
    if (phase === "incoming")
      return `Inbound. Fire an interceptor — ${intercepts} left on the rail.`;
    if (phase === "outbound") return "Bird away. Time to target…";
    if (exchanges === 0)
      return "Pick a target and launch, or decline. The score is whatever is left standing.";
    return `DEFCON ${defcon}. Every strike is answered harder than it was thrown.`;
  }, [defcon, exchanges, intercepts, ours, phase, scenario, scoreValue, theirs]);

  const over = phase === "resolved" || phase === "refused";
  const shaking = !reducedMotion && performance.now() < shakeUntilRef.current;

  return (
    <div
      data-sim-state={phase}
      data-defcon={defcon}
      data-cities-ours={ours}
      data-cities-theirs={theirs}
      data-intercepts={intercepts}
      data-exchanges={exchanges}
      data-war-score={scoreValue}
      className="flex flex-col gap-3"
    >
      <WarGamesKeyframes />

      {/* HUD: the DEFCON ladder reads as steps, not colour alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span aria-label={`DEFCON ${defcon}`}>
          defcon{" "}
          <span className={defcon <= 2 ? "text-accent-bright" : "text-accent"}>
            {[5, 4, 3, 2, 1].map((step) => (
              <span key={step} className={step >= defcon ? "" : "text-white/20"}>
                {step === defcon ? `[${step}]` : step}
              </span>
            ))}
          </span>
        </span>
        <span>
          ours <span className="text-accent">{ours}</span>
        </span>
        <span>
          theirs <span className="text-accent">{theirs}</span>
        </span>
        <span aria-label={`${intercepts} interceptors ready`}>
          intercept{" "}
          <span className="text-accent">
            {"▮".repeat(intercepts)}
            <span className="text-white/25">{"▯".repeat(START_INTERCEPTS - intercepts)}</span>
          </span>
        </span>
        <span>
          standing{" "}
          <span key={scoreValue} className={reducedMotion ? "text-accent" : "wg-anim-pop text-accent"}>
            {scoreValue}
          </span>
        </span>
        <span className="ml-auto">
          <WarGamesMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
        </span>
      </div>

      <div
        className="relative h-56 overflow-hidden border border-accent/25 sm:h-72"
        style={{ animation: shaking ? "wg-shake 320ms ease-in-out" : undefined }}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {phase === "cycling" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 text-center">
            <p>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-white/50">
                {scenario}
              </span>
              <span className="mt-2 block text-sm uppercase tracking-[0.18em] text-accent-bright">
                winner: none
              </span>
            </p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 p-4 text-center">
            <p className={reducedMotion ? "" : "wg-anim-rise"}>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-white/50">
                {phase === "refused" ? "Simulation declined" : "Simulation complete"}
              </span>
              <span className="mt-2 block text-sm normal-case leading-relaxed text-accent-bright sm:text-base">
                {phase === "refused"
                  ? "The only winning move is not to play."
                  : "Winner: none. How about a nice game of chess?"}
              </span>
            </p>
          </div>
        )}

        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-[11px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "wg-anim-float"
            }`}
          >
            {note.text}
          </p>
        )}
      </div>

      {/* Target list: the primary decision, keyboard-operable as radios. */}
      {!over && (
        <div
          role="radiogroup"
          aria-label="Strike target"
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        >
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              role="radio"
              aria-checked={selected === target.id}
              disabled={target.hit || phase !== "briefing"}
              onClick={() => {
                setSelected(target.id);
                audio.play({ freq: 700, duration: 0.05, gain: 0.03 });
              }}
              className={`flex items-center justify-between gap-2 border px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${
                selected === target.id && !target.hit
                  ? "border-accent bg-accent/10 text-accent-bright"
                  : "border-accent/25 text-white/65 hover:bg-accent/10"
              }`}
            >
              <span>
                {selected === target.id && !target.hit ? "▸ " : "  "}
                {target.name}
              </span>
              <span className="shrink-0 text-white/40">
                {target.hit ? "struck" : target.hardened ? "hardened −1" : "soft −2"}
              </span>
            </button>
          ))}
        </div>
      )}

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
        {!over && (
          <>
            <button
              type="button"
              onClick={launch}
              disabled={phase !== "briefing"}
              className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Launch strike
            </button>
            <button
              type="button"
              onClick={intercept}
              disabled={phase !== "incoming" || intercepts <= 0}
              className="border border-accent/30 px-3 py-1.5 text-accent-bright hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Intercept (space)
            </button>
            <button
              type="button"
              onClick={refuse}
              disabled={phase === "outbound" || phase === "incoming"}
              className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Decline to play
            </button>
          </>
        )}
        {over && (
          <button
            ref={primaryRef}
            type="button"
            onClick={reset}
            className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Run another scenario
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function WarGamesThermonuclear({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="wargames-thermonuclear-title"
      gameId="wargames-thermonuclear"
      eyebrow="Strategic simulation"
      title="Global thermonuclear war"
      startLabel="Begin simulation"
      stage
      howToPlay={{
        objective:
          "End the scenario with as many cities standing as you can — the score is simply what is left.",
        controls: [
          { keys: "click a target", does: "select the silo or city to aim at" },
          { keys: "launch strike", does: "send it, and take whatever comes back" },
          { keys: "Space", does: "fire an interceptor while anything is inbound" },
          { keys: "decline to play", does: "refuse the scenario and bank what is still standing" },
        ],
        tip: "Three interceptors, no resupply, and DEFCON only climbs one way. Hardened silos blunt the answer, soft targets provoke it, and every exchange costs you more than it costs them.",
      }}
      reference={{
        quote: "How about Global Thermonuclear War?",
        scene: "WarGames (1983) · the vector map lighting up with launch arcs",
      }}
      onClose={onClose}
    >
      <WarRoom />
    </SimulationShell>
  );
}
