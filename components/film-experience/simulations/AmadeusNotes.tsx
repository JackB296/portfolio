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
 * The Emperor's note: too many notes, cut a few. So cut one. The line lifts out
 * of the stave, everything leaning on it goes hollow, and the passage plays
 * again WITH THE HOLE — you hear the phrase limp. The futility is the joke, but
 * the game underneath is real: some notes cost the phrase far less than others,
 * and finding the cheapest cut in four passages is the whole skill. The tally
 * of notes actually cut stays at zero, because every one of them goes back.
 *
 * All pitches are self-rendered oscillators playing an ORIGINAL line.
 */

const SCORE_ID = "amadeus-notes";

type NoteRole =
  | "anacrusis"
  | "melody"
  | "suspension"
  | "resolution"
  | "passing tone"
  | "inner voice"
  | "pedal"
  | "appoggiatura"
  | "cadence";

type Tone = Readonly<{
  pitch: string;
  /** Staff position: 0 is the top line, whole numbers are lines and spaces. */
  row: number;
  beats: number;
  role: NoteRole;
  /** How hard the phrase leans on this note. */
  weight: number;
  /** Notes that go hollow when this one leaves. */
  deps: readonly number[];
  breaks: string;
}>;

type Passage = Readonly<{
  id: string;
  title: string;
  beat: number;
  notes: readonly Tone[];
}>;

const PASSAGES: readonly Passage[] = [
  {
    id: "opening",
    title: "The opening period",
    beat: 0.32,
    notes: [
      { pitch: "D5", row: 5, beats: 1, role: "anacrusis", weight: 3, deps: [1], breaks: "the phrase begins from nowhere — there is no upbeat to lean off" },
      { pitch: "F#5", row: 4, beats: 1, role: "melody", weight: 4, deps: [2, 3], breaks: "the answer never arrives; the line asks and nothing comes back" },
      { pitch: "A5", row: 3, beats: 1, role: "melody", weight: 4, deps: [3], breaks: "the climb stops halfway and the phrase never reaches its height" },
      { pitch: "G5", row: 3.5, beats: 1, role: "suspension", weight: 5, deps: [4], breaks: "the suspension goes with it, and the resolution resolves nothing" },
      { pitch: "F#5", row: 4, beats: 1, role: "resolution", weight: 4, deps: [], breaks: "the tension hangs open; the ear waits for a note that never falls" },
      { pitch: "E5", row: 4.5, beats: 1, role: "passing tone", weight: 1, deps: [], breaks: "a small gap opens in the descent — the cheapest wound on this page, and still a wound" },
    ],
  },
  {
    id: "answer",
    title: "The answering phrase",
    beat: 0.3,
    notes: [
      { pitch: "A4", row: 6.5, beats: 1, role: "pedal", weight: 2, deps: [4], breaks: "the ground goes out from under the bar" },
      { pitch: "D5", row: 5, beats: 0.5, role: "melody", weight: 4, deps: [1, 2], breaks: "the answer has no head; it starts in the middle of itself" },
      { pitch: "E5", row: 4.5, beats: 0.5, role: "passing tone", weight: 1, deps: [], breaks: "a step is missing from the stair and the line stumbles over it" },
      { pitch: "F#5", row: 4, beats: 1, role: "melody", weight: 4, deps: [5], breaks: "the phrase forgets where it was going" },
      { pitch: "B4", row: 6, beats: 1, role: "inner voice", weight: 3, deps: [], breaks: "the harmony goes hollow underneath — thirds with nothing between them" },
      { pitch: "G5", row: 3.5, beats: 1, role: "appoggiatura", weight: 5, deps: [6], breaks: "the leaning note is what makes the bar hurt; without it the bar is furniture" },
      { pitch: "F#5", row: 4, beats: 1, role: "resolution", weight: 4, deps: [], breaks: "nothing lands; the leaning note leans on air" },
      { pitch: "D5", row: 5, beats: 2, role: "cadence", weight: 5, deps: [], breaks: "the cadence refuses to close and the phrase runs off the edge of the page" },
    ],
  },
  {
    id: "development",
    title: "The development, where it thickens",
    beat: 0.28,
    notes: [
      { pitch: "D5", row: 5, beats: 0.5, role: "melody", weight: 3, deps: [1], breaks: "the entry is missing and the imitation has nothing to imitate" },
      { pitch: "F#5", row: 4, beats: 0.5, role: "melody", weight: 4, deps: [2, 3], breaks: "the subject is beheaded" },
      { pitch: "A5", row: 3, beats: 0.5, role: "melody", weight: 4, deps: [3], breaks: "the sequence breaks its own pattern one link in" },
      { pitch: "D6", row: 1.5, beats: 1, role: "melody", weight: 5, deps: [4, 5], breaks: "the high point of the whole passage; take it and the arch has no keystone" },
      { pitch: "C#6", row: 2, beats: 0.5, role: "appoggiatura", weight: 4, deps: [5], breaks: "the descent begins on the wrong rung" },
      { pitch: "B5", row: 2.5, beats: 0.5, role: "passing tone", weight: 2, deps: [], breaks: "a small hole in the fall — audible, and cheap, but still a hole" },
      { pitch: "A5", row: 3, beats: 1, role: "melody", weight: 4, deps: [7], breaks: "the line loses the note it was aiming at all along" },
      { pitch: "G5", row: 3.5, beats: 1, role: "suspension", weight: 5, deps: [8], breaks: "the last suspension goes and the cadence arrives without argument" },
      { pitch: "F#5", row: 4, beats: 2, role: "cadence", weight: 5, deps: [], breaks: "the passage stops rather than ends" },
    ],
  },
  {
    id: "finale",
    title: "The finale — and there are more notes here, Majesty",
    beat: 0.24,
    notes: [
      { pitch: "D4", row: 8, beats: 1, role: "pedal", weight: 3, deps: [3, 8], breaks: "the bass drops out and everything above it starts floating" },
      { pitch: "A4", row: 6.5, beats: 0.5, role: "inner voice", weight: 2, deps: [], breaks: "the middle thins; you can hear straight through the chord" },
      { pitch: "D5", row: 5, beats: 0.5, role: "melody", weight: 4, deps: [2], breaks: "the tune has no first note" },
      { pitch: "F#5", row: 4, beats: 0.5, role: "melody", weight: 4, deps: [4], breaks: "the leap has nothing to leap from" },
      { pitch: "A5", row: 3, beats: 0.5, role: "melody", weight: 4, deps: [5], breaks: "the phrase falls short of its own summit" },
      { pitch: "B5", row: 2.5, beats: 0.5, role: "passing tone", weight: 1, deps: [], breaks: "the smallest possible wound on the page — and you can still hear exactly where it was" },
      { pitch: "C#6", row: 2, beats: 0.5, role: "appoggiatura", weight: 5, deps: [6], breaks: "the ache is gone; what is left is correct and dead" },
      { pitch: "D6", row: 1.5, beats: 1, role: "melody", weight: 5, deps: [7], breaks: "the top of the finale; the roof comes off" },
      { pitch: "A5", row: 3, beats: 1, role: "resolution", weight: 4, deps: [], breaks: "the descent never gets started" },
      { pitch: "G5", row: 3.5, beats: 0.5, role: "suspension", weight: 5, deps: [10], breaks: "the final suspension, the only thing making the last bar mean anything" },
      { pitch: "D5", row: 5, beats: 2, role: "cadence", weight: 5, deps: [], breaks: "there is no end. The finale simply stops being played" },
    ],
  },
];

const ATTEMPTS_PER_PASSAGE = 3;

type Phase = "trimming" | "cutting" | "interval" | "conceded";

/** What removing a note costs the passage, 0-100. */
const damageOf = (note: Tone) => Math.min(100, note.weight * 13 + note.deps.length * 11);

function TooManyNotes() {
  const [passageIndex, setPassageIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("trimming");
  const [cutIndex, setCutIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [bestDamage, setBestDamage] = useState<number | null>(null);
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [reaction, setReaction] = useState(
    "Remove one note. Play the passage first if you want to know what you are cutting."
  );
  const reducedMotion = useReducedMotion();
  const audio = useAmadeusAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const wrapRef = useRef<HTMLDivElement>(null);
  const damageBarRef = useRef<HTMLDivElement>(null);
  const damageTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("trimming");
  const passageRef = useRef(0);
  const cutRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const bestRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const liftRef = useRef(-1);
  const timersRef = useRef<number[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});
  const { freshPress, markPress } = useFreshPress(`${phase}:${passageIndex}`);

  const passage = PASSAGES[passageIndex];
  const notes = passage.notes;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    passageRef.current = passageIndex;
  }, [passageIndex]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const paintDamage = useCallback((value: number | null) => {
    const shown = value ?? 0;
    if (damageBarRef.current) damageBarRef.current.style.width = `${shown}%`;
    if (damageTextRef.current) {
      damageTextRef.current.textContent = value === null ? "—" : `${Math.round(shown)}`;
    }
  }, []);

  /** Positions are normalized so the canvas and the buttons agree exactly. */
  const layout = useMemo(() => {
    const span = notes.reduce((sum, n) => sum + n.beats, 0);
    let cursor = 0;
    return notes.map((note) => {
      const x = 0.08 + (cursor / span) * 0.84 + (note.beats / span) * 0.42;
      cursor += note.beats;
      return { x, y: 0.12 + note.row * 0.09 };
    });
  }, [notes]);

  const dependents = useMemo(
    () => (cutIndex === null ? [] : notes[cutIndex].deps),
    [cutIndex, notes]
  );

  /** Play the passage — whole, or with the hole where a note used to be. */
  const play = useCallback(
    (hole: number | null) => {
      audio.unlock();
      const active = PASSAGES[passageRef.current];
      const hollow = hole === null ? [] : active.notes[hole].deps;
      const steps = active.notes.map((note, index) => {
        if (index === hole) return { note: null, beats: note.beats };
        return {
          note: note.pitch,
          beats: note.beats,
          gain: hollow.includes(index) ? 0.3 : 1,
        };
      });
      return audio.phrase(steps, { beat: active.beat, gain: 0.75 });
    },
    [audio]
  );

  const hearItWhole = useCallback(() => {
    if (phaseRef.current === "cutting") return;
    play(null);
    setReaction("That is the passage as it stands. Now take one note out of it.");
  }, [play]);

  const finishPassage = useCallback(
    (best: number | null) => {
      const banked = best ?? 100;
      const gained = Math.round((100 - banked) * 4 * (passageRef.current + 1));
      scoreRef.current += gained;
      setScore(scoreRef.current);
      if (passageRef.current + 1 >= PASSAGES.length) {
        if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
        audio.win();
        phaseRef.current = "conceded";
        setPhase("conceded");
      } else {
        audio.clear();
        phaseRef.current = "interval";
        setPhase("interval");
      }
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const cut = useCallback(
    (index: number) => {
      if (phaseRef.current !== "trimming") return;
      const active = PASSAGES[passageRef.current];
      const note = active.notes[index];
      audio.unlock();
      clearTimers();

      cutRef.current = index;
      setCutIndex(index);
      liftRef.current = performance.now();
      phaseRef.current = "cutting";
      setPhase("cutting");

      const damage = damageOf(note);
      setLastDamage(damage);
      paintDamage(damage);
      const nextBest = bestRef.current === null ? damage : Math.min(bestRef.current, damage);
      bestRef.current = nextBest;
      setBestDamage(nextBest);

      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      setTotalAttempts((v) => v + 1);

      audio.tone({ freq: "A2", type: "sawtooth", duration: 0.18, gain: 0.4 });
      setReaction(
        `${note.role} removed — ${note.breaks}. Cost to the passage: ${damage}.`
      );

      // Hear the hole: the passage plays again without it.
      const length = play(index);
      later(() => {
        cutRef.current = null;
        setCutIndex(null);
        liftRef.current = -1;
        if (attemptsRef.current >= ATTEMPTS_PER_PASSAGE) {
          setReaction(
            `It was essential. It goes back. ${ATTEMPTS_PER_PASSAGE} cuts tried, ${ATTEMPTS_PER_PASSAGE} notes back where they were.`
          );
          finishPassage(bestRef.current);
        } else {
          phaseRef.current = "trimming";
          setPhase("trimming");
          setReaction(
            `It was essential. It goes back. ${ATTEMPTS_PER_PASSAGE - attemptsRef.current} cut${
              ATTEMPTS_PER_PASSAGE - attemptsRef.current === 1 ? "" : "s"
            } left on this passage — try to find one the phrase can better afford.`
          );
        }
      }, Math.max(700, length * 1000 + 320));
    },
    [audio, clearTimers, finishPassage, later, paintDamage, play]
  );

  const concede = useCallback(() => {
    if (phaseRef.current !== "trimming") return;
    if (attemptsRef.current === 0) return;
    clearTimers();
    finishPassage(bestRef.current);
  }, [clearTimers, finishPassage]);

  const nextPassage = useCallback(() => {
    if (phaseRef.current !== "interval") return;
    if (!freshPress()) return;
    clearTimers();
    attemptsRef.current = 0;
    bestRef.current = null;
    cutRef.current = null;
    setAttempts(0);
    setBestDamage(null);
    setLastDamage(null);
    paintDamage(null);
    setCutIndex(null);
    setPassageIndex((value) => value + 1);
    setReaction("A longer passage. More notes, Majesty. Take one out.");
    phaseRef.current = "trimming";
    setPhase("trimming");
  }, [clearTimers, freshPress, paintDamage]);

  const restart = useCallback(() => {
    clearTimers();
    attemptsRef.current = 0;
    bestRef.current = null;
    cutRef.current = null;
    scoreRef.current = 0;
    setAttempts(0);
    setTotalAttempts(0);
    setBestDamage(null);
    setLastDamage(null);
    paintDamage(null);
    setCutIndex(null);
    setScore(0);
    setPassageIndex(0);
    setReaction("Remove one note. The Emperor is still waiting.");
    phaseRef.current = "trimming";
    setPhase("trimming");
  }, [clearTimers, paintDamage]);

  // The engraving. A single loop while a note is out (for the lift and the
  // gap); otherwise a static redraw on every state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      const active = PASSAGES[passageRef.current];
      const cutAt = cutRef.current;
      const hollow = cutAt === null ? [] : active.notes[cutAt].deps;
      const lift =
        liftRef.current > 0 && !reducedMotion
          ? Math.min(1, (now - liftRef.current) / 260)
          : liftRef.current > 0
            ? 1
            : 0;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      const px = (nx: number) => nx * width;
      const py = (ny: number) => ny * height;
      const gap = height * 0.09;

      // Five staff lines through the middle of the note rows.
      context.strokeStyle = accentAlpha(0.24);
      context.lineWidth = 1;
      context.beginPath();
      for (let line = 0; line < 5; line += 1) {
        const y = py(0.12 + (2 + line) * 0.09);
        context.moveTo(width * 0.04, y);
        context.lineTo(width * 0.96, y);
      }
      context.stroke();

      // The slur over the phrase — it breaks where a note is missing.
      const first = layout[0];
      const last = layout[layout.length - 1];
      const arcTop = py(0.05);
      const drawSlur = (fromX: number, toX: number) => {
        context.beginPath();
        context.moveTo(fromX, py(0.1));
        context.quadraticCurveTo((fromX + toX) / 2, arcTop, toX, py(0.1));
        context.stroke();
      };
      context.strokeStyle = accentAlpha(cutAt === null ? 0.5 : 0.28);
      context.lineWidth = 1.4;
      if (cutAt === null || cutAt === 0 || cutAt === layout.length - 1) {
        drawSlur(px(first.x), px(last.x));
      } else {
        drawSlur(px(first.x), px(layout[cutAt].x) - width * 0.02);
        drawSlur(px(layout[cutAt].x) + width * 0.02, px(last.x));
      }

      // Noteheads.
      for (let i = 0; i < active.notes.length; i += 1) {
        const note = active.notes[i];
        const pos = layout[i];
        const x = px(pos.x);
        const isCut = i === cutAt;
        const isHollow = hollow.includes(i);
        const y = py(pos.y) - (isCut ? lift * height * 0.16 : 0);

        // Ledger lines for anything sitting off the stave.
        if (note.row < 2 || note.row > 6) {
          context.strokeStyle = accentAlpha(0.25);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x - gap * 0.8, py(pos.y));
          context.lineTo(x + gap * 0.8, py(pos.y));
          context.stroke();
        }

        const alpha = isCut ? 0.9 - lift * 0.55 : isHollow && cutAt !== null ? 0.22 : 0.85;
        context.fillStyle = accentAlpha(alpha);
        context.strokeStyle = accentAlpha(alpha * 0.85);
        context.lineWidth = 1.4;
        context.beginPath();
        context.ellipse(x, y, gap * 0.52, gap * 0.38, -0.32, 0, Math.PI * 2);
        if (note.beats >= 2) context.stroke();
        else context.fill();
        context.beginPath();
        context.moveTo(x + gap * 0.5, y);
        context.lineTo(x + gap * 0.5, y - gap * 2.4);
        context.stroke();
        if (note.beats < 1) {
          context.beginPath();
          context.moveTo(x + gap * 0.5, y - gap * 2.4);
          context.lineTo(x + gap * 1.1, y - gap * 1.8);
          context.stroke();
        }

        // The hole the cut leaves behind: a rest sitting in the empty slot.
        if (isCut && lift > 0.35) {
          context.strokeStyle = accentAlpha(0.75);
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(x - gap * 0.5, py(0.12 + 3 * 0.09));
          context.lineTo(x + gap * 0.5, py(0.12 + 3 * 0.09));
          context.stroke();
          context.strokeStyle = accentAlpha(0.35);
          context.lineWidth = 1;
          context.setLineDash([3, 4]);
          context.beginPath();
          context.moveTo(x, py(0.06));
          context.lineTo(x, py(0.86));
          context.stroke();
          context.setLineDash([]);
        }
      }

      // The Emperor's tally, engraved at the foot of the page.
      context.fillStyle = accentAlpha(0.32);
      context.font = "10px monospace";
      context.textAlign = "left";
      context.fillText("NOTES ACTUALLY CUT: 0", width * 0.04, height * 0.96);
    };
    drawRef.current = draw;

    if (reducedMotion || phase !== "cutting") {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) draw(now);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [layout, phase, passageIndex, cutIndex, reducedMotion]);

  // Keyboard: p replays the passage.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        hearItWhole();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hearItWhole]);

  const status = useMemo(() => {
    if (phase === "conceded")
      return `Four passages, ${totalAttempts} cuts tried, not one note cut. ${score} points.`;
    if (phase === "interval")
      return `${passage.title} survived intact. Best cut cost ${bestDamage ?? 0}. A longer passage waits.`;
    if (phase === "cutting") return reaction;
    return `${passage.title} — cut ${attempts + 1} of ${ATTEMPTS_PER_PASSAGE}. ${reaction}`;
  }, [attempts, bestDamage, passage.title, phase, reaction, score, totalAttempts]);

  return (
    <div
      data-sim-state={phase}
      data-passage={passageIndex + 1}
      data-attempts={totalAttempts}
      data-notes-score={score}
      data-best-damage={bestDamage ?? ""}
      className="flex flex-col gap-3"
    >
      <AmadeusKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          passage <span className="text-accent">{passageIndex + 1}</span>/{PASSAGES.length}
        </span>
        <span>
          cuts tried <span className="text-accent">{totalAttempts}</span>
        </span>
        <span>
          notes cut <span className="text-accent">0</span>
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "amad-pop text-accent"}>
            {score}
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <AmadeusMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
        </span>
      </div>

      <div className="flex flex-wrap gap-4">
        <AmadeusMeter
          label="cost of your last cut"
          barRef={damageBarRef}
          valueRef={damageTextRef}
          initial="0%"
        />
        <div className="flex-1 text-[9px] uppercase tracking-[0.16em] text-white/45">
          <span>cheapest cut found</span>
          <p className="mt-1 text-accent">
            {bestDamage === null ? "— nothing tried yet" : `${bestDamage} damage`}
          </p>
        </div>
      </div>

      {/* The engraved passage; the buttons sit exactly over the noteheads. */}
      <div ref={wrapRef} className="relative">
        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">{passage.title}</p>
        <canvas
          ref={canvasRef}
          aria-hidden
          className={`h-44 w-full border border-accent/25 bg-ink/60 sm:h-56 ${
            reducedMotion || phase !== "cutting" ? "" : "amad-shake"
          }`}
          style={{ touchAction: "none" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-5">
          {notes.map((note, index) => {
            const pos = layout[index];
            const isCut = cutIndex === index;
            const isHollow = dependents.includes(index);
            return (
              <button
                key={`${passage.id}-${index}`}
                type="button"
                onClick={() => cut(index)}
                disabled={phase !== "trimming"}
                aria-label={`Cut note ${index + 1} of ${notes.length}, ${note.role}`}
                className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
                  isCut
                    ? "border-accent bg-accent/20"
                    : isHollow
                      ? "border-accent/20"
                      : "border-transparent hover:border-accent/60 hover:bg-accent/10"
                }`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  width: "2.2rem",
                  height: "2.2rem",
                }}
              >
                <span className="sr-only">{note.role}</span>
              </button>
            );
          })}
        </div>
        {phase === "interval" && (
          <div className="absolute inset-0 top-5 grid place-items-center bg-ink/85 p-4 text-center">
            <div className={reducedMotion ? "" : "amad-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                every note back where it was
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                cheapest cut {bestDamage ?? 0} damage · still too many notes
              </p>
            </div>
          </div>
        )}
        {phase === "conceded" && (
          <div className="absolute inset-0 top-5 grid place-items-center bg-ink/90 p-4 text-center">
            <div className={reducedMotion ? "" : "amad-rise"}>
              <p className={`text-sm normal-case text-accent ${reducedMotion ? "" : "amad-stamp"}`}>
                Which few did you have in mind, Majesty?
              </p>
              <p className="mx-auto mt-3 max-w-md text-[11px] normal-case leading-relaxed text-white/70">
                {totalAttempts} cuts tried across four passages. Every one of them
                went back. There are exactly as many notes as are needed, neither
                more nor less.
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-accent">
                {score} points
              </p>
            </div>
          </div>
        )}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "interval" ? (
          <AmadeusChip
            innerRef={actionRef}
            onClick={nextPassage}
            onPointerDown={markPress}
            bright
          >
            The next passage
          </AmadeusChip>
        ) : phase === "conceded" ? (
          <AmadeusChip innerRef={actionRef} onClick={restart} bright>
            Try the score again
          </AmadeusChip>
        ) : (
          <>
            <AmadeusChip onClick={hearItWhole} disabled={phase === "cutting"} label="Play the passage as written">
              hear it whole · p
            </AmadeusChip>
            <button
              type="button"
              onClick={concede}
              disabled={phase !== "trimming" || attempts === 0}
              className="amad-press border border-accent/30 px-4 py-2 text-[11px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              It cannot be cut
            </button>
            <span className="text-white/35">
              {phase === "cutting" ? "listen to the hole" : "click a notehead to cut it"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function AmadeusNotes({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="amadeus-notes-title"
      gameId="amadeus-notes"
      eyebrow="The Emperor's critique"
      title="Too many notes"
      startLabel="Take the Emperor's note"
      stage
      howToPlay={{
        objective:
          "Find the note that costs the phrase least to lose — three tries in each of four passages.",
        controls: [
          { keys: "click a notehead", does: "cut that note and hear the passage with the hole in it" },
          { keys: "P", does: "play the passage again as written" },
          { keys: "it cannot be cut", does: "end the passage early on your best try so far" },
        ],
        tip: "Every cut is scored by the damage it does, and the phrase leans harder on some notes than others — the cheapest one to lose is rarely the one that looks spare.",
      }}
      reference={{
        quote: "There are simply too many notes.",
        scene: "Amadeus (1984) · the Emperor's critique",
      }}
      onClose={onClose}
    >
      <TooManyNotes />
    </SimulationShell>
  );
}
