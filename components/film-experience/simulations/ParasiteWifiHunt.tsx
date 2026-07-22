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
import {
  ParasiteChip,
  ParasiteKeyframes,
  ParasiteMuteButton,
  useParasiteAudio,
} from "@/components/film-experience/simulations/ParasiteShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Phones held to the ceiling, sweeping for somebody else's network. The room
// is a heatmap you can only see where you have already swept: every pass
// remembers what it measured, so the map is something you build rather than
// something you are given. Park on the strongest spot and hold to lock a bar.
// Four rooms, each with a stingier signal, and interference that moves.

const COLS = 14;
const ROWS = 10;
const STEP = 0.05;
const REVEAL_RADIUS = 0.13;
const SCORE_ID = "parasite-wifi";

type Phase = "hunting" | "paused" | "dead" | "done";

type Jammer = Readonly<{ cx: number; cy: number; radius: number; speed: number; phase: number }>;

// The rooms escalate: hotter thresholds, longer holds, more interference.
const ROOMS = [
  { name: "the toilet shelf", bars: 1, hot: 0.8, holdMs: 850, jammers: [] as Jammer[] },
  {
    name: "the kitchen",
    bars: 2,
    hot: 0.83,
    holdMs: 950,
    jammers: [{ cx: 0.5, cy: 0.5, radius: 0.26, speed: 0.55, phase: 0 }] as Jammer[],
  },
  {
    name: "the stairwell",
    bars: 2,
    hot: 0.86,
    holdMs: 1050,
    jammers: [
      { cx: 0.35, cy: 0.4, radius: 0.24, speed: 0.7, phase: 0 },
      { cx: 0.68, cy: 0.62, radius: 0.22, speed: -0.6, phase: 1.9 },
    ] as Jammer[],
  },
  {
    name: "the ceiling corner",
    bars: 3,
    hot: 0.88,
    holdMs: 1150,
    jammers: [
      { cx: 0.42, cy: 0.34, radius: 0.3, speed: 0.95, phase: 0.6 },
      { cx: 0.6, cy: 0.68, radius: 0.28, speed: -0.85, phase: 2.4 },
    ] as Jammer[],
  },
] as const;

// Router spots are a fixed cycle: the hunt is a room to learn, not a lottery.
type Spot = Readonly<{ x: number; y: number }>;
const ROUTER_SPOTS: readonly Spot[] = [
  { x: 0.72, y: 0.28 },
  { x: 0.24, y: 0.34 },
  { x: 0.68, y: 0.72 },
  { x: 0.34, y: 0.7 },
  { x: 0.52, y: 0.18 },
  { x: 0.84, y: 0.54 },
  { x: 0.16, y: 0.6 },
  { x: 0.58, y: 0.44 },
];

const BATTERY_DRAIN = 2.1; // % per second
const BATTERY_HOLD_DRAIN = 1.3; // extra % per second while locking

function jammerAt(jammer: Jammer, seconds: number) {
  const angle = jammer.phase + seconds * jammer.speed;
  return { x: jammer.cx + Math.cos(angle) * jammer.radius, y: jammer.cy + Math.sin(angle) * jammer.radius * 0.62 };
}

/** The hunt's drone pitch tracks signal strength: 220Hz cold, ~920Hz hot. */
const droneFreqFor = (strength: number) => 220 + strength * 700;

function WifiHunt() {
  const [phase, setPhase] = useState<Phase>("hunting");
  const [room, setRoom] = useState(0);
  const [bars, setBars] = useState(0);
  const [totalBars, setTotalBars] = useState(0);
  const [score, setScore] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useParasiteAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signalBarRef = useRef<HTMLDivElement>(null);
  const signalTextRef = useRef<HTMLSpanElement>(null);
  const tempTextRef = useRef<HTMLSpanElement>(null);
  const holdBarRef = useRef<HTMLDivElement>(null);
  const batteryBarRef = useRef<HTMLDivElement>(null);
  const batteryTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const posRef = useRef({ x: 0.5, y: 0.9 });
  const routerRef = useRef(ROUTER_SPOTS[0]);
  const heatRef = useRef<Float32Array>(new Float32Array(COLS * ROWS).fill(-1));
  const holdingRef = useRef(false);
  const holdRef = useRef(0);
  const batteryRef = useRef(100);
  const strengthRef = useRef(0);
  const roomRef = useRef(0);
  const barsRef = useRef(0);
  const totalBarsRef = useRef(0);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("hunting");
  const lastRef = useRef(0);
  const clockRef = useRef(0);
  const lockFlashRef = useRef(-1);
  const drawRef = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const strengthAt = useCallback(
    (x: number, y: number) => {
      const router = routerRef.current;
      const distance = Math.hypot(x - router.x, y - router.y);
      let value = Math.pow(Math.max(0, 1 - distance / 0.78), 1.4);
      const jammers = ROOMS[roomRef.current].jammers;
      for (const jammer of jammers) {
        const spot = jammerAt(jammer, reducedMotion ? 0 : clockRef.current);
        const jamDistance = Math.hypot(x - spot.x, y - spot.y);
        const bite = Math.max(0, 1 - jamDistance / 0.24);
        value *= 1 - 0.92 * bite;
      }
      return Math.max(0, Math.min(1, value));
    },
    [reducedMotion]
  );

  /** Every sweep writes what it measured into the map it can see. */
  const reveal = useCallback(() => {
    const { x, y } = posRef.current;
    const heat = heatRef.current;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cx = (col + 0.5) / COLS;
        const cy = (row + 0.5) / ROWS;
        if (Math.hypot(cx - x, cy - y) > REVEAL_RADIUS) continue;
        const measured = strengthAt(cx, cy);
        const index = row * COLS + col;
        if (measured > heat[index]) heat[index] = measured;
      }
    }
  }, [strengthAt]);

  const paintMeters = useCallback(() => {
    const value = strengthRef.current;
    const hot = ROOMS[roomRef.current].hot;
    // Mirrored onto the root so the meter is inspectable without reading pixels.
    rootRef.current?.setAttribute("data-wifi-signal", String(Math.round(value * 100)));
    if (signalBarRef.current) signalBarRef.current.style.width = `${Math.round(value * 100)}%`;
    if (signalTextRef.current) signalTextRef.current.textContent = `${Math.round(value * 100)}%`;
    if (tempTextRef.current) {
      tempTextRef.current.textContent =
        value >= hot ? "hot — hold" : value >= 0.55 ? "warm" : value >= 0.3 ? "cool" : "cold";
    }
    if (holdBarRef.current) {
      holdBarRef.current.style.width = `${Math.round(
        (holdRef.current / ROOMS[roomRef.current].holdMs) * 100
      )}%`;
    }
    if (batteryBarRef.current) batteryBarRef.current.style.width = `${Math.max(0, batteryRef.current).toFixed(1)}%`;
    if (batteryTextRef.current) {
      batteryTextRef.current.textContent = `${Math.max(0, Math.round(batteryRef.current))}%`;
    }
  }, []);

  const endRun = useCallback(
    (outcome: "dead" | "done") => {
      holdingRef.current = false;
      audio.stopDrone();
      if (outcome === "dead") audio.fail();
      else audio.win();
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const enterRoom = useCallback(
    (index: number) => {
      roomRef.current = index;
      barsRef.current = 0;
      holdRef.current = 0;
      holdingRef.current = false;
      posRef.current = { x: 0.5, y: 0.9 };
      heatRef.current = new Float32Array(COLS * ROWS).fill(-1);
      routerRef.current = ROUTER_SPOTS[totalBarsRef.current % ROUTER_SPOTS.length];
      lastRef.current = performance.now();
      reveal();
      strengthRef.current = strengthAt(posRef.current.x, posRef.current.y);
      paintMeters();
      setRoom(index);
      setBars(0);
      phaseRef.current = "hunting";
      setPhase("hunting");
    },
    [paintMeters, reveal, strengthAt]
  );

  const restart = useCallback(() => {
    totalBarsRef.current = 0;
    scoreRef.current = 0;
    batteryRef.current = 100;
    clockRef.current = 0;
    setTotalBars(0);
    setScore(0);
    setNote(null);
    enterRoom(0);
  }, [enterRoom]);

  const lockBar = useCallback(() => {
    const value = 200 + Math.round(batteryRef.current * 2) + roomRef.current * 120;
    scoreRef.current += value;
    barsRef.current += 1;
    totalBarsRef.current += 1;
    holdRef.current = 0;
    holdingRef.current = false;
    lockFlashRef.current = performance.now();
    setScore(scoreRef.current);
    setBars(barsRef.current);
    setTotalBars(totalBarsRef.current);
    setNote({ id: performance.now(), text: `bar locked +${value}` });
    audio.ok();

    if (barsRef.current >= ROOMS[roomRef.current].bars) {
      const bonus = 250 * (roomRef.current + 1);
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      // Every room cleared hands a little battery back.
      batteryRef.current = Math.min(100, batteryRef.current + 18);
      if (roomRef.current + 1 >= ROOMS.length) {
        endRun("done");
        return;
      }
      audio.clear();
      enterRoom(roomRef.current + 1);
      return;
    }
    routerRef.current = ROUTER_SPOTS[totalBarsRef.current % ROUTER_SPOTS.length];
    heatRef.current = new Float32Array(COLS * ROWS).fill(-1);
    reveal();
    paintMeters();
  }, [audio, endRun, enterRoom, paintMeters, reveal]);

  // Shared tail of every sweep: re-read the room at the new spot, retune the
  // drone, repaint the meters, and (under reduced motion) redraw.
  const resample = useCallback(() => {
    reveal();
    strengthRef.current = strengthAt(posRef.current.x, posRef.current.y);
    audio.setDroneFreq(droneFreqFor(strengthRef.current));
    paintMeters();
    if (reducedMotion) drawRef.current(performance.now());
  }, [audio, paintMeters, reducedMotion, reveal, strengthAt]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (phaseRef.current !== "hunting") return;
      audio.unlock();
      posRef.current = {
        x: Math.min(1, Math.max(0, posRef.current.x + dx * STEP)),
        y: Math.min(1, Math.max(0, posRef.current.y + dy * STEP)),
      };
      resample();
    },
    [audio, resample]
  );

  const moveTo = useCallback(
    (x: number, y: number) => {
      if (phaseRef.current !== "hunting") return;
      posRef.current = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
      resample();
    },
    [resample]
  );

  const beginHold = useCallback(() => {
    if (phaseRef.current !== "hunting") return;
    audio.unlock();
    audio.startDrone(droneFreqFor(strengthRef.current), "sine");
    if (reducedMotion) {
      // No hold loop under reduced motion: a press on a hot spot takes the bar.
      if (strengthRef.current >= ROOMS[roomRef.current].hot) lockBar();
      else audio.wrong();
      drawRef.current(performance.now());
      return;
    }
    holdingRef.current = true;
  }, [audio, lockBar, reducedMotion]);

  const endHold = useCallback(() => {
    holdingRef.current = false;
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "hunting") {
      holdingRef.current = false;
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "hunting";
      setPhase("hunting");
    }
  }, [audio]);

  // Keyboard: arrows/WASD sweep, space holds the lock. Space is ignored when a
  // button has focus so its own handler (and the space-to-click default) wins.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const delta = map[event.key];
      if (delta) {
        event.preventDefault();
        move(delta[0], delta[1]);
        return;
      }
      if (event.key === " " && !(event.target as HTMLElement | null)?.closest?.("button")) {
        event.preventDefault();
        if (!event.repeat) beginHold();
      }
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === " " && !(event.target as HTMLElement | null)?.closest?.("button")) {
        event.preventDefault();
        endHold();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [beginHold, endHold, move]);

  // The room: swept heat, interference, the phone, and its lock ring.
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
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // The swept heatmap. Unmeasured cells stay as faint ticks — the room is
      // dark until the phone has been there.
      const cellW = width / COLS;
      const cellH = height / ROWS;
      const heat = heatRef.current;
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const value = heat[row * COLS + col];
          const x = col * cellW;
          const y = row * cellH;
          if (value < 0) {
            context.fillStyle = accentAlpha(0.06);
            context.fillRect(x + cellW / 2 - 1, y + cellH / 2 - 1, 2, 2);
            continue;
          }
          context.fillStyle = accentAlpha(0.05 + value * 0.55);
          context.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
          // A second, non-color read on the strongest cells.
          if (value > 0.75) {
            context.fillStyle = palette.bright;
            context.globalAlpha = 0.55;
            context.fillRect(x + cellW / 2 - 1.5, y + cellH / 2 - 1.5, 3, 3);
            context.globalAlpha = 1;
          }
        }
      }

      // Interference: ripples you can see coming, and should not sit under.
      const seconds = clockRef.current;
      for (const jammer of ROOMS[roomRef.current].jammers) {
        const spot = jammerAt(jammer, reducedMotion ? 0 : seconds);
        for (let ring = 0; ring < 3; ring += 1) {
          const t = reducedMotion ? ring / 3 : ((seconds * 0.8 + ring / 3) % 1);
          context.strokeStyle = accentAlpha(0.28 * (1 - t));
          context.lineWidth = 1;
          context.beginPath();
          context.arc(spot.x * width, spot.y * height, 6 + t * 0.24 * width, 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = accentAlpha(0.5);
        context.beginPath();
        context.moveTo(spot.x * width, spot.y * height - 5);
        context.lineTo(spot.x * width + 5, spot.y * height + 4);
        context.lineTo(spot.x * width - 5, spot.y * height + 4);
        context.closePath();
        context.fill();
      }

      // The phone, its sweep arc, and the lock ring filling around it.
      const { x, y } = posRef.current;
      const px = x * width;
      const py = y * height;
      const strength = strengthRef.current;
      if (!reducedMotion) {
        context.strokeStyle = accentAlpha(0.16 + strength * 0.3);
        context.lineWidth = 1;
        const sweep = (now / 700) % (Math.PI * 2);
        context.beginPath();
        context.arc(px, py, 16 + strength * 22, sweep, sweep + 1.1);
        context.stroke();
      }
      context.fillStyle = palette.bright;
      context.fillRect(px - 3.5, py - 6, 7, 12);
      context.fillStyle = accentAlpha(0.35);
      context.fillRect(px - 2.5, py - 5, 5, 8);

      const holdFraction = holdRef.current / ROOMS[roomRef.current].holdMs;
      if (holdFraction > 0) {
        context.strokeStyle = palette.bright;
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(px, py, 13, -Math.PI / 2, -Math.PI / 2 + holdFraction * Math.PI * 2);
        context.stroke();
      }

      // The lock landing: a ring blooming out of the router that was hiding.
      if (lockFlashRef.current > 0) {
        // rAF timestamps can trail performance.now() after a long stall, so the
        // elapsed fraction is clamped before it becomes a radius.
        const t = reducedMotion ? 1 : Math.max(0, (now - lockFlashRef.current) / 700);
        if (t < 1) {
          context.strokeStyle = accentAlpha(0.7 * (1 - t));
          context.lineWidth = 2;
          context.beginPath();
          context.arc(px, py, 10 + t * width * 0.35, 0, Math.PI * 2);
          context.stroke();
        }
      }

      // Battery burn-down darkens the room at the edges.
      if (batteryRef.current < 60) {
        context.fillStyle = accentAlpha(0.02 + (60 - batteryRef.current) / 60 * 0.16);
        context.fillRect(0, 0, width, height);
      }
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
        if (phaseRef.current === "hunting") {
          clockRef.current += dt;
          strengthRef.current = strengthAt(posRef.current.x, posRef.current.y);
          const config = ROOMS[roomRef.current];
          if (holdingRef.current && strengthRef.current >= config.hot) {
            holdRef.current = Math.min(config.holdMs, holdRef.current + dt * 1000);
            audio.setDroneFreq(droneFreqFor(strengthRef.current) + holdRef.current);
            if (holdRef.current >= config.holdMs) lockBar();
          } else if (holdRef.current > 0) {
            holdRef.current = Math.max(0, holdRef.current - dt * 1000 * 1.6);
          }
          batteryRef.current -= dt * (BATTERY_DRAIN + (holdingRef.current ? BATTERY_HOLD_DRAIN : 0));
          paintMeters();
          if (batteryRef.current <= 0) {
            batteryRef.current = 0;
            endRun("dead");
          }
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [audio, endRun, lockBar, paintMeters, reducedMotion, strengthAt]);

  useEffect(() => {
    reveal();
    strengthRef.current = strengthAt(posRef.current.x, posRef.current.y);
    paintMeters();
    if (reducedMotion) drawRef.current(performance.now());
  }, [paintMeters, reducedMotion, reveal, strengthAt]);

  const config = ROOMS[room];

  const status = useMemo(() => {
    if (phase === "dead") return `The phone died. ${totalBars} bars, ${score} points.`;
    if (phase === "done") return `Connected in every room. ${totalBars} bars, ${score} points.`;
    if (phase === "paused") return "Phone down. Nothing is being measured.";
    return `${config.name} — ${bars}/${config.bars} bars. Sweep for the signal, then hold to lock it.`;
  }, [bars, config, phase, score, totalBars]);

  const over = phase === "dead" || phase === "done";

  return (
    <div
      ref={rootRef}
      data-sim-state={phase}
      data-room={room + 1}
      data-wifi-signal="0"
      data-bars={totalBars}
      data-room-bars={bars}
      data-wifi-score={score}
      className="flex flex-col gap-3"
    >
      <ParasiteKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          room <span className="text-accent">{room + 1}</span>/{ROOMS.length}
        </span>
        <span>
          bars{" "}
          <span key={totalBars} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {bars}
          </span>
          /{config.bars}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          signal <span ref={signalTextRef} className="text-accent">0%</span>{" "}
          <span ref={tempTextRef} className="text-white/40">cold</span>
        </span>
        <span>
          battery <span ref={batteryTextRef} className="text-accent">100%</span>
        </span>
        <span className="ml-auto flex gap-2">
          <ParasiteMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {!over && (
            <ParasiteChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </ParasiteChip>
          )}
        </span>
      </div>

      {/* Signal, lock, battery */}
      <div className="flex flex-col gap-1">
        <div className="h-2 w-full bg-white/10" aria-hidden>
          <div ref={signalBarRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
        </div>
        <div className="h-1 w-full bg-white/10" aria-hidden>
          <div ref={holdBarRef} className="h-full bg-accent-bright" style={{ width: "0%" }} />
        </div>
        <div className="h-1 w-full bg-white/10" aria-hidden>
          <div ref={batteryBarRef} className="h-full bg-accent/50" style={{ width: "100%" }} />
        </div>
      </div>

      {/* The room */}
      <div
        className="relative"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (phaseRef.current !== "hunting") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const box = event.currentTarget.getBoundingClientRect();
          moveTo((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
          beginHold();
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const box = event.currentTarget.getBoundingClientRect();
          moveTo((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
        }}
        onPointerUp={endHold}
        onPointerCancel={endHold}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-56 w-full border border-accent/25 bg-ink/60 sm:h-72"
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "para-float"
            }`}
          >
            {note.text}
          </p>
        )}
        {(phase === "paused" || over) && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 text-center">
            <div className={reducedMotion ? "" : "para-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused" ? "paused" : phase === "dead" ? "battery dead" : "full bars"}
              </p>
              {over && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {totalBars} bars · {score} points
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/65">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {!over ? (
          <>
            <div className="grid w-24 shrink-0 grid-cols-3 gap-1 text-[11px]">
              <span aria-hidden />
              <button
                type="button"
                onClick={() => move(0, -1)}
                aria-label="Sweep the phone up"
                className="para-press border border-accent/30 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ↑
              </button>
              <span aria-hidden />
              <button
                type="button"
                onClick={() => move(-1, 0)}
                aria-label="Sweep the phone left"
                className="para-press border border-accent/30 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => move(0, 1)}
                aria-label="Sweep the phone down"
                className="para-press border border-accent/30 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => move(1, 0)}
                aria-label="Sweep the phone right"
                className="para-press border border-accent/30 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                beginHold();
              }}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onKeyDown={(event: ReactKeyboardEvent) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                if (!event.repeat) beginHold();
              }}
              onKeyUp={(event: ReactKeyboardEvent) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                endHold();
              }}
              aria-label="Hold to lock the signal"
              style={{ touchAction: "none" }}
              className="para-press border border-accent/40 px-4 py-2 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              hold to lock
            </button>
            <span className="text-white/35">arrows sweep · space or drag holds</span>
          </>
        ) : (
          <ParasiteChip innerRef={actionRef} onClick={restart} bright>
            Hunt again
          </ParasiteChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ParasiteWifiHunt({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="parasite-wifi-title"
      gameId="parasite-wifi"
      eyebrow="Signal hunt"
      title="The Wi-Fi hunt"
      startLabel="Raise the phone"
      stage
      howToPlay={{
        objective:
          "Lock the bars each room asks for, across four rooms, before the phone battery dies.",
        controls: [
          { keys: "↑ ↓ ← → / WASD", does: "sweep the phone one step across the room" },
          { keys: "Space", does: "hold on a hot spot to lock a bar" },
          { keys: "drag", does: "move the phone straight to a point and hold there" },
          { keys: "pause", does: "hold the hunt" },
        ],
        tip: "The heatmap only shows what you have already swept, so the map is something you build. Interference drifts, the battery drains the whole time, and each room cleared hands a little charge back.",
      }}
      reference={{
        scene: "Parasite (2019) · phones held to the ceiling hunting a free signal",
      }}
      onClose={onClose}
    >
      <WifiHunt />
    </SimulationShell>
  );
}
