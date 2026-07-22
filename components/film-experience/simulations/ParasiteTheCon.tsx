"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  CON_DISPLAY_ORDER,
  CON_STEPS,
  type ConChoice,
} from "@/components/film-experience/simulations/ParasiteConData";
import ParasiteConRoster from "@/components/film-experience/simulations/ParasiteConRoster";
import {
  ParasiteChip,
  ParasiteKeyframes,
  ParasiteMuteButton,
  useParasiteAudio,
} from "@/components/film-experience/simulations/ParasiteShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// A family of four talks its way into a rich household one post at a time. The
// order is still the whole con — each hire is what makes the next possible —
// but a placement now costs three decisions: who walks in next, what story
// they tell at the door, and (once the family is deep enough inside) what they
// say when the household starts cross-checking. Doubt is a meter, not a
// trapdoor: the house tolerates a slip or two, then stops tolerating anything.
//
// The dossier board (ParasiteConRoster) is on screen for the whole run and
// carries every fact the ordering puzzle needs, so a player who has never seen
// the film can reason the sequence out from what is written there.

const SCORE_ID = "parasite-con";
const SUSPICION_LIMIT = 100;
const WRONG_ORDER = 30;
const WRONG_COVER = 26;
const WRONG_ANSWER = 22;
/** Doubt drifts up while the family hesitates — but only later in the con,
 * and never far enough on its own to expose them. */
const DRIFT_FROM_POST = 1;
const DRIFT_CAP_PER_STEP = 22;
const MAX_PARTICLES = 90;

type Phase = "placing" | "paused" | "exposed" | "done";
type Step = "who" | "cover" | "question";
type RoomKey = (typeof CON_STEPS)[number]["room"];

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number };
type FloatNote = { id: number; text: string };

// Normalized house geometry. The map is a cutaway: the hill and its steps on
// the left, the four rooms of the house stacked two by two on the right.
const HOUSE = { x0: 0.34, y0: 0.24, x1: 0.95, y1: 0.76 } as const;
const ROOM_BOXES: Record<RoomKey, { x0: number; y0: number; x1: number; y1: number }> = {
  study: { x0: 0.375, y0: 0.29, x1: 0.63, y1: 0.485 },
  artRoom: { x0: 0.66, y0: 0.29, x1: 0.915, y1: 0.485 },
  garage: { x0: 0.375, y0: 0.525, x1: 0.63, y1: 0.72 },
  kitchen: { x0: 0.66, y0: 0.525, x1: 0.915, y1: 0.72 },
};
const ROOM_LABELS: Record<RoomKey, string> = {
  study: "study",
  artRoom: "art room",
  garage: "garage",
  kitchen: "kitchen",
};

const streakBonus = (streak: number) => 150 + Math.max(0, streak - 1) * 60;

function TheCon() {
  const [placed, setPlaced] = useState(0);
  const [phase, setPhase] = useState<Phase>("placing");
  const [step, setStep] = useState<Step>("who");
  const [pending, setPending] = useState<number | null>(null);
  const [suspicion, setSuspicion] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tell, setTell] = useState<{ text: string; bad: boolean } | null>(null);
  /** Whose dossier to highlight after a placement that could not go yet. */
  const [flagged, setFlagged] = useState<number | null>(null);
  const [note, setNote] = useState<FloatNote | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const audio = useParasiteAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const suspicionBarRef = useRef<HTMLDivElement>(null);
  const suspicionTextRef = useRef<HTMLSpanElement>(null);
  const suspicionGlyphRef = useRef<HTMLSpanElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  // Live values the paint loop reads without re-rendering React.
  const suspicionRef = useRef(0);
  const driftThisStepRef = useRef(0);
  const placedRef = useRef(0);
  const phaseRef = useRef<Phase>("placing");
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const cleanRef = useRef(true);
  const lastRef = useRef(0);
  const takenRef = useRef<{ room: RoomKey; at: number }[]>([]);
  const walkStartRef = useRef(-1);
  const doubtPulseRef = useRef(-1);
  const endStartRef = useRef(-1);
  const particlesRef = useRef<Particle[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paintSuspicion = useCallback((value: number) => {
    if (suspicionBarRef.current) {
      suspicionBarRef.current.style.width = `${Math.min(100, value).toFixed(1)}%`;
    }
    if (suspicionTextRef.current) {
      suspicionTextRef.current.textContent = `${Math.round(value)}%`;
    }
    if (suspicionGlyphRef.current) {
      const filled = Math.min(5, Math.round(value / 20));
      suspicionGlyphRef.current.textContent = `${"▮".repeat(filled)}${"▯".repeat(5 - filled)}`;
    }
  }, []);

  const spawnBurst = useCallback(
    (nx: number, ny: number, count: number) => {
      if (reducedMotion) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
          x: nx * canvas.width + (Math.random() - 0.5) * 26,
          y: ny * canvas.height + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 1.6,
          vy: -0.5 - Math.random() * 1.5,
          life: 1,
          size: 1 + Math.random() * 2.4,
        });
      }
    },
    [reducedMotion]
  );

  const finish = useCallback(
    (outcome: "exposed" | "done") => {
      endStartRef.current = performance.now();
      if (outcome === "done") {
        const composure = Math.round((SUSPICION_LIMIT - suspicionRef.current) * 4);
        scoreRef.current += composure;
        setScore(scoreRef.current);
        setNote({ id: performance.now(), text: `house taken +${composure}` });
        audio.win();
      } else {
        audio.fail();
      }
      recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => restartRef.current?.focus());
    },
    [audio]
  );

  const addSuspicion = useCallback(
    (amount: number) => {
      const next = Math.min(SUSPICION_LIMIT, suspicionRef.current + amount);
      suspicionRef.current = next;
      setSuspicion(Math.round(next));
      paintSuspicion(next);
      doubtPulseRef.current = performance.now();
      setShakeTick((tick) => tick + 1);
      return next >= SUSPICION_LIMIT;
    },
    [paintSuspicion]
  );

  const reset = useCallback(() => {
    suspicionRef.current = 0;
    driftThisStepRef.current = 0;
    placedRef.current = 0;
    scoreRef.current = 0;
    streakRef.current = 0;
    cleanRef.current = true;
    takenRef.current = [];
    particlesRef.current = [];
    walkStartRef.current = -1;
    doubtPulseRef.current = -1;
    endStartRef.current = -1;
    lastRef.current = performance.now();
    paintSuspicion(0);
    setPlaced(0);
    setScore(0);
    setStreak(0);
    setSuspicion(0);
    setPending(null);
    setStep("who");
    setTell(null);
    setFlagged(null);
    setNote(null);
    phaseRef.current = "placing";
    setPhase("placing");
  }, [paintSuspicion]);

  // Choosing who walks in next: the original order puzzle, now survivable.
  const chooseWho = useCallback(
    (index: number) => {
      if (phaseRef.current !== "placing" || step !== "who") return;
      audio.unlock();
      driftThisStepRef.current = 0;
      if (index !== placedRef.current) {
        cleanRef.current = false;
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        const chosen = CON_STEPS[index];
        const needed = CON_STEPS[placedRef.current];
        // Name the missing fact, then point at the dossier line that supplies
        // it — a wrong order should teach the chain, not just cost doubt.
        setTell({
          text: `${chosen.name} cannot go yet. ${chosen.blocked} Read what ${needed.name} makes possible once inside.`,
          bad: true,
        });
        setFlagged(index);
        if (addSuspicion(WRONG_ORDER)) finish("exposed");
        return;
      }
      setFlagged(null);
      audio.blip(placedRef.current);
      scoreRef.current += 60;
      setScore(scoreRef.current);
      setTell(null);
      setPending(index);
      setStep("cover");
    },
    [addSuspicion, audio, finish, step]
  );

  const advanceAfterQuestion = useCallback(
    (index: number) => {
      const step0 = CON_STEPS[index];
      takenRef.current = [...takenRef.current, { room: step0.room, at: performance.now() }];
      walkStartRef.current = performance.now();
      const box = ROOM_BOXES[step0.room];
      spawnBurst((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 16);

      if (cleanRef.current) {
        streakRef.current += 1;
        setStreak(streakRef.current);
      }
      const bonus = cleanRef.current ? streakBonus(streakRef.current) : 70;
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      setNote({
        id: performance.now(),
        text: cleanRef.current
          ? `${step0.role} — clean +${bonus}`
          : `${step0.role} — shaky +${bonus}`,
      });

      const next = placedRef.current + 1;
      placedRef.current = next;
      setPlaced(next);
      setPending(null);
      setStep("who");
      cleanRef.current = true;
      driftThisStepRef.current = 0;

      if (next >= CON_STEPS.length) {
        finish("done");
        return;
      }
      audio.clear();
    },
    [audio, finish, spawnBurst]
  );

  const chooseCover = useCallback(
    (choice: ConChoice) => {
      if (phaseRef.current !== "placing" || step !== "cover" || pending === null) return;
      audio.unlock();
      driftThisStepRef.current = 0;
      if (!choice.right) {
        cleanRef.current = false;
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        setTell({ text: choice.tell, bad: true });
        if (addSuspicion(WRONG_COVER)) finish("exposed");
        return;
      }
      audio.ok();
      scoreRef.current += 110;
      setScore(scoreRef.current);
      setTell({ text: choice.tell, bad: false });
      if (CON_STEPS[pending].question) {
        setStep("question");
        return;
      }
      advanceAfterQuestion(pending);
    },
    [addSuspicion, advanceAfterQuestion, audio, finish, pending, step]
  );

  const chooseAnswer = useCallback(
    (choice: ConChoice) => {
      if (phaseRef.current !== "placing" || step !== "question" || pending === null) return;
      audio.unlock();
      driftThisStepRef.current = 0;
      if (!choice.right) {
        cleanRef.current = false;
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        setTell({ text: choice.tell, bad: true });
        if (addSuspicion(WRONG_ANSWER)) finish("exposed");
        return;
      }
      audio.ok();
      scoreRef.current += 130;
      setScore(scoreRef.current);
      setTell({ text: choice.tell, bad: false });
      advanceAfterQuestion(pending);
    },
    [addSuspicion, advanceAfterQuestion, audio, finish, pending, step]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "placing") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "placing";
      setPhase("placing");
    }
  }, []);

  // The house map: hill, steps, cutaway rooms, the figure walking up, doubt
  // wash, particles, and the closing beat. One loop; reduced motion paints a
  // still frame on every state change instead.
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

      const px = (n: number) => n * width;
      const py = (n: number) => n * height;

      // The city below and behind: the district the family climbs out of.
      context.fillStyle = accentAlpha(0.1);
      for (let i = 0; i < 54; i += 1) {
        const bx = px(0.015 + ((i * 7) % 30) / 100);
        const by = py(0.32 + (((i * 13) % 44) / 100));
        context.fillRect(bx, by, 2, 2.5);
      }
      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      for (let i = 0; i < 6; i += 1) {
        const bx = px(0.02 + i * 0.05);
        const bh = py(0.16 + ((i * 17) % 13) / 100);
        context.strokeRect(bx, py(0.94) - bh, px(0.042), bh);
      }

      // The hill: a stepped climb from the lower-left up to the house gate.
      context.strokeStyle = accentAlpha(0.16);
      context.lineWidth = 1;
      const steps = 9;
      for (let i = 0; i < steps; i += 1) {
        const t = i / steps;
        const sx = px(0.03 + t * 0.29);
        const sy = py(0.93 - t * 0.16);
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(sx + px(0.032), sy);
        context.lineTo(sx + px(0.032), sy - py(0.022));
        context.stroke();
      }
      // The semi-basement window at the bottom of the hill.
      context.strokeStyle = accentAlpha(0.28);
      context.strokeRect(px(0.03), py(0.86), px(0.05), py(0.05));

      // The house shell.
      context.strokeStyle = accentAlpha(0.45);
      context.lineWidth = 1.5;
      context.strokeRect(px(HOUSE.x0), py(HOUSE.y0), px(HOUSE.x1 - HOUSE.x0), py(HOUSE.y1 - HOUSE.y0));
      // The lawn line under it.
      context.strokeStyle = accentAlpha(0.2);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(px(0.28), py(HOUSE.y1));
      context.lineTo(px(0.98), py(HOUSE.y1));
      context.stroke();

      // Rooms: outline while vacant, filled with a top-down sweep once taken.
      context.font = "9px monospace";
      (Object.keys(ROOM_BOXES) as RoomKey[]).forEach((key) => {
        const box = ROOM_BOXES[key];
        const x = px(box.x0);
        const y = py(box.y0);
        const w = px(box.x1 - box.x0);
        const h = py(box.y1 - box.y0);
        const taken = takenRef.current.find((entry) => entry.room === key);
        context.strokeStyle = accentAlpha(taken ? 0.7 : 0.22);
        context.strokeRect(x, y, w, h);
        if (taken) {
          const fill = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - taken.at) / 520));
          context.fillStyle = accentAlpha(0.16 + 0.1 * fill);
          context.fillRect(x, y, w, h * fill);
          // A lit window inside each captured room.
          context.fillStyle = palette.bright;
          context.globalAlpha = 0.5 + 0.35 * fill;
          context.fillRect(x + w * 0.72, y + h * 0.2, w * 0.16, h * 0.22);
          context.globalAlpha = 1;
        }
        context.fillStyle = accentAlpha(taken ? 0.85 : 0.3);
        context.fillText(ROOM_LABELS[key], x + 4, y + h - 5);
      });

      // The figure walking up the steps after a successful placement.
      const walkT =
        walkStartRef.current < 0
          ? -1
          : reducedMotion
            ? 1
            : Math.min(1, Math.max(0, (now - walkStartRef.current) / 900));
      if (walkT >= 0) {
        const fx = px(0.05 + walkT * 0.27);
        const fy = py(0.93 - walkT * 0.16) - 4 - (reducedMotion ? 0 : Math.abs(Math.sin(walkT * 14)) * 2);
        context.fillStyle = palette.bright;
        context.globalAlpha = walkT < 1 ? 1 : 0.35;
        context.beginPath();
        context.arc(fx, fy - 6, 2.6, 0, Math.PI * 2);
        context.fill();
        context.fillRect(fx - 1.6, fy - 3.5, 3.2, 7);
        context.globalAlpha = 1;
      }

      // Doubt: a wash over the house that thickens with suspicion, plus a
      // ripple out of the front hall whenever a slip lands.
      const doubt = suspicionRef.current / SUSPICION_LIMIT;
      if (doubt > 0.02) {
        context.fillStyle = accentAlpha(0.03 + doubt * 0.09);
        context.fillRect(px(HOUSE.x0), py(HOUSE.y0), px(HOUSE.x1 - HOUSE.x0), py(HOUSE.y1 - HOUSE.y0));
      }
      if (doubtPulseRef.current > 0 && !reducedMotion) {
        // Clamped: a trailing rAF timestamp must not make the radius negative.
        const t = Math.max(0, (now - doubtPulseRef.current) / 700);
        if (t < 1) {
          context.strokeStyle = accentAlpha(0.5 * (1 - t));
          context.lineWidth = 2;
          context.beginPath();
          context.arc(px(0.34), py(0.76), 12 + t * px(0.42), 0, Math.PI * 2);
          context.stroke();
        }
      }
      // High doubt makes the windows throb — a second, non-color signal.
      if (doubt > 0.6 && !reducedMotion) {
        context.strokeStyle = accentAlpha(0.3 + 0.3 * Math.abs(Math.sin(now / 260)));
        context.lineWidth = 1;
        context.strokeRect(
          px(HOUSE.x0) - 3,
          py(HOUSE.y0) - 3,
          px(HOUSE.x1 - HOUSE.x0) + 6,
          py(HOUSE.y1 - HOUSE.y0) + 6
        );
      }

      // Particles: motes lifting out of a room the moment it is taken.
      if (!reducedMotion) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.02;
          p.life -= 0.018;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(p.life * 0.8);
          context.fillRect(p.x, p.y, p.size, p.size);
        }
      }

      // The closing beat: exposure drops the house into the dark; the clean
      // finish lights every window at once.
      if (endStartRef.current > 0) {
        const t = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - endStartRef.current) / 900));
        if (phaseRef.current === "exposed") {
          context.fillStyle = palette.inkSoft;
          context.globalAlpha = t * 0.72;
          context.fillRect(0, 0, width, height);
          context.globalAlpha = 1;
        } else if (phaseRef.current === "done") {
          context.strokeStyle = accentAlpha(0.25 + 0.5 * t);
          context.lineWidth = 2 + t * 2;
          context.strokeRect(
            px(HOUSE.x0),
            py(HOUSE.y0),
            px(HOUSE.x1 - HOUSE.x0),
            py(HOUSE.y1 - HOUSE.y0)
          );
        }
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
        // Doubt drift: only from the second post onward, only while a story is
        // being chosen, and capped so hesitation alone never exposes anyone.
        if (
          phaseRef.current === "placing" &&
          step !== "who" &&
          placedRef.current >= DRIFT_FROM_POST &&
          driftThisStepRef.current < DRIFT_CAP_PER_STEP
        ) {
          const rate = 1.3 + placedRef.current * 0.45;
          const amount = rate * dt;
          driftThisStepRef.current += amount;
          suspicionRef.current = Math.min(SUSPICION_LIMIT, suspicionRef.current + amount);
          paintSuspicion(suspicionRef.current);
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [paintSuspicion, reducedMotion, step]);

  // Reduced motion has no loop, so every state change repaints once.
  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, placed, phase, suspicion, step]);

  const activeStep = pending === null ? null : CON_STEPS[pending];
  const options: readonly ConChoice[] | null =
    step === "cover" && activeStep
      ? activeStep.covers
      : step === "question" && activeStep?.question
        ? activeStep.question.options
        : null;

  // 1-3 pick the visible options; the buttons stay the real controls.
  useEffect(() => {
    if (!options || phase !== "placing") return;
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= options.length) return;
      event.preventDefault();
      if (step === "cover") chooseCover(options[index]);
      else chooseAnswer(options[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseAnswer, chooseCover, options, phase, step]);

  const remaining = useMemo(
    () => CON_DISPLAY_ORDER.filter((index) => index >= placed),
    [placed]
  );

  const status = useMemo(() => {
    if (phase === "exposed")
      return `Cover blown at ${placed} of ${CON_STEPS.length} posts. ${score} points.`;
    if (phase === "done") return `Every post filled. The house is theirs — ${score} points.`;
    if (phase === "paused") return "Held. Nobody is saying anything.";
    if (step === "who")
      return placed === 0
        ? "Read the dossiers, pick who walks in first, then choose the story they tell at the door."
        : `${placed} of ${CON_STEPS.length} posts held — check the dossiers: whose way in is open now?`;
    if (step === "cover") return activeStep?.coverPrompt ?? "";
    return activeStep?.question?.prompt ?? "";
  }, [activeStep, phase, placed, score, step]);

  const over = phase === "exposed" || phase === "done";

  return (
    <div
      data-sim-state={phase}
      data-placed={placed}
      data-con-step={step}
      data-con-score={score}
      data-con-suspicion={suspicion}
      className="flex flex-col gap-3"
    >
      <ParasiteKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          post <span className="text-accent">{Math.min(placed + 1, CON_STEPS.length)}</span>/
          {CON_STEPS.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          clean streak <span className="text-accent">x{streak}</span>
        </span>
        <span className="flex items-center gap-1.5">
          doubt <span ref={suspicionTextRef} className="text-accent">0%</span>
          <span ref={suspicionGlyphRef} aria-hidden className="text-accent/70">
            ▯▯▯▯▯
          </span>
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

      {/* Doubt meter */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={suspicionBarRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
      </div>

      {/* The house map */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-44 w-full border border-accent/25 bg-ink/60 sm:h-56"
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
        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {/* The posts themselves: what is held, and by whom. */}
      <ol className="flex flex-col gap-1 border border-accent/25 bg-ink/60 p-2 text-[11px] normal-case leading-relaxed">
        {CON_STEPS.map((entry, index) => {
          const isPlaced = index < placed;
          return (
            <li
              key={entry.name}
              className={`${isPlaced ? "text-accent" : "text-white/30"} ${
                isPlaced && index === placed - 1 && !reducedMotion ? "para-rise" : ""
              }`}
            >
              <span className="tabular-nums">{index + 1}.</span>{" "}
              {isPlaced ? (
                <>
                  <span className="uppercase tracking-[0.08em]">{entry.name}</span> as {entry.role} —{" "}
                  {entry.door}
                </>
              ) : (
                <span aria-label="vacant post">— vacant —</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* The dossiers, on screen the whole time — the ordering puzzle is meant
        * to be read off these rather than remembered from the film. */}
      <ParasiteConRoster
        placed={placed}
        pending={pending}
        flagged={flagged}
        reducedMotion={reducedMotion}
      />

      {/* The decision panel */}
      {!over && phase !== "paused" && (
        <div
          key={`${step}-${placed}-${shakeTick}`}
          className={reducedMotion ? "flex flex-col gap-2" : "flex flex-col gap-2 para-rise"}
        >
          {step === "who" ? (
            <>
              <p className="text-[11px] normal-case leading-relaxed text-white/70">
                {CON_STEPS[Math.min(placed, CON_STEPS.length - 1)].brief}
              </p>
              <div className="flex flex-wrap gap-2">
                {remaining.map((index) => {
                  const entry = CON_STEPS[index];
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => chooseWho(index)}
                      aria-label={`Place ${entry.name} as ${entry.role}`}
                      className="para-press flex flex-col items-start gap-0.5 border border-accent/30 px-3 py-1.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="text-[11px] uppercase tracking-[0.1em]">{entry.name}</span>
                      <span className="text-[10px] normal-case tracking-normal text-white/45">
                        {entry.family} · as {entry.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] normal-case leading-relaxed text-white/80">
                <span className="uppercase tracking-[0.1em] text-accent">
                  {activeStep?.name}
                </span>{" "}
                — {step === "cover" ? activeStep?.coverPrompt : activeStep?.question?.prompt}
              </p>
              <div className="flex flex-col gap-1.5">
                {options?.map((choice, index) => (
                  <button
                    key={choice.text}
                    type="button"
                    onClick={() => (step === "cover" ? chooseCover(choice) : chooseAnswer(choice))}
                    className="para-press flex items-start gap-2 border border-accent/30 px-3 py-2 text-left text-[11px] normal-case leading-relaxed transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span aria-hidden className="text-accent/60">
                      {index + 1}
                    </span>
                    <span>&ldquo;{choice.text}&rdquo;</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
                keys 1–3 pick a line
              </p>
            </>
          )}
        </div>
      )}

      {tell && (
        <p
          key={`tell-${shakeTick}-${placed}-${step}`}
          className={`border-l-2 pl-2 text-[11px] normal-case leading-relaxed ${
            tell.bad ? "border-accent-bright/70 text-white/70" : "border-accent/40 text-white/55"
          } ${reducedMotion || !tell.bad ? "" : "para-shake"}`}
        >
          <span aria-hidden className="mr-1 text-accent">
            {tell.bad ? "✕" : "✓"}
          </span>
          {tell.text}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="normal-case tracking-[0.08em] text-white/55">
          {status}
        </p>
        {over && (
          <ParasiteChip innerRef={restartRef} onClick={reset} bright>
            Run it again
          </ParasiteChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ParasiteTheCon({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="parasite-con-title"
      gameId="parasite-con"
      eyebrow="Household infiltration"
      title="The con"
      startLabel="Work the door"
      stage
      howToPlay={{
        objective:
          "Get all four members of one family hired into the same wealthy household — four posts, in the only order that works — without the doubt meter reaching full.",
        controls: [
          { keys: "read", does: "the dossier board stays on screen: who each person is, what the house will believe, and what has to be true before they can walk in" },
          { keys: "click", does: "pick who walks in next, then the line they tell at the door" },
          { keys: "1 / 2 / 3", does: "choose one of the offered lines from the keyboard" },
          { keys: "pause", does: "hold the con between decisions" },
        ],
        tip: "No knowledge of the film is needed. Every post except the first depends on somebody already being inside — match each person's “way in” against what the people already hired make possible. A wrong name, cover story, or answer adds doubt and resets the clean streak.",
      }}
      reference={{
        quote: "Jessica, only child, Illinois.",
        scene: "Parasite (2019) · the jingle that gets the second Kim through the door",
      }}
      onClose={onClose}
    >
      <TheCon />
    </SimulationShell>
  );
}
