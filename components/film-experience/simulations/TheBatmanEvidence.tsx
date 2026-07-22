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
  CLUES,
  THREADS,
  VERDICTS,
  VERDICT_PROMPT,
  clueById,
  threadFor,
  type ClueNode,
} from "@/components/film-experience/simulations/TheBatmanEvidenceData";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// The corkboard as deduction rather than matching. Six clues are pinned; a true
// thread writes a line in the file and pulls two more clues onto the board, so
// the puzzle opens as you solve it. A wrong thread costs certainty — the board
// can go cold. When every thread runs, one question is left: name what they all
// run through.

const SCORE_ID = "the-batman-evidence";
const CERTAINTY_START = 100;
const WRONG_COST = 14;
const THREAD_SCORE = 180;
const DRAW_MS = 460;
const MAX_PINS = 60;

type Phase = "linking" | "naming" | "paused" | "cold" | "done";
type Pinned = { a: string; b: string; at: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; size: number };

function CorkBoard() {
  const [phase, setPhase] = useState<Phase>("linking");
  const [selected, setSelected] = useState<string | null>(null);
  const [pinned, setPinned] = useState<readonly Pinned[]>([]);
  const [revealed, setRevealed] = useState<readonly string[]>([]);
  const [certainty, setCertainty] = useState(CERTAINTY_START);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [file, setFile] = useState<readonly string[]>([]);
  const [tell, setTell] = useState<{ text: string; bad: boolean } | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const [verdictPicked, setVerdictPicked] = useState<string | null>(null);
  // Which clue the exhibit card is reading out. Hover and focus both drive it;
  // touch has neither, so `reading` turns every card into an inspect target
  // instead of a pairing target.
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const reducedMotion = useReducedMotion();
  const audio = useBatmanAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const certaintyBarRef = useRef<HTMLDivElement>(null);
  const certaintyTextRef = useRef<HTMLSpanElement>(null);
  const certaintyGlyphRef = useRef<HTMLSpanElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("linking");
  const pinnedRef = useRef<Pinned[]>([]);
  const revealedRef = useRef<Set<string>>(new Set());
  const rejectRef = useRef<{ a: string; b: string; at: number } | null>(null);
  const certaintyRef = useRef(CERTAINTY_START);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const sparksRef = useRef<Spark[]>([]);
  const endAtRef = useRef(-1);
  const drawRef = useRef<(now: number) => void>(() => {});
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paintCertainty = useCallback(
    (value: number) =>
      paintBatmanMeter(certaintyBarRef, certaintyTextRef, certaintyGlyphRef, value),
    []
  );

  const visible = useMemo(
    () => CLUES.filter((clue) => clue.tier === 1 || revealed.includes(clue.id)),
    [revealed]
  );

  const threadedIds = useMemo(() => {
    const set = new Set<string>();
    for (const link of pinned) {
      set.add(link.a);
      set.add(link.b);
    }
    return set;
  }, [pinned]);

  const spawnSparks = useCallback(
    (nx: number, ny: number, count: number) => {
      if (reducedMotion) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const sparks = sparksRef.current;
      for (let i = 0; i < count; i += 1) {
        if (sparks.length >= MAX_PINS) break;
        sparks.push({
          x: nx * canvas.width + (Math.random() - 0.5) * 18,
          y: ny * canvas.height + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 1.4,
          vy: -0.4 - Math.random() * 1.3,
          life: 1,
          size: 1 + Math.random() * 2.2,
        });
      }
    },
    [reducedMotion]
  );

  const reset = useCallback(() => {
    pinnedRef.current = [];
    revealedRef.current = new Set();
    rejectRef.current = null;
    certaintyRef.current = CERTAINTY_START;
    scoreRef.current = 0;
    streakRef.current = 0;
    sparksRef.current = [];
    endAtRef.current = -1;
    paintCertainty(CERTAINTY_START);
    setPinned([]);
    setRevealed([]);
    setCertainty(CERTAINTY_START);
    setScore(0);
    setStreak(0);
    setFile([]);
    setSelected(null);
    setTell(null);
    setNote(null);
    setVerdictPicked(null);
    setInspectId(null);
    phaseRef.current = "linking";
    setPhase("linking");
  }, [paintCertainty]);

  const goCold = useCallback(() => {
    audio.fail();
    endAtRef.current = performance.now();
    recordSimulationScore(SCORE_ID, scoreRef.current);
    phaseRef.current = "cold";
    setPhase("cold");
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio]);

  const pick = useCallback(
    (clue: ClueNode) => {
      if (phaseRef.current !== "linking") return;
      audio.unlock();
      if (threadedIds.has(clue.id)) return;
      if (selected === null) {
        setSelected(clue.id);
        audio.tick(1);
        setTell({ text: clue.card, bad: false });
        return;
      }
      if (selected === clue.id) {
        setSelected(null);
        return;
      }
      const other = clueById.get(selected);
      if (!other) {
        setSelected(clue.id);
        return;
      }
      const thread = threadFor(other.id, clue.id);
      if (!thread) {
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        rejectRef.current = { a: other.id, b: clue.id, at: performance.now() };
        setShakeTick((t) => t + 1);
        setSelected(null);
        setTell({
          text: `No thread from ${other.label} to ${clue.label}. Both are true; neither explains the other.`,
          bad: true,
        });
        certaintyRef.current = Math.max(0, certaintyRef.current - WRONG_COST);
        setCertainty(certaintyRef.current);
        paintCertainty(certaintyRef.current);
        if (certaintyRef.current <= 0) goCold();
        if (reducedMotion) drawRef.current(performance.now());
        return;
      }

      // A true thread: pin it, write the line, and pull up what it exposes.
      const link: Pinned = { a: thread.a, b: thread.b, at: performance.now() };
      pinnedRef.current = [...pinnedRef.current, link];
      setPinned(pinnedRef.current);
      setSelected(null);
      streakRef.current += 1;
      setStreak(streakRef.current);
      const bonus = THREAD_SCORE + (streakRef.current - 1) * 60;
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      setNote({ id: performance.now(), text: `thread pinned +${bonus}` });
      setFile((lines) => [...lines, thread.note]);
      setTell({ text: thread.note, bad: false });
      audio.lock();
      const from = clueById.get(thread.a);
      const to = clueById.get(thread.b);
      if (from && to) spawnSparks((from.x + to.x) / 2, (from.y + to.y) / 2, 14);

      if (thread.reveals.length > 0) {
        for (const id of thread.reveals) revealedRef.current.add(id);
        setRevealed(Array.from(revealedRef.current));
        audio.clear();
      }

      if (pinnedRef.current.length >= THREADS.length) {
        phaseRef.current = "naming";
        setPhase("naming");
        window.requestAnimationFrame(() => advanceRef.current?.focus());
      }
      if (reducedMotion) drawRef.current(performance.now());
    },
    [audio, goCold, paintCertainty, reducedMotion, selected, spawnSparks, threadedIds]
  );

  const nameIt = useCallback(
    (text: string) => {
      if (phaseRef.current !== "naming") return;
      audio.unlock();
      const verdict = VERDICTS.find((entry) => entry.text === text);
      if (!verdict) return;
      setVerdictPicked(text);
      if (!verdict.right) {
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        setShakeTick((t) => t + 1);
        setTell({ text: verdict.why, bad: true });
        certaintyRef.current = Math.max(0, certaintyRef.current - WRONG_COST * 2);
        setCertainty(certaintyRef.current);
        paintCertainty(certaintyRef.current);
        if (certaintyRef.current <= 0) goCold();
        return;
      }
      const conviction = Math.round(certaintyRef.current * 8);
      scoreRef.current += 400 + conviction;
      setScore(scoreRef.current);
      setNote({ id: performance.now(), text: `case named +${400 + conviction}` });
      setTell({ text: verdict.why, bad: false });
      setFile((lines) => [...lines, verdict.text]);
      endAtRef.current = performance.now();
      audio.win();
      recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = "done";
      setPhase("done");
      window.requestAnimationFrame(() => advanceRef.current?.focus());
    },
    [audio, goCold, paintCertainty]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "linking") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "linking";
      setPhase("linking");
    }
  }, []);

  // --- The board ----------------------------------------------------------

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
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Cork: a soft speckle so the board reads as a surface, not a void.
      context.fillStyle = accentAlpha(0.09);
      for (let i = 0; i < 260; i += 1) {
        const x = ((i * 137) % 1000) / 1000;
        const y = ((i * 311) % 997) / 997;
        context.fillRect(x * width, y * height, 1.5, 1.5);
      }

      const px = (n: number) => n * width;
      const py = (n: number) => n * height;

      // Empty pins where clues have yet to be pulled up: the board tells you
      // it is not finished, so the gaps read as promise rather than dead space.
      context.strokeStyle = accentAlpha(0.16);
      context.lineWidth = 1;
      context.beginPath();
      for (const clue of CLUES) {
        if (clue.tier === 1 || revealedRef.current.has(clue.id)) continue;
        const x = px(clue.x);
        const y = py(clue.y);
        context.moveTo(x - 4, y);
        context.lineTo(x + 4, y);
        context.moveTo(x, y - 4);
        context.lineTo(x, y + 4);
      }
      context.stroke();

      // Threads: a red string with a little sag, drawn in when it is pinned.
      context.lineWidth = 1.5;
      for (const link of pinnedRef.current) {
        const a = clueById.get(link.a);
        const b = clueById.get(link.b);
        if (!a || !b) continue;
        const t = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - link.at) / DRAW_MS));
        const x1 = px(a.x);
        const y1 = py(a.y);
        const x2 = px(a.x + (b.x - a.x) * t);
        const y2 = py(a.y + (b.y - a.y) * t);
        const sag = py(0.05) * t;
        context.strokeStyle = accentAlpha(0.35 + 0.4 * t);
        context.beginPath();
        context.moveTo(x1, y1);
        context.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
        context.stroke();
        if (t >= 1) {
          // Pins at both ends once the string lands.
          context.fillStyle = palette.bright;
          for (const [cx, cy] of [
            [x1, y1],
            [x2, y2],
          ]) {
            context.beginPath();
            context.arc(cx, cy, 2.4, 0, Math.PI * 2);
            context.fill();
          }
        }
      }

      // A rejected pairing: a dashed line that fades out fast.
      const reject = rejectRef.current;
      if (reject) {
        const t = reducedMotion ? 0.4 : (now - reject.at) / 620;
        if (t >= 1) {
          rejectRef.current = null;
        } else {
          const a = clueById.get(reject.a);
          const b = clueById.get(reject.b);
          if (a && b) {
            context.save();
            context.setLineDash([4, 4]);
            context.strokeStyle = accentAlpha(0.5 * (1 - t));
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(px(a.x), py(a.y));
            context.lineTo(px(b.x), py(b.y));
            context.stroke();
            context.restore();
          }
        }
      }

      // Sparks off a fresh pin.
      if (!reducedMotion) {
        const sparks = sparksRef.current;
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const spark = sparks[i];
          spark.x += spark.vx;
          spark.y += spark.vy;
          spark.vy += 0.02;
          spark.life -= 0.02;
          if (spark.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(spark.life * 0.7);
          context.fillRect(spark.x, spark.y, spark.size, spark.size);
        }
      }

      // The closing beat: the whole web lights, or the board goes dark.
      if (endAtRef.current > 0) {
        const t = reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (now - endAtRef.current) / 900));
        if (phaseRef.current === "cold") {
          context.fillStyle = palette.inkSoft;
          context.globalAlpha = t * 0.75;
          context.fillRect(0, 0, width, height);
          context.globalAlpha = 1;
        } else if (phaseRef.current === "done") {
          context.strokeStyle = palette.bright;
          context.globalAlpha = 0.2 + 0.5 * t;
          context.lineWidth = 2;
          context.strokeRect(3, 3, width - 6, height - 6);
          context.globalAlpha = 1;
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
      if (!document.hidden) draw(now);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, pinned, revealed, phase, certainty]);

  const over = phase === "cold" || phase === "done";

  // Hover and focus win over selection, so moving across the board always reads
  // out the pin under the cursor; selection is the resting fallback.
  const detail = useMemo(
    () => clueById.get(inspectId ?? selected ?? "") ?? null,
    [inspectId, selected]
  );

  const status = useMemo(() => {
    if (phase === "done") return `The board is closed and named. ${score} points.`;
    if (phase === "cold") return `The board went cold with ${pinned.length} threads. ${score} points banked.`;
    if (phase === "paused") return "Held. Nothing is moving on the board.";
    if (phase === "naming") return VERDICT_PROMPT;
    if (reading)
      return "Reading. Tap any pin for its exhibit card — nothing gets strung while this is on.";
    if (selected) return `${clueById.get(selected)?.label} selected — pick what explains it.`;
    return `${pinned.length} of ${THREADS.length} threads pinned — pick two clues that explain each other.`;
  }, [phase, pinned.length, reading, score, selected]);

  return (
    <div
      data-sim-state={phase}
      data-links={pinned.length}
      data-evidence-score={score}
      data-evidence-certainty={Math.round(certainty)}
      data-evidence-clues={visible.length}
      className={`flex flex-col gap-3 ${!reducedMotion && phase === "cold" ? "bat-jolt" : ""}`}
      onPointerDownCapture={markPress}
    >
      <BatmanKeyframes />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          threads <span className="text-accent">{pinned.length}</span>/{THREADS.length}
        </span>
        <span>
          clues <span className="text-accent">{visible.length}</span>/{CLUES.length}
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
          certainty{" "}
          <span ref={certaintyTextRef} className="tabular-nums text-accent">
            100%
          </span>
          <span ref={certaintyGlyphRef} aria-hidden className="text-accent/70">
            ▮▮▮▮▮
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <BatmanMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {!over && phase !== "naming" && (
            <button
              type="button"
              onClick={() => setReading((value) => !value)}
              aria-pressed={reading}
              aria-label={
                reading
                  ? "Stop reading clues and go back to stringing threads"
                  : "Read clues: tap a clue for its exhibit card without pinning a thread"
              }
              className={`bat-press border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                reading
                  ? "border-accent bg-accent/15 text-accent-bright"
                  : "border-accent/30 hover:bg-accent/10"
              }`}
            >
              {reading ? "reading ✓" : "read clues"}
            </button>
          )}
          {!over && phase !== "naming" && (
            <BatmanChip onClick={togglePause} label={phase === "paused" ? "Resume" : "Pause"}>
              {phase === "paused" ? "resume" : "pause"}
            </BatmanChip>
          )}
        </span>
      </div>

      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={certaintyBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      <div
        key={`board-${shakeTick}`}
        className={`relative h-64 w-full overflow-hidden border border-accent/25 bg-ink/60 sm:h-72 ${
          !reducedMotion && tell?.bad ? "bat-shake" : ""
        }`}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {visible.map((clue) => {
          const isThreaded = threadedIds.has(clue.id);
          const isSelected = selected === clue.id;
          const isNew = clue.tier === 2;
          const isInspected = inspectId === clue.id;
          // The accessible name still opens with "Clue LABEL" so nothing that
          // targets these by name breaks; the exhibit reads out after it, which
          // is the only way a screen reader ever gets the hover card.
          const base = reading
            ? `Read clue ${clue.label}`
            : isThreaded
              ? `${clue.label}, threaded`
              : `Clue ${clue.label}${isSelected ? ", selected" : ""}`;
          return (
            <button
              key={clue.id}
              type="button"
              onClick={() => {
                setInspectId(clue.id);
                if (!reading) pick(clue);
              }}
              onPointerEnter={() => setInspectId(clue.id)}
              onPointerLeave={() => setInspectId((id) => (id === clue.id ? null : id))}
              onFocus={() => setInspectId(clue.id)}
              onBlur={() => setInspectId((id) => (id === clue.id ? null : id))}
              disabled={reading ? phase === "paused" : isThreaded || phase !== "linking"}
              aria-pressed={reading ? isInspected : isSelected}
              aria-label={`${base}. Found: ${clue.found} ${clue.where} Why it might matter: ${clue.matters}`}
              style={{ left: `${clue.x * 100}%`, top: `${clue.y * 100}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 border px-2 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isThreaded
                  ? "border-accent/70 bg-accent/15 text-accent"
                  : isSelected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-white/25 bg-ink/85 text-white/70 hover:border-accent/50 hover:text-accent"
              } ${isInspected ? "ring-1 ring-accent/60" : ""} ${
                isNew && !reducedMotion ? "bat-rise" : ""
              }`}
            >
              {clue.label}
              {isThreaded && (
                <span aria-hidden className="ml-1">
                  ✓
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

      {/* The exhibit card. Hover or focus a pin to read it; on touch, turn on
          "read clues" and tap. It never names the partner — it gives the player
          the same three things a detective would have: what it is, where it
          came from, and the question it opens. */}
      <div
        data-exhibit={detail?.id ?? ""}
        className="min-h-[5.25rem] border border-accent/25 bg-ink/60 p-2"
      >
        {detail ? (
          <div className={reducedMotion ? "" : "bat-rise"} key={detail.id}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-accent">
              exhibit · {detail.label}
            </p>
            <dl className="mt-1 flex flex-col gap-0.5 text-[11px] normal-case leading-relaxed">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/40">
                  found
                </dt>
                <dd className="text-white/70">{detail.found}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/40">
                  where
                </dt>
                <dd className="text-white/70">{detail.where}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/40">
                  why it matters
                </dt>
                <dd className="text-white/70">{detail.matters}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-[11px] normal-case leading-relaxed text-white/45">
            Hover or tab onto a pin to read its exhibit card — what was found,
            where it came from, and what it opens. On a touch screen, press{" "}
            <span className="text-accent">read clues</span> first, then tap.
          </p>
        )}
      </div>

      {phase === "naming" && (
        <div className={`flex flex-col gap-1.5 ${reducedMotion ? "" : "bat-rise"}`}>
          <p className="text-[11px] normal-case leading-relaxed text-white/80">{VERDICT_PROMPT}</p>
          {VERDICTS.map((verdict, index) => (
            <button
              key={verdict.text}
              ref={index === 0 ? advanceRef : undefined}
              type="button"
              onClick={() => nameIt(verdict.text)}
              disabled={verdictPicked === verdict.text}
              aria-label={`Name the case: ${verdict.text}`}
              className="bat-press flex items-start gap-2 border border-accent/30 px-3 py-2 text-left text-[11px] normal-case leading-relaxed transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:border-white/10 disabled:text-white/25 disabled:line-through"
            >
              <span aria-hidden className="text-accent/60">
                {index + 1}
              </span>
              <span>{verdict.text}</span>
            </button>
          ))}
        </div>
      )}

      {tell && (
        <p
          key={`tell-${shakeTick}-${pinned.length}`}
          className={`border-l-2 pl-2 text-[11px] normal-case leading-relaxed ${
            tell.bad ? "border-accent-bright/70 text-white/70" : "border-accent/40 text-white/60"
          }`}
        >
          <span aria-hidden className="mr-1 text-accent">
            {tell.bad ? "✕" : "◆"}
          </span>
          {tell.text}
        </p>
      )}

      {file.length > 0 && (
        <ol className="flex flex-col gap-1 border border-accent/25 bg-ink/60 p-2 text-[11px] normal-case leading-relaxed">
          <li className="text-[9px] uppercase tracking-[0.18em] text-white/40">The file</li>
          {file.map((line, index) => (
            <li
              key={line}
              className={`text-accent ${
                index === file.length - 1 && !reducedMotion ? "bat-rise" : ""
              }`}
            >
              {line}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="normal-case tracking-[0.06em] text-white/60">
          {status}
        </p>
        {over && (
          <BatmanChip
            innerRef={advanceRef}
            bright
            onClick={() => {
              if (freshPress()) reset();
            }}
          >
            {phase === "done" ? "String it again" : "Clear the board"}
          </BatmanChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function TheBatmanEvidence({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="the-batman-evidence-title"
      gameId="the-batman-evidence"
      eyebrow="Deduce · connect"
      title="The evidence board"
      startLabel="String the board"
      stage
      howToPlay={{
        objective:
          "Pin every true thread between the clues, then name what the whole case runs through.",
        controls: [
          { keys: "hover / Tab", does: "read a pin's exhibit card — what was found, where, and what it opens" },
          { keys: "read clues", does: "on touch, turn this on and tap a pin to read it without stringing anything" },
          { keys: "click", does: "pick a clue, then pick the one that explains it — a true pair pins a thread" },
          { keys: "click again", does: "tap the selected clue a second time to drop it" },
          { keys: "Tab / Enter", does: "step between clues and pin them without a pointer" },
          { keys: "verdict", does: "once every thread is pinned, choose the line that names the case" },
        ],
        tip: "Every pin carries an exhibit card under the board; read two of them and the thread between them usually says itself. A pairing with no thread costs 14% certainty and a wrong verdict costs twice that; at zero the board goes cold. Each true thread pulls two more clues onto the board, so it opens as you solve it.",
      }}
      reference={{
        scene: "The Batman (2022) · stringing the conspiracy across pinned photos",
      }}
      onClose={onClose}
    >
      <CorkBoard />
    </SimulationShell>
  );
}
