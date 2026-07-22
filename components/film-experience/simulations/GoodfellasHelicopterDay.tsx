"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  GoodfellasKeyframes,
  GoodfellasMeter,
  GoodfellasMuteButton,
  withAlpha,
} from "@/components/film-experience/simulations/GoodfellasShared";
import {
  BLOCKS,
  DANGER,
  DAY_SECONDS,
  PARANOIA_PUSH,
  TASKS,
  blockAt,
  dayScore,
  paranoiaAt,
  rateDay,
  type TaskId,
} from "@/components/film-experience/simulations/GoodfellasHelicopterTasks";
import {
  createGoodfellasSimAudio,
  type GoodfellasSimAudio,
} from "@/components/film-experience/simulations/GoodfellasSimAudio";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Sunday, May 11, 1980. The sauce, the guns, the drop — and the helicopter
 * that may or may not be following you. Four clocks, four different kinds of
 * attention, and a paranoia curve that speeds all of them at once.
 *
 * The point is the multitasking, so no two tasks are serviced the same way: the
 * sauce wants repeated taps, the guns want a sustained hold, the drop is a
 * two-move sequence with dead time in the middle, and the sky is a timing call.
 * Nothing fails on a single slip: a meter entering the danger band is a warning
 * that costs the composure streak, and only a full meter ends the day.
 */

const SCORE_ID = "goodfellas-helicopter";

const STIR_STEP = 0.42; // meter knocked down per stir
const WRAP_RATE = 0.85; // meter drained per second while wrapping
const PACK_SECONDS = 1.15; // dead time between packing and sending
const SWEEP_SECONDS = 2.2; // one pass of the radar sweep
const SWEEP_WINDOW = 0.09; // how close the sweep must be to the contact
// Longest step the day takes in one frame: caps the catch-up after a stall
// so a slow machine slows the clocks rather than jumping a meter to full.
const MAX_STEP = 0.1;
const SKY_SECTORS = ["West", "Overhead", "East"] as const;

type Phase = "running" | "paused" | "failed" | "wrapped";
type DropStage = "idle" | "packing" | "ready";

type FloatNote = { id: number; text: string };

type Needs = Record<TaskId, number>;

const emptyNeeds = (): Needs => ({ sauce: 0, guns: 0, drop: 0, sky: 0 });

function HelicopterDay() {
  const reducedMotion = useReducedMotion();
  const [audio] = useState<GoodfellasSimAudio>(createGoodfellasSimAudio);
  const [muted, setMuted] = useState(false);

  const [phase, setPhase] = useState<Phase>("running");
  const [needs, setNeeds] = useState<Needs>(emptyNeeds);
  const [paranoia, setParanoia] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [serviced, setServiced] = useState(0);
  const [nearMisses, setNearMisses] = useState(0);
  const [unlocked, setUnlocked] = useState<TaskId[]>(["sauce"]);
  const [dropStage, setDropStage] = useState<DropStage>("idle");
  const [gunsHeld, setGunsHeld] = useState(false);
  const [skyOpen, setSkyOpen] = useState(false);
  const [skySector, setSkySector] = useState(0);
  const [failedTask, setFailedTask] = useState<TaskId | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [banked, setBanked] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // Live sim values in refs so the loop never re-renders React per frame.
  const needsRef = useRef<Needs>(emptyNeeds());
  const dangerRef = useRef<Record<TaskId, boolean>>({
    sauce: false,
    guns: false,
    drop: false,
    sky: false,
  });
  const elapsedRef = useRef(0);
  const lastRef = useRef(0);
  const uiClockRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const servicedRef = useRef(0);
  const nearMissRef = useRef(0);
  const unlockedRef = useRef<Set<TaskId>>(new Set<TaskId>(["sauce"]));
  const gunsHoldRef = useRef(false);
  const dropStageRef = useRef<DropStage>("idle");
  const packTimerRef = useRef(0);
  const skyOpenRef = useRef(false);
  const sweepPos = useRef(0);
  const sweepDirRef = useRef(1);
  const contactRef = useRef(0.5);
  const phaseRef = useRef<Phase>("running");
  const blockRef = useRef(BLOCKS[0].label);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const note = useCallback((text: string) => {
    setFloatNote({ id: performance.now(), text });
  }, []);

  const onToggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    audio.unlock();
  };

  useEffect(() => () => audio.dispose(), [audio]);

  /** Bank a serviced task: score, streak, cue. */
  const credit = useCallback(
    (id: TaskId, points: number) => {
      servicedRef.current += 1;
      setServiced(servicedRef.current);
      scoreRef.current += points;
      setScore(scoreRef.current);
      streakRef.current += 1;
      setStreak(streakRef.current);
      if (streakRef.current > bestStreakRef.current) {
        bestStreakRef.current = streakRef.current;
        setBestStreak(bestStreakRef.current);
      }
      audio.tick(streakRef.current);
      const label = TASKS.find((task) => task.id === id)?.label ?? "It";
      note(`${label.toLowerCase()} handled${streakRef.current >= 4 ? ` · ${streakRef.current} in a row` : ""}`);
    },
    [audio, note]
  );

  const openSky = useCallback(() => {
    contactRef.current = 0.16 + Math.random() * 0.68;
    sweepPos.current = 0;
    sweepDirRef.current = 1;
    skyOpenRef.current = true;
    setSkyOpen(true);
    setSkySector(Math.min(2, Math.floor(contactRef.current * 3)));
  }, []);

  const closeSky = useCallback(() => {
    skyOpenRef.current = false;
    setSkyOpen(false);
  }, []);

  const clearSky = useCallback(
    (hit: boolean) => {
      closeSky();
      if (hit) {
        // Seeing nothing up there settles the nerves: the sky clears outright
        // and the other meters get a small breather. The day's own clock is
        // never wound back — the summary depends on it only moving forward.
        needsRef.current = {
          ...needsRef.current,
          sky: 0,
          sauce: Math.max(0, needsRef.current.sauce - 0.1),
          guns: Math.max(0, needsRef.current.guns - 0.1),
          drop: Math.max(0, needsRef.current.drop - 0.1),
        };
        setNeeds({ ...needsRef.current });
        credit("sky", 26);
        return;
      }
      needsRef.current = {
        ...needsRef.current,
        sky: Math.min(0.98, needsRef.current.sky + 0.16),
      };
      setNeeds({ ...needsRef.current });
      streakRef.current = 0;
      setStreak(0);
      audio.warn();
      note("missed it · still up there");
    },
    [closeSky, credit, audio, note]
  );

  const service = useCallback(
    (id: TaskId) => {
      if (phaseRef.current !== "running" || !unlockedRef.current.has(id)) return;
      audio.unlock();
      // Dispatch on how the task is serviced, not on which task it is: each id
      // maps 1:1 to a TaskKind and the behaviour belongs to the kind.
      const kind = TASKS.find((task) => task.id === id)?.kind;
      if (kind === "tap") {
        const next = Math.max(0, needsRef.current.sauce - STIR_STEP);
        needsRef.current = { ...needsRef.current, sauce: next };
        setNeeds({ ...needsRef.current });
        if (next <= 0) credit("sauce", 14);
        else audio.tick(0);
        return;
      }
      if (kind === "sequence") {
        if (dropStageRef.current === "idle") {
          dropStageRef.current = "packing";
          packTimerRef.current = PACK_SECONDS;
          setDropStage("packing");
          audio.tick(0);
        } else if (dropStageRef.current === "ready") {
          dropStageRef.current = "idle";
          setDropStage("idle");
          needsRef.current = { ...needsRef.current, drop: 0 };
          setNeeds({ ...needsRef.current });
          credit("drop", 22);
        }
        return;
      }
      if (kind === "timing") {
        if (!skyOpenRef.current) {
          openSky();
          audio.tick(0);
          return;
        }
        if (reducedMotion) return; // the sector buttons resolve it instead
        clearSky(Math.abs(sweepPos.current - contactRef.current) <= SWEEP_WINDOW);
      }
    },
    [audio, credit, openSky, clearSky, reducedMotion]
  );

  const pickSector = useCallback(
    (index: number) => {
      if (phaseRef.current !== "running" || !skyOpenRef.current) return;
      audio.unlock();
      clearSky(index === Math.min(2, Math.floor(contactRef.current * 3)));
    },
    [audio, clearSky]
  );

  const setGunsHold = useCallback(
    (held: boolean) => {
      if (held) {
        if (phaseRef.current !== "running" || !unlockedRef.current.has("guns")) return;
        audio.unlock();
      }
      gunsHoldRef.current = held;
      setGunsHeld(held);
    },
    [audio]
  );

  const finish = useCallback(
    (madeIt: boolean, lost: TaskId | null) => {
      audio.setRotor(0);
      const survived = elapsedRef.current;
      const total = dayScore(survived, servicedRef.current, bestStreakRef.current, madeIt);
      setBanked(total);
      recordSimulationScore(SCORE_ID, total);
      setFailedTask(lost);
      gunsHoldRef.current = false;
      setGunsHeld(false);
      skyOpenRef.current = false;
      setSkyOpen(false);
      if (madeIt) audio.fanfare();
      else audio.fail();
      phaseRef.current = madeIt ? "wrapped" : "failed";
      setPhase(madeIt ? "wrapped" : "failed");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      audio.setRotor(0);
      gunsHoldRef.current = false;
      setGunsHeld(false);
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      phaseRef.current = "running";
      setPhase("running");
    }
  }, [audio]);

  const restart = useCallback(() => {
    needsRef.current = emptyNeeds();
    dangerRef.current = { sauce: false, guns: false, drop: false, sky: false };
    elapsedRef.current = 0;
    lastRef.current = 0;
    scoreRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    servicedRef.current = 0;
    nearMissRef.current = 0;
    unlockedRef.current = new Set<TaskId>(["sauce"]);
    gunsHoldRef.current = false;
    dropStageRef.current = "idle";
    packTimerRef.current = 0;
    skyOpenRef.current = false;
    setNeeds(emptyNeeds());
    setParanoia(0);
    setSeconds(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setServiced(0);
    setNearMisses(0);
    setUnlocked(["sauce"]);
    setDropStage("idle");
    setGunsHeld(false);
    setSkyOpen(false);
    setFailedTask(null);
    setWarning(null);
    setBanked(0);
    phaseRef.current = "running";
    setPhase("running");
  }, []);

  // -------------------------------------------------------------------
  // The day: one loop drives every clock and paints the sky.
  // -------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    let width = 0;
    let height = 0;
    const size = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    size();

    const advance = (dt: number) => {
      elapsedRef.current += dt;
      const elapsed = elapsedRef.current;
      const fear = paranoiaAt(elapsed);
      const multiplier = 1 + fear * PARANOIA_PUSH;

      // New work lands on the pile as the day goes on.
      for (const task of TASKS) {
        if (elapsed >= task.unlockAt && !unlockedRef.current.has(task.id)) {
          unlockedRef.current.add(task.id);
          setUnlocked([...unlockedRef.current]);
          audio.warn();
          note(`${task.label.toLowerCase()} · ${task.hint}`);
        }
      }

      const block = blockAt(elapsed).label;
      if (block !== blockRef.current) {
        blockRef.current = block;
        note(block);
      }

      // Every unlocked meter fills; paranoia speeds all of them together.
      const next = { ...needsRef.current };
      let lost: TaskId | null = null;
      for (const task of TASKS) {
        if (!unlockedRef.current.has(task.id)) continue;
        next[task.id] = Math.min(1, next[task.id] + task.rate * multiplier * dt);
        if (next[task.id] >= 1) lost = task.id;
      }

      // Wrapping the guns is a sustained hold, not a press.
      if (gunsHoldRef.current && unlockedRef.current.has("guns")) {
        const before = next.guns;
        next.guns = Math.max(0, next.guns - WRAP_RATE * dt);
        if (before > 0 && next.guns <= 0) {
          gunsHoldRef.current = false;
          setGunsHeld(false);
          credit("guns", 18);
        }
      }

      // The drop's dead time: packed, then waiting, then sendable.
      if (dropStageRef.current === "packing") {
        packTimerRef.current -= dt;
        if (packTimerRef.current <= 0) {
          dropStageRef.current = "ready";
          setDropStage("ready");
          audio.clack();
        }
      }

      // The radar sweep runs while a scan is open (motion mode only).
      if (skyOpenRef.current && !reducedMotion) {
        sweepPos.current += (sweepDirRef.current * dt) / (SWEEP_SECONDS / 2);
        if (sweepPos.current >= 1) {
          sweepPos.current = 1;
          sweepDirRef.current = -1;
        } else if (sweepPos.current <= 0) {
          sweepPos.current = 0;
          sweepDirRef.current = 1;
        }
        if (sweepRef.current) {
          sweepRef.current.style.left = `${(sweepPos.current * 100).toFixed(2)}%`;
        }
      }

      // Near misses: crossing into the danger band costs composure, not the day.
      for (const task of TASKS) {
        const hot = next[task.id] >= DANGER;
        if (hot && !dangerRef.current[task.id]) {
          dangerRef.current[task.id] = true;
          nearMissRef.current += 1;
          setNearMisses(nearMissRef.current);
          streakRef.current = 0;
          setStreak(0);
          audio.warn();
          setWarning(`${task.label} is about to go.`);
        } else if (!hot && dangerRef.current[task.id]) {
          dangerRef.current[task.id] = false;
          setWarning(null);
        }
      }

      needsRef.current = next;
      scoreRef.current += (6 + fear * 10) * dt;
      audio.setRotor(fear * (unlockedRef.current.has("sky") ? 1 : 0.45));

      if (lost) {
        setNeeds({ ...next });
        setParanoia(fear);
        setSeconds(Math.floor(elapsed));
        finish(false, lost);
        return;
      }
      if (elapsed >= DAY_SECONDS) {
        setNeeds({ ...next });
        setParanoia(fear);
        setSeconds(Math.floor(DAY_SECONDS));
        finish(true, null);
      }
    };

    // Sampled on a slow cadence, not per draw call: reading the grade goes
    // through getComputedStyle, which forces a style recalc every time.
    let palette = getLiveThemePalette();
    let paletteSampledAt = 0;
    const acc = (alpha: number) => withAlpha(palette.accent, alpha);

    const draw = (now: number) => {
      if (!canvas || !context) return;
      if (now - paletteSampledAt > 400) {
        paletteSampledAt = now;
        palette = getLiveThemePalette();
      }
      const fear = paranoiaAt(elapsedRef.current);
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Haze bands: the sky pressing down as the day wears on.
      for (let band = 0; band < 3; band += 1) {
        context.fillStyle = acc(0.03 + band * 0.012 + fear * 0.03);
        const drift = reducedMotion ? 0 : ((now / (90 - band * 22)) % (width + 200)) - 100;
        context.beginPath();
        context.ellipse(
          drift + band * (width / 3),
          height * (0.2 + band * 0.2),
          width * 0.42,
          height * 0.09,
          0,
          0,
          Math.PI * 2
        );
        context.fill();
      }

      // The helicopter: closer, lower, and busier the worse the day gets.
      const closeness = 0.28 + fear * 0.72;
      const hx = width * (0.5 + (reducedMotion ? 0.18 : Math.sin(now / 2600) * 0.26));
      const hy = height * (0.4 - fear * 0.12);
      const scale = 12 + closeness * 26;
      context.save();
      context.translate(hx, hy);
      context.fillStyle = acc(0.55 + fear * 0.4);
      context.beginPath();
      context.ellipse(0, 0, scale * 0.5, scale * 0.26, 0, 0, Math.PI * 2);
      context.fill();
      context.fillRect(scale * 0.3, -scale * 0.06, scale * 0.7, scale * 0.1);
      context.beginPath();
      context.moveTo(scale, -scale * 0.05);
      context.lineTo(scale * 1.1, -scale * 0.32);
      context.lineTo(scale * 0.86, -scale * 0.05);
      context.closePath();
      context.fill();
      // Rotor: a blurred disc under motion, a plain bar when motion is off.
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      const spin = reducedMotion ? 0 : now / 26;
      for (let blade = 0; blade < 2; blade += 1) {
        const angle = spin + (blade * Math.PI) / 2;
        context.beginPath();
        context.moveTo(-Math.cos(angle) * scale * 0.95, -scale * 0.3);
        context.lineTo(Math.cos(angle) * scale * 0.95, -scale * 0.3);
        context.stroke();
      }
      context.restore();

      // The scan: an expanding ring from the ground while a sweep is open.
      if (skyOpenRef.current) {
        const t = reducedMotion ? 0.6 : (now % 1200) / 1200;
        context.strokeStyle = acc(0.5 * (1 - t));
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(width / 2, height, height * 0.2 + t * height * 0.9, 0, Math.PI * 2);
        context.stroke();
      }

      // The pot on the stove, bottom-left: the day's other clock, visible.
      const heat = needsRef.current.sauce;
      context.strokeStyle = acc(0.5);
      context.lineWidth = 1.5;
      context.strokeRect(14, height - 26, 30, 16);
      for (let i = 0; i < 3; i += 1) {
        const wobble = reducedMotion ? 0 : Math.sin(now / 300 + i) * 3;
        context.strokeStyle = acc(0.2 + heat * 0.6);
        context.beginPath();
        context.moveTo(20 + i * 9, height - 28);
        context.lineTo(20 + i * 9 + wobble, height - 28 - 8 - heat * 12);
        context.stroke();
      }
    };

    let frame = 0;
    // Paused and ended days are still frames behind an overlay or a summary:
    // paint a few more and then stop, so an abandoned dialog costs nothing.
    let settledFrames = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        if (phaseRef.current === "running") {
          const dt = lastRef.current ? Math.min(MAX_STEP, (now - lastRef.current) / 1000) : 0;
          lastRef.current = now;
          if (dt > 0) advance(dt);
        } else {
          lastRef.current = now;
        }
        settledFrames = phaseRef.current === "running" ? 0 : settledFrames + 1;
        if (phaseRef.current === "running" || settledFrames < 30) draw(now);
        if (now - uiClockRef.current > 90 && phaseRef.current === "running") {
          uiClockRef.current = now;
          setNeeds({ ...needsRef.current });
          setParanoia(paranoiaAt(elapsedRef.current));
          setSeconds(Math.floor(elapsedRef.current));
          setScore(scoreRef.current);
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
  }, [audio, credit, finish, note, reducedMotion]);

  // Hotkeys: digits service their task, and the guns key is a real hold.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePause();
        return;
      }
      const task = TASKS.find((candidate) => candidate.hotkey === event.key);
      if (!task) return;
      event.preventDefault();
      if (event.repeat) return;
      if (task.kind === "hold") setGunsHold(true);
      else service(task.id);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === "2") setGunsHold(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [service, setGunsHold, togglePause]);

  const summary = useMemo(
    () => rateDay(seconds, phase === "wrapped", bestStreak, nearMisses),
    [seconds, phase, bestStreak, nearMisses]
  );

  const status = useMemo(() => {
    if (phase === "wrapped")
      return `You made it to the end of the day. ${summary.grade} — ${summary.note} ${banked} points banked.`;
    if (phase === "failed") {
      const label = TASKS.find((task) => task.id === failedTask)?.label ?? "It";
      return `${label} got away from you at ${seconds}s. The day fell apart. ${banked} points banked.`;
    }
    if (phase === "paused") return "Held. Every clock is stopped.";
    if (warning) return warning;
    if (skyOpen)
      return reducedMotion
        ? "Something is up there. Call the sector it's sitting in."
        : "Scanning — call it when the sweep crosses the contact.";
    return `${blockAt(seconds).label} · ${seconds}s of ${DAY_SECONDS}s.`;
  }, [phase, summary, banked, failedTask, seconds, warning, skyOpen, reducedMotion]);

  const over = phase === "failed" || phase === "wrapped";
  const isUnlocked = (id: TaskId) => unlocked.includes(id);
  const dayFraction = Math.min(1, seconds / DAY_SECONDS);

  return (
    <div
      data-sim-state={phase}
      data-helicopter-seconds={seconds}
      data-helicopter-score={Math.round(score)}
      data-helicopter-tasks={unlocked.length}
      data-helicopter-streak={streak}
      data-helicopter-best-streak={bestStreak}
      data-helicopter-near-misses={nearMisses}
      data-helicopter-banked={banked}
      className="flex flex-col gap-3"
    >
      <GoodfellasKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        {/* Tabular figures on every live number: the HUD ticks several times a
            second and a reflowing row would shift the controls under it. */}
        <span className="tabular-nums">
          <span className="inline-block w-6 text-right">{seconds}</span>s / {DAY_SECONDS}s
        </span>
        <span>
          score{" "}
          <span
            key={Math.round(score / 25)}
            className="gf-anim-pop inline-block w-10 text-right tabular-nums text-accent"
          >
            {Math.round(score)}
          </span>
        </span>
        <span>
          streak <span className="text-accent">{streak}</span>
          {bestStreak > 0 && <span className="text-white/35"> (best {bestStreak})</span>}
        </span>
        <span>
          near misses <span className="text-accent">{nearMisses}</span>
        </span>
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
          <GoodfellasMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      {/* The sky */}
      <div className="relative h-28 overflow-hidden border border-accent/25 sm:h-40">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <p
          aria-hidden
          className="absolute left-2 top-2 text-[9px] uppercase tracking-[0.2em] text-white/45"
        >
          {blockAt(seconds).label}
        </p>
        {floatNote && (
          <p
            key={floatNote.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-2 bottom-2 text-center text-[10px] uppercase tracking-[0.16em] text-accent-bright ${
              reducedMotion ? "" : "gf-anim-float"
            }`}
          >
            {floatNote.text}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">held</p>
          </div>
        )}
      </div>

      {/* The day's clock */}
      <div className="flex items-center gap-3">
        <GoodfellasMeter
          label="The day"
          value={dayFraction}
          note={`${Math.round(dayFraction * 100)}% through`}
          reducedMotion={reducedMotion}
        />
        <GoodfellasMeter
          label="Paranoia"
          value={paranoia}
          note={paranoia > 0.7 ? "climbing" : "steady"}
          danger={paranoia > 0.7}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* The tasks */}
      <div className="flex flex-col gap-2">
        {TASKS.map((task) => {
          const live = isUnlocked(task.id);
          const need = needs[task.id];
          const hot = need >= DANGER;
          const label =
            task.kind === "sequence"
              ? dropStage === "packing"
                ? "Packing…"
                : dropStage === "ready"
                  ? "Send it"
                  : "Pack"
              : task.kind === "hold"
                ? gunsHeld
                  ? "Wrapping…"
                  : "Wrap"
                : task.kind === "timing"
                  ? skyOpen
                    ? reducedMotion
                      ? "Pick a sector"
                      : "Call it"
                    : "Scan"
                  : task.action;

          return (
            <div
              key={task.id}
              className={`flex flex-col gap-1 ${live ? "" : "opacity-35"} ${
                hot && !reducedMotion ? "gf-anim-shake" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`${task.label}: ${label} (key ${task.hotkey})`}
                  disabled={!live || over || (task.kind === "sequence" && dropStage === "packing")}
                  onClick={() => {
                    if (task.kind !== "hold") service(task.id);
                  }}
                  onPointerDown={(event) => {
                    if (task.kind !== "hold") return;
                    event.preventDefault();
                    setGunsHold(true);
                  }}
                  onPointerUp={() => task.kind === "hold" && setGunsHold(false)}
                  onPointerLeave={() => task.kind === "hold" && setGunsHold(false)}
                  onPointerCancel={() => task.kind === "hold" && setGunsHold(false)}
                  onKeyDown={(event) => {
                    if (task.kind !== "hold") return;
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      if (!event.repeat) setGunsHold(true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (task.kind === "hold" && (event.key === " " || event.key === "Enter")) {
                      setGunsHold(false);
                    }
                  }}
                  style={{ touchAction: "none" }}
                  className="w-28 shrink-0 border border-accent/30 px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.1em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 sm:w-32"
                >
                  {label}
                  <span className="text-white/35"> · {task.hotkey}</span>
                </button>
                <GoodfellasMeter
                  label={task.label}
                  value={live ? need : 0}
                  note={live ? (hot ? "going" : task.kind) : "not yet"}
                  danger={hot}
                  reducedMotion={reducedMotion}
                />
              </div>

              {/* The sky's own instrument: a sweep to time, or sectors to call. */}
              {task.kind === "timing" && live && skyOpen && !over && (
                <div className="sm:pl-[8.5rem]">
                  {reducedMotion ? (
                    <div className="flex flex-wrap gap-2">
                      {SKY_SECTORS.map((sector, index) => (
                        <button
                          key={sector}
                          type="button"
                          onClick={() => pickSector(index)}
                          className="border border-accent/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {sector}
                        </button>
                      ))}
                      <span className="self-center text-[10px] uppercase tracking-[0.12em] text-white/45">
                        contact reads {SKY_SECTORS[skySector].toLowerCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="relative h-4 border border-accent/25 bg-ink/60">
                      <div
                        aria-hidden
                        className="absolute inset-y-0 border-x border-accent/70 bg-accent/25"
                        style={{
                          left: `${Math.max(0, (contactRef.current - SWEEP_WINDOW) * 100)}%`,
                          width: `${SWEEP_WINDOW * 200}%`,
                        }}
                      />
                      <div
                        ref={sweepRef}
                        aria-hidden
                        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent-bright"
                        style={{ left: "0%" }}
                      />
                      <span className="absolute inset-0 grid place-items-center text-[9px] uppercase tracking-[0.16em] text-white/60">
                        call it on the contact
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day summary */}
      {over && (
        <div className={`border border-accent/30 bg-ink/60 p-3 ${reducedMotion ? "" : "gf-anim-rise"}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            {phase === "wrapped" ? "The day, in full" : "The day, cut short"} · {summary.grade}
          </p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{summary.note}</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>
              Held on for <span className="text-accent">{seconds}s</span>
            </li>
            <li>
              Tasks handled <span className="text-accent">{serviced}</span>
            </li>
            <li>
              Best streak <span className="text-accent">{bestStreak}</span>
            </li>
            <li>
              Near misses <span className="text-accent">{nearMisses}</span>
            </li>
            <li>
              Peak paranoia <span className="text-accent">{Math.round(paranoia * 100)}%</span>
            </li>
            <li className="text-accent">Banked {banked} points</li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/60 normal-case tracking-normal text-[11px]">
          {status}
        </p>
        {over && (
          <button
            ref={actionRef}
            type="button"
            onClick={restart}
            className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Run it back
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function GoodfellasHelicopterDay({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="goodfellas-helicopter-title"
      gameId="goodfellas-helicopter"
      eyebrow="The last good day"
      title="Helicopter day"
      startLabel="Start the day"
      stage
      howToPlay={{
        objective:
          "Get through the whole day with none of the four jobs — the sauce, the guns, the drop, the sky — left to run over.",
        controls: [
          { keys: "1", does: "stir the sauce; it wants repeated taps" },
          { keys: "2", does: "hold to wrap the guns, release to stop" },
          { keys: "3", does: "pack the drop, wait out the dead time, press again to send it" },
          { keys: "4", does: "call the sky as the sweep crosses the contact" },
          { keys: "P", does: "pause the day" },
        ],
        tip: "Jobs unlock as the day moves on, and paranoia speeds every clock at once. A meter reaching the danger band only breaks your composure streak; one filling all the way ends the day. With reduced motion the sky is called by picking a sector instead of timing the sweep.",
      }}
      reference={{
        scene:
          "Goodfellas (1990) · Sunday, May 11, 1980 — the sauce, the guns, the helicopter",
      }}
      onClose={onClose}
    >
      <HelicopterDay />
    </SimulationShell>
  );
}
