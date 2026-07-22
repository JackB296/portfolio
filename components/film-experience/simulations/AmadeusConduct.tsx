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
  AmadeusChip,
  AmadeusKeyframes,
  AmadeusMeter,
  AmadeusMuteButton,
  useAmadeusAudio,
} from "@/components/film-experience/simulations/AmadeusShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useCanvasAutoSize } from "@/lib/useCanvasSize";
import { useFreshPress } from "@/lib/useFreshPress";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * The podium. Your beat sets the tempo: the orchestra's pulse chases whatever
 * speed you are beating at, and the piece you hear speeds up and slows down
 * with your hand — self-rendered oscillators, an original line in the late
 * classical idiom, never film audio.
 *
 * Holding a tempo is only half of it. Each movement is marked (andante,
 * accelerando, rubato, presto) and the marked tempo moves under you, so you
 * must drive the orchestra to it. Meanwhile strings and winds drift apart on
 * their own and have to be cued back. Cohesion is the sum of all three:
 * your beat, the marked tempo, and the two sections staying together.
 */

const SCORE_ID = "amadeus-conduct";

type Movement = Readonly<{
  id: string;
  mark: string;
  instruction: string;
  beats: number;
  /** Marked tempo as a function of progress through the movement (0..1). */
  tempo: (t: number) => number;
  /** How fast each section's bias slides, per second. A section left
   * uncued takes roughly ten seconds to come fully adrift. */
  drift: number;
  /** Which sections wander in this movement. */
  wander: readonly ("strings" | "winds")[];
}>;

const MOVEMENTS: readonly Movement[] = [
  {
    id: "andante",
    mark: "Andante",
    instruction: "Hold them at a walking pace. Nothing else is asked of you yet.",
    beats: 16,
    tempo: () => 84,
    drift: 0.018,
    wander: ["strings"],
  },
  {
    id: "accelerando",
    mark: "Accelerando",
    instruction: "The marked tempo climbs. Beat faster, or the orchestra falls behind it.",
    beats: 20,
    tempo: (t) => 84 + t * 52,
    drift: 0.026,
    wander: ["strings", "winds"],
  },
  {
    id: "rubato",
    mark: "Rubato",
    instruction: "Give it back. Broaden through the middle, then take the tempo up again.",
    beats: 20,
    tempo: (t) => 108 - Math.sin(t * Math.PI) * 28,
    drift: 0.032,
    wander: ["winds"],
  },
  {
    id: "presto",
    mark: "Presto",
    instruction: "Everything at once. Both sections wander and the tempo will not wait.",
    beats: 24,
    tempo: (t) => 138 + Math.sin(t * Math.PI * 2) * 14,
    drift: 0.042,
    wander: ["strings", "winds"],
  },
];

// An ORIGINAL line in D major — ours, written for this game, played by
// oscillators. The melody rides the beat, so the tempo you set is the tempo
// you hear.
const MELODY = [
  "D5", "F#5", "A5", "F#5",
  "G5", "E5", "C#5", "E5",
  "F#5", "A5", "D6", "A5",
  "G5", "F#5", "E5", "D5",
] as const;
const WINDS = [
  "F#4", "A4", "D5", "A4",
  "B4", "G4", "E4", "G4",
  "A4", "D5", "F#5", "D5",
  "B4", "A4", "G4", "F#4",
] as const;
const BASS = ["D3", "A2", "B2", "A2"] as const;

const START_COHESION = 100;
const TEMPO_TOLERANCE = 0.1;
const ALIGN_TOLERANCE = 0.09;
const CUE_KEYS = { strings: "1", winds: "2" } as const;

type SectionId = "strings" | "winds";
type Phase = "conducting" | "paused" | "interval" | "done" | "failed";
type Judgment = { id: number; text: string; good: boolean };

type SectionState = {
  phase: number;
  bias: number;
  misalign: number;
};

function Podium() {
  const [movementIndex, setMovementIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("conducting");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [cues, setCues] = useState(0);
  const [beat, setBeat] = useState(0);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [tempoReadout, setTempoReadout] = useState({ marked: 84, actual: 84 });
  const reducedMotion = useReducedMotion();
  const audio = useAmadeusAudio();

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const cohesionBarRef = useRef<HTMLDivElement>(null);
  const cohesionTextRef = useRef<HTMLSpanElement>(null);
  const stringsBarRef = useRef<HTMLDivElement>(null);
  const stringsTextRef = useRef<HTMLSpanElement>(null);
  const windsBarRef = useRef<HTMLDivElement>(null);
  const windsTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("conducting");
  const movementRef = useRef(0);
  const cohesionRef = useRef(START_COHESION);
  const orchestraBpmRef = useRef(84);
  const playerBpmRef = useRef(84);
  const beatPhaseRef = useRef(0);
  const beatCountRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const lastTapRef = useRef(0);
  // Nothing moves until the conductor gives the downbeat: a movement that
  // started itself would punish a visitor for reading the instructions.
  const startedRef = useRef(false);
  const [waiting, setWaiting] = useState(true);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const cuesRef = useRef(0);
  const lastRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const pulseRef = useRef(-1);
  const flashRef = useRef<Record<SectionId, number>>({ strings: -1, winds: -1 });
  const judgeIdRef = useRef(0);
  const drawRef = useRef<(now: number) => void>(() => {});
  const sectionsRef = useRef<Record<SectionId, SectionState>>({
    strings: { phase: 0, bias: 0, misalign: 0 },
    winds: { phase: 0, bias: 0, misalign: 0 },
  });
  const { freshPress, markPress } = useFreshPress(`${phase}:${movementIndex}`);

  const movement = MOVEMENTS[movementIndex];

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    movementRef.current = movementIndex;
  }, [movementIndex]);

  const paintMeters = useCallback(() => {
    const cohesion = Math.max(0, Math.min(100, cohesionRef.current));
    if (cohesionBarRef.current) cohesionBarRef.current.style.width = `${cohesion.toFixed(1)}%`;
    if (cohesionTextRef.current) cohesionTextRef.current.textContent = `${Math.round(cohesion)}%`;
    // Mirrored onto the root so a test can read the run's health without
    // scraping the meter's rendered text.
    if (rootRef.current) rootRef.current.dataset.cohesion = String(Math.round(cohesion));
    const together = (id: SectionId) =>
      Math.max(0, 100 - (sectionsRef.current[id].misalign / 0.5) * 100);
    // Where a section sits is said in words as well as shown in a bar, so the
    // reading never depends on noticing a length or a colour.
    const drift = (id: SectionId) => {
      const state = sectionsRef.current[id];
      if (state.misalign <= ALIGN_TOLERANCE) return "with you";
      const lead = (state.phase - beatPhaseRef.current + 1) % 1;
      return lead < 0.5 ? "rushing" : "dragging";
    };
    const paint = (
      id: SectionId,
      bar: HTMLDivElement | null,
      text: HTMLSpanElement | null
    ) => {
      const value = together(id);
      if (bar) bar.style.width = `${value.toFixed(1)}%`;
      if (text) text.textContent = `${Math.round(value)}% ${drift(id)}`;
    };
    paint("strings", stringsBarRef.current, stringsTextRef.current);
    paint("winds", windsBarRef.current, windsTextRef.current);
  }, []);

  const endRun = useCallback(
    (outcome: "done" | "failed") => {
      if (outcome === "done") {
        const bonus = Math.round(cohesionRef.current * 5);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        audio.win();
      } else {
        audio.fail();
      }
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const armMovement = useCallback(
    (index: number) => {
      const start = MOVEMENTS[index].tempo(0);
      orchestraBpmRef.current = start;
      playerBpmRef.current = start;
      beatPhaseRef.current = 0;
      beatCountRef.current = 0;
      tapsRef.current = [];
      lastTapRef.current = performance.now();
      sectionsRef.current = {
        strings: { phase: 0, bias: 0, misalign: 0 },
        winds: { phase: 0, bias: 0, misalign: 0 },
      };
      trailRef.current = [];
      lastRef.current = performance.now();
      startedRef.current = false;
      setWaiting(true);
      movementRef.current = index;
      setMovementIndex(index);
      setBeat(0);
      setTempoReadout({ marked: Math.round(start), actual: Math.round(start) });
      paintMeters();
      phaseRef.current = "conducting";
      setPhase("conducting");
    },
    [paintMeters]
  );

  const restart = useCallback(() => {
    cohesionRef.current = START_COHESION;
    scoreRef.current = 0;
    streakRef.current = 0;
    cuesRef.current = 0;
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCues(0);
    setJudgment(null);
    armMovement(0);
  }, [armMovement]);

  useEffect(() => {
    paintMeters();
    lastRef.current = performance.now();
  }, [paintMeters]);

  const judge = useCallback((text: string, good: boolean) => {
    judgeIdRef.current += 1;
    setJudgment({ id: judgeIdRef.current, text, good });
  }, []);

  /** The baton falls. Your beat is the tempo; the orchestra chases it. */
  const swing = useCallback(() => {
    if (phaseRef.current !== "conducting") return;
    audio.unlock();
    const now = performance.now();
    lastTapRef.current = now;
    if (!startedRef.current) {
      // The downbeat that starts the movement is never judged.
      startedRef.current = true;
      setWaiting(false);
      lastRef.current = now;
      tapsRef.current = [now];
      audio.tone({ freq: "D4", type: "square", duration: 0.05, gain: 0.3 });
      judge("downbeat", true);
      return;
    }
    const taps = tapsRef.current;
    taps.push(now);
    if (taps.length > 5) taps.shift();

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i += 1) intervals.push(taps[i] - taps[i - 1]);
      const recent = intervals.slice(-3);
      const mean = recent.reduce((sum, v) => sum + v, 0) / recent.length;
      if (mean > 180 && mean < 1800) {
        playerBpmRef.current = Math.min(220, Math.max(40, 60000 / mean));
      }
    }

    // How close the stroke landed to the orchestra's own downbeat.
    const p = beatPhaseRef.current;
    const off = Math.min(p, 1 - p);
    audio.tone({ freq: "D4", type: "square", duration: 0.05, gain: 0.3 });

    // The players don't only take your speed, they take your placement: each
    // stroke drags the pulse a third of the way toward where your hand fell.
    // Without this the pulse free-runs and even a metronomic conductor is
    // judged off the beat forever. The shift is small enough never to cross a
    // beat boundary, so no beat is skipped or double-counted, and the sections
    // move with it so drift and cues keep meaning what they meant.
    const shift = (p < 0.5 ? -p : 1 - p) * 0.34;
    beatPhaseRef.current += shift;
    sectionsRef.current.strings.phase =
      (sectionsRef.current.strings.phase + shift + 1) % 1;
    sectionsRef.current.winds.phase = (sectionsRef.current.winds.phase + shift + 1) % 1;

    if (off < 0.13) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
      cohesionRef.current = Math.min(100, cohesionRef.current + 2.4);
      scoreRef.current += 12 + streakRef.current * 2;
      setScore(scoreRef.current);
      judge("on it", true);
    } else {
      streakRef.current = 0;
      setStreak(0);
      cohesionRef.current = Math.max(0, cohesionRef.current - 2.2);
      judge(p < 0.5 ? "late" : "early", false);
    }
    paintMeters();
  }, [audio, judge, paintMeters]);

  /** Pull a section back onto the beat. Costs you the stroke you didn't give. */
  const cue = useCallback(
    (id: SectionId) => {
      if (phaseRef.current !== "conducting") return;
      audio.unlock();
      const section = sectionsRef.current[id];
      const saved = section.misalign;
      section.bias = 0;
      section.phase = beatPhaseRef.current;
      section.misalign = 0;
      flashRef.current[id] = performance.now();
      cuesRef.current += 1;
      setCues(cuesRef.current);
      const gain = Math.round(saved * 260);
      if (gain > 0) {
        scoreRef.current += gain;
        setScore(scoreRef.current);
      }
      cohesionRef.current = Math.min(100, cohesionRef.current + saved * 30);
      audio.tone({ freq: id === "strings" ? "A4" : "D5", duration: 0.12, gain: 0.45 });
      judge(`${id} cued`, true);
      paintMeters();
    },
    [audio, judge, paintMeters]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "conducting") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      lastTapRef.current = performance.now();
      phaseRef.current = "conducting";
      setPhase("conducting");
    }
  }, []);

  const nextMovement = useCallback(() => {
    if (phaseRef.current !== "interval") return;
    if (!freshPress()) return;
    cohesionRef.current = Math.min(100, cohesionRef.current + 22);
    armMovement(movementRef.current + 1);
  }, [armMovement, freshPress]);

  // Keys: space beats, 1 and 2 cue the sections.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Space") {
        event.preventDefault();
        swing();
      } else if (event.key === CUE_KEYS.strings) {
        event.preventDefault();
        cue("strings");
      } else if (event.key === CUE_KEYS.winds) {
        event.preventDefault();
        cue("winds");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cue, swing]);

  // One loop: the pit, the pulse, the drift, and the piece itself.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      const sections = sectionsRef.current;
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // The pit floor.
      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 1; i <= 3; i += 1) {
        const y = height * (0.5 + i * 0.14);
        context.moveTo(width * 0.04, y);
        context.lineTo(width * 0.96, y);
      }
      context.stroke();

      /** One arc of players, bowing at their own section's phase. */
      const drawSection = (
        id: SectionId,
        cxFrac: number,
        count: number,
        flip: number
      ) => {
        const state = sections[id];
        const lit = Math.max(0.18, 0.9 - state.misalign * 2.4);
        const flashed = flashRef.current[id] > 0 && now - flashRef.current[id] < 320;
        const cx = width * cxFrac;
        const cy = height * 0.72;
        const radius = Math.min(width * 0.2, height * 0.42);
        context.strokeStyle = accentAlpha(flashed ? 0.95 : 0.28 * lit + 0.1);
        context.lineWidth = flashed ? 2 : 1.2;
        const bow = Math.sin(state.phase * Math.PI * 2) * 0.55 * flip;
        for (let i = 0; i < count; i += 1) {
          const spread = (i / Math.max(1, count - 1) - 0.5) * 1.5;
          const x = cx + spread * radius * 0.9;
          const y = cy - Math.cos(spread) * radius * 0.22;
          context.beginPath();
          context.arc(x, y, 5, 0, Math.PI * 2);
          context.stroke();
          context.beginPath();
          context.moveTo(x, y + 5);
          const len = 17;
          context.lineTo(x + Math.sin(bow + i * 0.12) * len, y + 5 + Math.cos(bow) * len);
          context.stroke();
        }
        context.fillStyle = accentAlpha(0.65);
        context.font = "10px monospace";
        context.textAlign = "center";
        context.fillText(id.toUpperCase(), cx, height * 0.94);
      };

      drawSection("strings", 0.26, 7, 1);
      drawSection("winds", 0.74, 6, -1);

      // The baton, tracing a four-beat pattern: down, left, right, up.
      const bar = beatCountRef.current % 4;
      const p = beatPhaseRef.current;
      const anchors = [
        { x: 0.5, y: 0.62 },
        { x: 0.34, y: 0.4 },
        { x: 0.66, y: 0.42 },
        { x: 0.5, y: 0.2 },
      ];
      const from = anchors[bar];
      const to = anchors[(bar + 1) % 4];
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const tipX = width * (from.x + (to.x - from.x) * ease);
      const tipY = height * (from.y + (to.y - from.y) * ease);

      if (!reducedMotion) {
        const trail = trailRef.current;
        trail.push({ x: tipX, y: tipY });
        if (trail.length > 16) trail.shift();
        context.strokeStyle = accentAlpha(0.3);
        context.lineWidth = 1.5;
        context.beginPath();
        trail.forEach((point, i) => {
          if (i === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }

      const handX = width * 0.5;
      const handY = height * 0.78;
      context.strokeStyle = accentAlpha(0.9);
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(handX, handY);
      context.lineTo(tipX, tipY);
      context.stroke();
      context.fillStyle = accentAlpha(0.9);
      context.beginPath();
      context.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
      context.fill();

      // The downbeat ring.
      if (pulseRef.current > 0) {
        const age = (now - pulseRef.current) / 340;
        if (age < 1) {
          context.strokeStyle = accentAlpha(0.5 * (1 - age));
          context.lineWidth = 2;
          context.beginPath();
          context.arc(width * 0.5, height * 0.2, 8 + age * 46, 0, Math.PI * 2);
          context.stroke();
        }
      }

      // Cohesion as a haze over the pit.
      const strain = 1 - Math.max(0, cohesionRef.current) / 100;
      if (strain > 0.05) {
        context.fillStyle = `rgba(0,0,0,${(strain * 0.45).toFixed(3)})`;
        context.fillRect(0, 0, width, height);
      }
    };
    drawRef.current = draw;

    /** One tick of the podium: tempo chase, drift, beats, and the piece. */
    const update = (now: number, dt: number) => {
      if (phaseRef.current !== "conducting" || !startedRef.current) return;
      const active = MOVEMENTS[movementRef.current];
      const progress = Math.min(1, beatCountRef.current / active.beats);
      const marked = active.tempo(progress);

      // The players are with your hand, not with the metronome.
      const chase = Math.min(1, dt * 2.4);
      orchestraBpmRef.current += (playerBpmRef.current - orchestraBpmRef.current) * chase;

      // Stop beating and they look up from the stands.
      const silence = now - lastTapRef.current;
      const beatMs = 60000 / Math.max(30, orchestraBpmRef.current);
      if (silence > beatMs * 2.4) {
        cohesionRef.current = Math.max(0, cohesionRef.current - dt * 18);
        if (streakRef.current !== 0) {
          streakRef.current = 0;
          setStreak(0);
        }
      }

      const tempoErr = Math.abs(orchestraBpmRef.current - marked) / marked;
      if (tempoErr > TEMPO_TOLERANCE) {
        cohesionRef.current = Math.max(
          0,
          cohesionRef.current - dt * Math.min(26, (tempoErr - TEMPO_TOLERANCE) * 110)
        );
      } else {
        cohesionRef.current = Math.min(100, cohesionRef.current + dt * 3.2);
      }

      // Sections wander on their own; their direction turns every bar, so the
      // drift is a rhythm to learn rather than a coin to flip.
      const advance = (dt * orchestraBpmRef.current) / 60;
      for (const id of ["strings", "winds"] as const) {
        const state = sectionsRef.current[id];
        if (active.wander.includes(id)) {
          const dir =
            ((beatCountRef.current >> 2) + (id === "winds" ? 1 : 0)) % 2 === 0 ? 1 : -1;
          state.bias = Math.max(-0.05, Math.min(0.05, state.bias + dir * dt * active.drift));
        }
        state.phase = (state.phase + advance * (1 + state.bias)) % 1;
        const raw = Math.abs(state.phase - beatPhaseRef.current);
        state.misalign = Math.min(raw, 1 - raw);
        if (state.misalign > ALIGN_TOLERANCE) {
          cohesionRef.current = Math.max(
            0,
            cohesionRef.current - dt * (state.misalign - ALIGN_TOLERANCE) * 42
          );
        }
      }

      // The pulse, and the piece riding on it. A frame that swallowed several
      // beats fires at most two, so a stall never dumps a chord of overlapping
      // notes into the room; the rest of the phase is simply dropped.
      beatPhaseRef.current += advance;
      let fired = 0;
      while (beatPhaseRef.current >= 1 && fired < 2) {
        fired += 1;
        beatPhaseRef.current -= 1;
        const index = beatCountRef.current;
        beatCountRef.current = index + 1;
        pulseRef.current = now;
        const slot = index % MELODY.length;
        const beatSec = 60 / Math.max(30, orchestraBpmRef.current);
        audio.tone({
          freq: MELODY[slot],
          duration: beatSec * 0.85,
          gain: 0.45,
          attack: 0.18,
        });
        if (sectionsRef.current.winds.misalign < 0.2) {
          audio.tone({
            freq: WINDS[slot],
            duration: beatSec * 0.7,
            gain: 0.22,
            type: "sine",
            attack: 0.3,
          });
        }
        if (index % 4 === 0) {
          audio.tone({
            freq: BASS[(index >> 2) % BASS.length],
            duration: beatSec * 2.4,
            gain: 0.24,
            type: "sawtooth",
            attack: 0.2,
          });
        }
        const quality = Math.max(0, 1 - tempoErr * 4);
        scoreRef.current += Math.round((8 + quality * 22) * (movementRef.current + 1));
        setScore(scoreRef.current);
        setBeat(beatCountRef.current);
        setTempoReadout({
          marked: Math.round(marked),
          actual: Math.round(orchestraBpmRef.current),
        });

        if (beatCountRef.current >= active.beats) {
          if (movementRef.current + 1 >= MOVEMENTS.length) {
            endRun("done");
          } else {
            audio.clear();
            phaseRef.current = "interval";
            setPhase("interval");
            window.requestAnimationFrame(() => actionRef.current?.focus());
          }
          break;
        }
      }
      if (beatPhaseRef.current >= 1) beatPhaseRef.current %= 1;

      paintMeters();
      if (cohesionRef.current <= 0) endRun("failed");
    };

    // Reduced motion keeps the game but drops the animation: the pit is
    // repainted a few times a second on a timer instead of every frame, so
    // there is no continuous movement and nothing is lost from play.
    if (reducedMotion) {
      lastRef.current = performance.now();
      const id = window.setInterval(() => {
        if (document.hidden) {
          lastRef.current = performance.now();
          return;
        }
        const now = performance.now();
        const dt = Math.min(0.4, (now - lastRef.current) / 1000);
        lastRef.current = now;
        update(now, dt);
        draw(now);
      }, 120);
      return () => window.clearInterval(id);
    }

    lastRef.current = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        // A generous ceiling: clamping tightly would make the whole piece run
        // in slow motion on a device that drops frames, which for a game about
        // tempo is the one failure that matters.
        const dt = Math.min(0.12, (now - lastRef.current) / 1000);
        lastRef.current = now;
        update(now, dt);
        draw(now);
      } else {
        lastRef.current = now;
        lastTapRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [audio, endRun, paintMeters, reducedMotion]);

  const over = phase === "done" || phase === "failed";

  const status = useMemo(() => {
    if (phase === "failed")
      return `The players scatter in the ${movement.mark.toLowerCase()}. ${score} points, best run ${bestStreak}.`;
    if (phase === "done")
      return `Held to the last bar of all four movements. ${score} points, ${cues} cues, best run ${bestStreak}.`;
    if (phase === "paused") return "Baton down. The pit waits.";
    if (waiting)
      return `${movement.mark}. ${movement.instruction} Nothing starts until you give the downbeat.`;
    if (phase === "interval")
      return `${movement.mark} survived. The next movement is marked ${MOVEMENTS[movementIndex + 1]?.mark ?? ""}.`;
    return `${movement.mark} — beat ${beat} of ${movement.beats}. Marked ${tempoReadout.marked}, playing ${tempoReadout.actual}.`;
  }, [
    beat,
    bestStreak,
    cues,
    movement,
    movementIndex,
    phase,
    score,
    tempoReadout.actual,
    tempoReadout.marked,
    waiting,
  ]);

  const drag = tempoReadout.actual - tempoReadout.marked;

  return (
    <div
      ref={rootRef}
      data-sim-state={phase}
      data-cohesion="100"
      data-marked={tempoReadout.marked}
      data-playing={tempoReadout.actual}
      data-movement={movementIndex + 1}
      data-conduct-score={score}
      data-streak={streak}
      data-cues={cues}
      data-beat={beat}
      className="flex flex-col gap-3"
    >
      <AmadeusKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          movement <span className="text-accent">{movementIndex + 1}</span>/{MOVEMENTS.length}
        </span>
        <span className="text-accent">{movement.mark}</span>
        <span>
          score{" "}
          <span
            key={score}
            className={`inline-block w-12 text-right tabular-nums ${
              reducedMotion ? "text-accent" : "amad-pop text-accent"
            }`}
          >
            {score}
          </span>
        </span>
        <span className="inline-block w-16">{streak > 1 ? `run ×${streak}` : "run —"}</span>
        <span className="ml-auto flex gap-2">
          <AmadeusMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "conducting" || phase === "paused") && (
            <AmadeusChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </AmadeusChip>
          )}
        </span>
      </div>

      {/* Tempo: marked against played, in words as well as numbers. Every
          changing value sits in a fixed-width slot so the readout never
          reflows the controls underneath it mid-beat. */}
      <div className="border border-accent/20 bg-ink/50 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em]">
        <div className="flex items-center gap-x-4">
          <span className="text-white/45">
            marked{" "}
            <span className="inline-block w-8 text-right tabular-nums text-accent">
              {tempoReadout.marked}
            </span>
          </span>
          <span className="text-white/45">
            playing{" "}
            <span className="inline-block w-8 text-right tabular-nums text-accent">
              {tempoReadout.actual}
            </span>
          </span>
          <span
            className={`inline-block min-w-[11rem] ${
              Math.abs(drag) <= 6 ? "text-accent" : "text-accent-bright"
            }`}
          >
            {Math.abs(drag) <= 6
              ? "with the mark"
              : drag < 0
                ? "dragging — beat faster"
                : "rushing — broaden"}
          </span>
        </div>
        <p className="mt-1 normal-case text-white/35">{movement.instruction}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <AmadeusMeter label="cohesion" barRef={cohesionBarRef} valueRef={cohesionTextRef} />
        <AmadeusMeter label="strings" barRef={stringsBarRef} valueRef={stringsTextRef} tone="dim" />
        <AmadeusMeter label="winds" barRef={windsBarRef} valueRef={windsTextRef} tone="dim" />
      </div>

      {/* The pit */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-64"
          style={{ touchAction: "none" }}
        />
        {judgment && (
          <span
            key={judgment.id}
            aria-hidden
            className={`pointer-events-none absolute right-3 top-3 text-[10px] uppercase tracking-[0.2em] ${
              judgment.good ? "text-accent-bright" : "text-accent"
            } ${reducedMotion ? "" : "amad-float"}`}
          >
            {judgment.text}
          </span>
        )}
        {waiting && phase === "conducting" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/80 p-4 text-center">
            <div className={reducedMotion ? "" : "amad-rise"}>
              <p className={`text-[11px] uppercase tracking-[0.24em] text-accent ${reducedMotion ? "" : "amad-throb"}`}>
                give the downbeat
              </p>
              <p className="mx-auto mt-2 max-w-md text-[11px] normal-case leading-relaxed text-white/65">
                Your beat sets the tempo — the orchestra plays at whatever speed
                you keep. Hold the marked tempo, and cue a section back when it
                drifts. Nothing moves until you begin.
              </p>
            </div>
          </div>
        )}
        {(phase === "paused" || phase === "interval" || over) && (
          <div className="absolute inset-0 grid place-items-center bg-ink/85 p-4 text-center">
            <div className={reducedMotion ? "" : "amad-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "baton down"
                  : phase === "interval"
                    ? `${movement.mark} survived`
                    : phase === "failed"
                      ? "the orchestra comes apart"
                      : "held to the last bar"}
              </p>
              {phase === "interval" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  next: {MOVEMENTS[movementIndex + 1]?.mark} · cohesion +22%
                </p>
              )}
              {over && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {cues} cues · best run {bestStreak}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reserved height: the status rewrites every beat, and a growing
          paragraph must never shove the controls out from under a finger. */}
      <p
        role="status"
        className="min-h-[2.75rem] text-[11px] normal-case leading-relaxed text-white/65"
      >
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "interval" ? (
          <AmadeusChip
            innerRef={actionRef}
            onClick={nextMovement}
            onPointerDown={markPress}
            bright
          >
            Begin the next movement
          </AmadeusChip>
        ) : over ? (
          <AmadeusChip innerRef={actionRef} onClick={restart} bright>
            Take the podium again
          </AmadeusChip>
        ) : (
          <>
            <button
              type="button"
              onClick={swing}
              disabled={phase !== "conducting"}
              className="amad-press border border-accent/40 px-5 py-2 text-[11px] uppercase tracking-[0.12em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Beat
            </button>
            <AmadeusChip
              onClick={() => cue("strings")}
              disabled={phase !== "conducting"}
              label="Cue the strings back onto the beat"
            >
              cue strings · 1
            </AmadeusChip>
            <AmadeusChip
              onClick={() => cue("winds")}
              disabled={phase !== "conducting"}
              label="Cue the winds back onto the beat"
            >
              cue winds · 2
            </AmadeusChip>
            <span className="text-white/35">space beats · 1 / 2 cue</span>
          </>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function AmadeusConduct({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="amadeus-conduct-title"
      gameId="amadeus-conduct"
      eyebrow="The podium"
      title="Conduct"
      startLabel="Raise the baton"
      stage
      howToPlay={{
        objective:
          "Nothing plays until you give the downbeat — the first Space starts the movement, and every stroke after it sets the tempo the orchestra follows.",
        controls: [
          { keys: "Space", does: "one baton stroke; the first is the unjudged downbeat" },
          { keys: "1", does: "cue the strings back onto your beat" },
          { keys: "2", does: "cue the winds back onto your beat" },
          { keys: "click", does: "the beat and cue chips do the same from the pointer" },
        ],
        tip: "Each section drifts off on its own, and a cue pays out more the further it had wandered. Strokes landing near the pit's own pulse build cohesion; strokes off it drain cohesion, and empty ends the performance.",
      }}
      reference={{
        scene: "Amadeus (1984) · Mozart at the podium, taking the tempo himself",
      }}
      onClose={onClose}
    >
      <Podium />
    </SimulationShell>
  );
}
