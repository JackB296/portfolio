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
  BatmanChip,
  paintBatmanMeter,
  BatmanKeyframes,
  BatmanMuteButton,
  useBatmanAudio,
  useCanvasAutoSize,
} from "@/components/film-experience/simulations/TheBatmanShared";
import {
  SCENES,
  evidenceCount,
  type SceneMark,
} from "@/components/film-experience/simulations/TheBatmanSceneData";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// Three crime scenes read by torchlight. The panel is dark; the beam has a
// falloff and a battery, and a mark only gives up what it is once the light has
// rested on it for a beat. Then the decision: does this belong in the file, or
// is it just the room? Tagging the room costs charge — the torch is the clock.

const SCORE_ID = "the-batman-flashlight";
const BEAM_RADIUS = 0.19; // fraction of the panel diagonal
const FOCUS_RADIUS = 0.12;
const DWELL_MS = 620;
const FOCUS_DWELL_MS = 380;
const FOCUS_DRAIN = 2.2; // extra percent per second while focused
const WRONG_TAG_COST = 12;
const TAG_RECHARGE = 5;
// Reduced motion drops the timed hold and the ticking battery for discrete
// costs, so the game is played by decision rather than by clock.
const RM_EXAMINE_COST = 1.5;
const RM_TAG_COST = 3;

type Phase = "sweeping" | "summary" | "paused" | "dark" | "done";

function CrimeScene() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("sweeping");
  const [resolved, setResolved] = useState<readonly string[]>([]);
  const [logged, setLogged] = useState<readonly string[]>([]);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [battery, setBattery] = useState(SCENES[0].battery);
  const [tell, setTell] = useState<{ text: string; bad: boolean } | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const [focused, setFocused] = useState(false);

  const reducedMotion = useReducedMotion();
  const audio = useBatmanAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const batteryBarRef = useRef<HTMLDivElement>(null);
  const batteryTextRef = useRef<HTMLSpanElement>(null);
  const batteryGlyphRef = useRef<HTMLSpanElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);

  const beamRef = useRef({ x: 0.5, y: 0.5 });
  const dwellRef = useRef<{ id: string | null; ms: number }>({ id: null, ms: 0 });
  const resolvedRef = useRef<Set<string>>(new Set());
  const loggedRef = useRef<Set<string>>(new Set());
  const dismissedRef = useRef<Set<string>>(new Set());
  const batteryRef = useRef(SCENES[0].battery);
  const focusRef = useRef(false);
  const phaseRef = useRef<Phase>("sweeping");
  const sceneRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const lastRef = useRef(0);
  const flashRef = useRef(-1);
  const drawRef = useRef<(now: number) => void>(() => {});
  const { freshPress, markPress } = useFreshPress(phase);

  const scene = SCENES[sceneIndex];
  const needed = useMemo(() => evidenceCount(scene), [scene]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    sceneRef.current = sceneIndex;
  }, [sceneIndex]);

  const paintBattery = useCallback(
    (value: number) =>
      paintBatmanMeter(batteryBarRef, batteryTextRef, batteryGlyphRef, value),
    []
  );

  const armScene = useCallback((index: number) => {
    const next = SCENES[index];
    setSceneIndex(index);
    sceneRef.current = index;
    resolvedRef.current = new Set();
    loggedRef.current = new Set();
    dismissedRef.current = new Set();
    dwellRef.current = { id: null, ms: 0 };
    beamRef.current = { x: 0.5, y: 0.5 };
    batteryRef.current = next.battery;
    setResolved([]);
    setLogged([]);
    setDismissed([]);
    setBattery(next.battery);
    paintBattery(next.battery);
    setTell(null);
    lastRef.current = performance.now();
    phaseRef.current = "sweeping";
    setPhase("sweeping");
  }, [paintBattery]);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    setScore(0);
    setStreak(0);
    setNote(null);
    armScene(0);
  }, [armScene]);

  useEffect(() => {
    armScene(0);
  }, [armScene]);

  const goDark = useCallback(() => {
    audio.fail();
    audio.stopDrone();
    recordSimulationScore(SCORE_ID, scoreRef.current);
    batteryRef.current = 0;
    paintBattery(0);
    setBattery(0);
    phaseRef.current = "dark";
    setPhase("dark");
    setShakeTick((tick) => tick + 1);
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio, paintBattery]);

  const drainBattery = useCallback(
    (amount: number) => {
      batteryRef.current = Math.max(0, batteryRef.current - amount);
      paintBattery(batteryRef.current);
      setBattery(batteryRef.current);
      return batteryRef.current <= 0;
    },
    [paintBattery]
  );

  const finishScene = useCallback(() => {
    const spare = Math.round(batteryRef.current * 6);
    scoreRef.current += 300 + spare;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `scene logged +${300 + spare}` });
    flashRef.current = performance.now();
    const last = sceneRef.current + 1 >= SCENES.length;
    if (last) {
      audio.win();
      recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = "done";
      setPhase("done");
    } else {
      audio.clear();
      phaseRef.current = "summary";
      setPhase("summary");
    }
    audio.stopDrone();
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio]);

  /** The beam resting on a mark long enough resolves what it is. */
  const resolveMark = useCallback(
    (mark: SceneMark) => {
      if (resolvedRef.current.has(mark.id)) return;
      resolvedRef.current.add(mark.id);
      setResolved(Array.from(resolvedRef.current));
      audio.tick(resolvedRef.current.size);
      setTell({ text: `${mark.label} — ${mark.detail}`, bad: false });
    },
    [audio]
  );

  /** Aiming the beam. Keyboard focus and pointer hover both aim, so the sweep
   * works with either — and on touch, where there is no hover at all. */
  const aimAt = useCallback(
    (x: number, y: number) => {
      beamRef.current = { x, y };
      if (reducedMotion) drawRef.current(performance.now());
    },
    [reducedMotion]
  );

  /**
   * One control, two beats. With motion the beam's dwell resolves a mark and a
   * press files it. Reduced motion drops the timed hold: the first press
   * examines the mark, the second files it — the same decision, no clock.
   */
  const tag = useCallback(
    (mark: SceneMark) => {
      if (phaseRef.current !== "sweeping") return;
      if (loggedRef.current.has(mark.id) || dismissedRef.current.has(mark.id)) return;
      audio.unlock();
      if (!resolvedRef.current.has(mark.id)) {
        if (!reducedMotion) {
          setTell({ text: "Too dark to read. Hold the light on it.", bad: true });
          setShakeTick((tick) => tick + 1);
          return;
        }
        if (drainBattery(RM_EXAMINE_COST)) {
          goDark();
          return;
        }
        resolveMark(mark);
        drawRef.current(performance.now());
        return;
      }
      if (reducedMotion && drainBattery(RM_TAG_COST)) {
        goDark();
        return;
      }
      if (mark.evidence) {
        loggedRef.current.add(mark.id);
        setLogged(Array.from(loggedRef.current));
        streakRef.current += 1;
        setStreak(streakRef.current);
        const bonus = 120 + (streakRef.current - 1) * 40;
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        setNote({ id: performance.now(), text: `${mark.label} +${bonus}` });
        // A clean read steadies the hand: a little charge back.
        batteryRef.current = Math.min(100, batteryRef.current + TAG_RECHARGE);
        paintBattery(batteryRef.current);
        setBattery(batteryRef.current);
        audio.lock();
        setTell({ text: `Logged. ${mark.detail}`, bad: false });
        if (loggedRef.current.size >= needed) {
          finishScene();
          return;
        }
      } else {
        dismissedRef.current.add(mark.id);
        setDismissed(Array.from(dismissedRef.current));
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        setShakeTick((tick) => tick + 1);
        setTell({ text: `That is the room, not the case. ${mark.detail}`, bad: true });
        if (drainBattery(WRONG_TAG_COST)) {
          goDark();
          return;
        }
      }
      if (reducedMotion) drawRef.current(performance.now());
    },
    [
      audio,
      drainBattery,
      finishScene,
      goDark,
      needed,
      paintBattery,
      reducedMotion,
      resolveMark,
    ]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "sweeping") {
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "sweeping";
      setPhase("sweeping");
    }
  }, [audio]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    beamRef.current = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const setFocus = useCallback(
    (on: boolean) => {
      focusRef.current = on;
      setFocused(on);
      if (on) {
        audio.unlock();
        audio.sweep();
      }
    },
    [audio]
  );

  // Arrow keys walk the beam for anyone playing without a pointer or a mark in
  // focus; F (or the focus button) narrows it.
  useEffect(() => {
    if (phase !== "sweeping") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "SELECT" || target.tagName === "INPUT")) return;
      const stepSize = 0.05;
      const { x, y } = beamRef.current;
      if (event.key === "ArrowLeft") beamRef.current = { x: Math.max(0, x - stepSize), y };
      else if (event.key === "ArrowRight") beamRef.current = { x: Math.min(1, x + stepSize), y };
      else if (event.key === "ArrowUp") beamRef.current = { x, y: Math.max(0, y - stepSize) };
      else if (event.key === "ArrowDown") beamRef.current = { x, y: Math.min(1, y + stepSize) };
      else if (event.key.toLowerCase() === "f") setFocus(!focusRef.current);
      else return;
      event.preventDefault();
      if (reducedMotion) drawRef.current(performance.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reducedMotion, setFocus]);

  // --- The panel ----------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      // Size comes from the ResizeObserver, not from a layout read per frame.
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      const diagonal = Math.hypot(width, height);
      const radius = (focusRef.current ? FOCUS_RADIUS : BEAM_RADIUS) * diagonal;
      const lx = beamRef.current.x * width;
      const ly = beamRef.current.y * height;
      const marks = SCENES[sceneRef.current].marks;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Reduced motion trades the dark for a dim, fully visible room: the game
      // becomes judgement rather than search, and nothing is a blank panel.
      const ambient = reducedMotion ? 0.22 : 0;
      if (ambient > 0) {
        context.fillStyle = accentAlpha(ambient * 0.12);
        context.fillRect(0, 0, width, height);
      }

      // Wet floor: a grid that only shows where the light falls.
      context.save();
      context.beginPath();
      if (reducedMotion) {
        context.rect(0, 0, width, height);
      } else {
        context.arc(lx, ly, radius, 0, Math.PI * 2);
      }
      context.clip();
      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      context.beginPath();
      for (let gx = 0; gx < width; gx += 26) {
        context.moveTo(gx, 0);
        context.lineTo(gx, height);
      }
      for (let gy = 0; gy < height; gy += 26) {
        context.moveTo(0, gy);
        context.lineTo(width, gy);
      }
      context.stroke();
      context.restore();

      // The beam itself: a soft disc with falloff, plus a flicker as the cell
      // runs down so low charge is visible, not merely stated.
      if (!reducedMotion) {
        const charge = batteryRef.current / 100;
        const flicker = charge < 0.25 ? 0.72 + 0.28 * Math.abs(Math.sin(now / 90)) : 1;
        const beam = context.createRadialGradient(lx, ly, 0, lx, ly, radius);
        beam.addColorStop(0, accentAlpha(0.3 * flicker * (0.5 + charge * 0.5)));
        beam.addColorStop(0.55, accentAlpha(0.12 * flicker));
        beam.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = beam;
        context.beginPath();
        context.arc(lx, ly, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = accentAlpha(0.16 * flicker);
        context.lineWidth = 1;
        context.beginPath();
        context.arc(lx, ly, radius, 0, Math.PI * 2);
        context.stroke();
      }

      // The marks.
      for (const mark of marks) {
        const mx = mark.x * width;
        const my = mark.y * height;
        const distance = Math.hypot(mx - lx, my - ly);
        const seen = reducedMotion || distance <= radius;
        const isResolved = resolvedRef.current.has(mark.id);
        const isLogged = loggedRef.current.has(mark.id);
        const isDismissed = dismissedRef.current.has(mark.id);
        if (!seen && !isResolved) continue;

        const alpha = isLogged ? 0.95 : isResolved ? 0.6 : seen ? 0.45 : 0.12;
        context.strokeStyle = accentAlpha(alpha);
        context.lineWidth = isLogged ? 2 : 1;
        context.beginPath();
        context.moveTo(mx - 7, my);
        context.lineTo(mx + 7, my);
        context.moveTo(mx, my - 7);
        context.lineTo(mx, my + 7);
        context.stroke();

        if (isLogged) {
          context.beginPath();
          context.arc(mx, my, 11, 0, Math.PI * 2);
          context.stroke();
        }
        if (isDismissed) {
          context.strokeStyle = accentAlpha(0.25);
          context.beginPath();
          context.moveTo(mx - 8, my - 8);
          context.lineTo(mx + 8, my + 8);
          context.stroke();
        }

        // The dwell ring: an arc that closes while the light rests on a mark.
        const dwell = dwellRef.current;
        if (!reducedMotion && dwell.id === mark.id && !isResolved) {
          const span = focusRef.current ? FOCUS_DWELL_MS : DWELL_MS;
          const t = Math.min(1, dwell.ms / span);
          context.strokeStyle = palette.bright;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(mx, my, 14, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
          context.stroke();
        }
      }

      // The scene closing: a wash of light over the whole panel.
      if (flashRef.current > 0) {
        const t = reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (now - flashRef.current) / 700));
        if (t < 1) {
          context.fillStyle = accentAlpha(0.25 * (1 - t));
          context.fillRect(0, 0, width, height);
        }
      }

      if (phaseRef.current === "dark") {
        context.fillStyle = palette.inkSoft;
        context.globalAlpha = 0.82;
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
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
        if (phaseRef.current === "sweeping") {
          const active = SCENES[sceneRef.current];
          const burn = (active.drain + (focusRef.current ? FOCUS_DRAIN : 0)) * dt;
          batteryRef.current = Math.max(0, batteryRef.current - burn);
          paintBattery(batteryRef.current);
          if (batteryRef.current <= 0) {
            goDark();
          } else {
            // Dwell: the nearest unresolved mark inside the beam accumulates.
            const radius = (focusRef.current ? FOCUS_RADIUS : BEAM_RADIUS) * 1;
            let target: SceneMark | null = null;
            let best = Infinity;
            for (const mark of active.marks) {
              if (resolvedRef.current.has(mark.id)) continue;
              const d = Math.hypot(
                mark.x - beamRef.current.x,
                mark.y - beamRef.current.y
              );
              if (d <= radius * 0.9 && d < best) {
                best = d;
                target = mark;
              }
            }
            const dwell = dwellRef.current;
            if (!target) {
              dwellRef.current = { id: null, ms: 0 };
            } else if (dwell.id !== target.id) {
              dwellRef.current = { id: target.id, ms: 0 };
            } else {
              const span = focusRef.current ? FOCUS_DWELL_MS : DWELL_MS;
              const next = dwell.ms + dt * 1000;
              dwellRef.current = { id: target.id, ms: next };
              if (next >= span) {
                dwellRef.current = { id: null, ms: 0 };
                resolveMark(target);
              }
            }
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
  }, [goDark, paintBattery, reducedMotion, resolveMark]);

  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, sceneIndex, phase, resolved, logged, dismissed]);

  // The rain bed runs only while the torch is lit.
  useEffect(() => {
    if (phase !== "sweeping" || audio.muted) return;
    audio.startDrone(58, "triangle");
    return () => audio.stopDrone();
  }, [audio, phase]);

  const over = phase === "dark" || phase === "done";

  const status = useMemo(() => {
    if (phase === "done") return `All three scenes are in the file. ${score} points.`;
    if (phase === "dark") return `The cell died with ${logged.length} logged. ${score} points banked.`;
    if (phase === "paused") return "Torch off. Nothing is moving.";
    if (phase === "summary") return `${scene.title} closed. ${logged.length} entries on the board.`;
    return `${logged.length} of ${needed} logged — hold the beam on a mark to read it, then decide.`;
  }, [logged.length, needed, phase, scene.title, score]);

  return (
    <div
      data-sim-state={phase}
      data-scene={sceneIndex + 1}
      data-logged={logged.length}
      data-resolved={resolved.length}
      data-flashlight-score={score}
      data-battery={Math.round(battery)}
      className={`flex flex-col gap-3 ${!reducedMotion && phase === "dark" ? "bat-jolt" : ""}`}
      onPointerDownCapture={markPress}
    >
      <BatmanKeyframes />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          scene <span className="text-accent">{sceneIndex + 1}</span>/{SCENES.length}
        </span>
        <span>
          logged <span className="text-accent">{logged.length}</span>/{needed}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "bat-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          run <span className="text-accent">x{streak}</span>
        </span>
        <span className="flex items-center gap-1.5">
          charge{" "}
          <span ref={batteryTextRef} className="tabular-nums text-accent">
            100%
          </span>
          <span ref={batteryGlyphRef} aria-hidden className="text-accent/70">
            ▮▮▮▮▮
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <BatmanMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {!over && (
            <BatmanChip onClick={togglePause} label={phase === "paused" ? "Resume" : "Pause"}>
              {phase === "paused" ? "resume" : "pause"}
            </BatmanChip>
          )}
        </span>
      </div>

      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={batteryBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      <p className="text-[11px] normal-case leading-relaxed text-white/60">
        <span className="uppercase tracking-[0.14em] text-accent">{scene.title}</span> — {scene.brief}
      </p>

      <div
        ref={surfaceRef}
        onPointerMove={onPointerMove}
        onPointerDown={() => setFocus(true)}
        onPointerUp={() => setFocus(false)}
        onPointerLeave={() => setFocus(false)}
        style={{ touchAction: "none" }}
        className="relative h-52 w-full cursor-crosshair overflow-hidden border border-accent/25 bg-ink/60 sm:h-64"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {scene.marks.map((mark) => {
          const isLogged = logged.includes(mark.id);
          const isDismissed = dismissed.includes(mark.id);
          const isResolved = resolved.includes(mark.id);
          return (
            <button
              key={mark.id}
              type="button"
              data-mark={mark.id}
              onFocus={() => aimAt(mark.x, mark.y)}
              onPointerEnter={() => aimAt(mark.x, mark.y)}
              onClick={() => tag(mark)}
              disabled={isLogged || isDismissed || phase !== "sweeping"}
              aria-label={
                isLogged
                  ? `${mark.label}, logged as evidence`
                  : isDismissed
                    ? `${mark.label}, dismissed`
                    : isResolved
                      ? `Tag ${mark.label} as evidence`
                      : `Unread mark at ${Math.round(mark.x * 100)} across, ${Math.round(mark.y * 100)} down`
              }
              style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
              className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
            >
              {isResolved && (
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-[0.14em] ${
                    isLogged
                      ? "text-accent-bright"
                      : isDismissed
                        ? "text-white/25 line-through"
                        : "text-white/60"
                  }`}
                >
                  {mark.label}
                  {isLogged ? " ✓" : isDismissed ? " ✕" : ""}
                </span>
              )}
            </button>
          );
        })}

        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-2 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "bat-float"
            }`}
          >
            {note.text}
          </p>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {!reducedMotion && phase === "sweeping" && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/40">
          <BatmanChip
            onClick={() => setFocus(!focused)}
            label={focused ? "Widen the beam" : "Narrow the beam"}
          >
            {focused ? "beam: narrow" : "beam: wide"}
          </BatmanChip>
          <span>arrows sweep · F narrows · narrow reads faster and burns faster</span>
        </div>
      )}

      {tell && (
        <p
          key={`tell-${shakeTick}-${sceneIndex}`}
          className={`border-l-2 pl-2 text-[11px] normal-case leading-relaxed ${
            tell.bad ? "border-accent-bright/70 text-white/70" : "border-accent/40 text-white/60"
          } ${reducedMotion || !tell.bad ? "" : "bat-shake"}`}
        >
          <span aria-hidden className="mr-1 text-accent">
            {tell.bad ? "✕" : "◆"}
          </span>
          {tell.text}
        </p>
      )}

      {(phase === "summary" || phase === "done") && (
        <ol
          className={`flex flex-col gap-1 border border-accent/25 bg-ink/60 p-2 text-[11px] normal-case leading-relaxed ${
            reducedMotion ? "" : "bat-rise"
          }`}
        >
          <li className="text-[9px] uppercase tracking-[0.18em] text-white/40">
            Case board — {scene.title}
          </li>
          {scene.marks
            .filter((mark) => loggedRef.current.has(mark.id))
            .map((mark) => (
              <li key={mark.id} className="text-accent">
                <span className="uppercase tracking-[0.08em]">{mark.label}</span> — {mark.detail}
              </li>
            ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="normal-case tracking-[0.06em] text-white/60">
          {status}
        </p>
        <span className="flex gap-2">
          {phase === "summary" && (
            <BatmanChip
              innerRef={advanceRef}
              bright
              onClick={() => {
                if (freshPress()) armScene(sceneRef.current + 1);
              }}
            >
              Next scene
            </BatmanChip>
          )}
          {over && (
            <BatmanChip
              innerRef={advanceRef}
              bright
              onClick={() => {
                if (freshPress()) restart();
              }}
            >
              {phase === "done" ? "Work the scenes again" : "Fresh cell"}
            </BatmanChip>
          )}
        </span>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function TheBatmanFlashlight({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="the-batman-flashlight-title"
      gameId="the-batman-flashlight"
      eyebrow="Search · judge"
      title="The flashlight"
      startLabel="Take the torch"
      stage
      howToPlay={{
        objective:
          "Log every real piece of evidence across three dark scenes before the torch battery dies.",
        controls: [
          { keys: "move", does: "aim the torch — the beam follows the pointer across the panel" },
          { keys: "← → ↑ ↓", does: "walk the beam without a pointer; tabbing to a mark also aims at it" },
          { keys: "F", does: "narrow the beam — it reads faster and burns charge faster" },
          { keys: "click", does: "file the mark under the beam once the light has read it" },
        ],
        tip: "A mark only says what it is after the beam rests on it for a beat, and tagging the room instead of the case costs 12% charge. Under reduced motion the room is dimly visible with no clock: the first press examines a mark, the second files it.",
      }}
      reference={{
        scene: "The Batman (2022) · the first crime scene, read by torchlight",
      }}
      onClose={onClose}
    >
      <CrimeScene />
    </SimulationShell>
  );
}
