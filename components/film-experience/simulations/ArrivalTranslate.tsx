"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ArrivalGlyph,
  ArrivalLexiconKey,
  MESSAGES,
  describeMark,
  mismatchReason,
  word,
} from "@/components/film-experience/simulations/ArrivalLexicon";
import {
  ArrivalKeyframes,
  ArrivalMuteButton,
  ARRIVAL_BUTTON,
  useArrivalAudio,
  useCanvasSize,
  withAlpha,
} from "@/components/film-experience/simulations/ArrivalShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// Four messages, each a real sentence written in circular ink. Every mark on
// the table carries its own evidence — a radical that names its family of
// meaning, and a countable number of strokes that picks the word inside it —
// so the message can be read rather than guessed at. Wrong readings say why
// they are wrong. The clock is long on purpose: this is a reading, not a race.
const SCORE_ID = "arrival-translate";

/** Hints in hand at the start, and the ceiling they may be topped back up to. */
const START_HINTS = 3;
const MAX_HINTS = 5;
const HINT_COST = 40;
const WRONG_COST = 20;

type Phase = "reading" | "paused" | "solved" | "lost" | "done";

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

const multiplierFor = (streak: number) =>
  streak >= 6 ? 4 : streak >= 4 ? 3 : streak >= 2 ? 2 : 1;

function TranslateTrial() {
  const [messageIndex, setMessageIndex] = useState(0);
  const message = MESSAGES[Math.min(messageIndex, MESSAGES.length - 1)];

  const [order, setOrder] = useState<string[]>(() => shuffle(MESSAGES[0].candidates));
  /** slot index → the word id read into it. */
  const [solvedSlots, setSolvedSlots] = useState<Record<number, string>>({});
  /** slot index → word ids struck off it, by a wrong reading or by a hint. */
  const [ruledOut, setRuledOut] = useState<Record<number, string[]>>({});
  const [selected, setSelected] = useState<number | null>(0);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("reading");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hints, setHints] = useState(START_HINTS);
  const [note, setNote] = useState<string | null>(null);
  const [gained, setGained] = useState<{ id: number; text: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MESSAGES[0].seconds);
  const [keyOpen, setKeyOpen] = useState(true);

  const reducedMotion = useReducedMotion();
  const audio = useArrivalAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const redrawRef = useRef<() => void>(() => {});
  const phaseRef = useRef<Phase>("reading");
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const remainingRef = useRef(MESSAGES[0].seconds);
  const totalRef = useRef(MESSAGES[0].seconds);
  const lastRef = useRef(0);
  const flashTimer = useRef(0);
  // The button-morph guard: a press that began before the phase changed is the
  // trailing half of the gesture that changed it, not a new decision.
  const { freshPress, markPress } = useFreshPress(phase);

  const canvasSize = useCanvasSize(canvasRef, () => redrawRef.current());

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const setPhaseNow = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const armMessage = useCallback(
    (index: number, keepHints: number) => {
      const next = MESSAGES[Math.min(index, MESSAGES.length - 1)];
      setMessageIndex(Math.min(index, MESSAGES.length - 1));
      setOrder(shuffle(next.candidates));
      setSolvedSlots({});
      setRuledOut({});
      setSelected(0);
      setWrongFlash(null);
      setNote(null);
      setGained(null);
      setStreak(0);
      streakRef.current = 0;
      setHints(keepHints);
      remainingRef.current = next.seconds;
      totalRef.current = next.seconds;
      setSecondsLeft(next.seconds);
      lastRef.current = performance.now();
      setPhaseNow("reading");
    },
    [setPhaseNow]
  );

  useEffect(() => {
    armMessage(0, START_HINTS);
  }, [armMessage]);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    armMessage(0, START_HINTS);
  }, [armMessage]);

  const usedWords = useMemo(() => new Set(Object.values(solvedSlots)), [solvedSlots]);
  const remainingSlots = message.words.length - Object.keys(solvedSlots).length;

  /** Commit `id` as the reading of the selected mark. */
  const commit = useCallback(
    (id: string) => {
      if (phaseRef.current !== "reading" || selected === null) return;
      if (solvedSlots[selected] !== undefined || usedWords.has(id)) return;

      const actual = word(message.words[selected]);
      const guess = word(id);

      if (guess.id !== actual.id) {
        streakRef.current = 0;
        setStreak(0);
        scoreRef.current = Math.max(0, scoreRef.current - WRONG_COST);
        setScore(scoreRef.current);
        setRuledOut((current) => {
          const already = current[selected] ?? [];
          return already.includes(id) ? current : { ...current, [selected]: [...already, id] };
        });
        setNote(mismatchReason(guess, actual));
        setWrongFlash(id);
        audio.play({ freq: 165, duration: 0.3, gain: 0.045 });
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setWrongFlash(null), 460);
        return;
      }

      const nextStreak = streakRef.current + 1;
      streakRef.current = nextStreak;
      const multiplier = multiplierFor(nextStreak);
      const timeLeft = totalRef.current ? remainingRef.current / totalRef.current : 1;
      const points = Math.round((100 + Math.max(0, timeLeft) * 60) * multiplier);
      scoreRef.current += points;
      setStreak(nextStreak);
      setScore(scoreRef.current);
      setGained({ id: performance.now(), text: `${guess.label} +${points}` });
      audio.play({ freq: 330 + multiplier * 40, duration: 0.35, gain: 0.045 });

      const nextSolved = { ...solvedSlots, [selected]: id };
      setSolvedSlots(nextSolved);
      setWrongFlash(null);

      const openSlot = message.words.findIndex(
        (_, slot) => nextSolved[slot] === undefined
      );
      setSelected(openSlot === -1 ? null : openSlot);

      if (Object.keys(nextSolved).length >= message.words.length) {
        const bonus = 150 + messageIndex * 100 + Math.round(Math.max(0, timeLeft) * 150);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        recordSimulationScore(SCORE_ID, scoreRef.current);
        setHints((current) => Math.min(MAX_HINTS, current + 1));
        setNote(message.gloss);
        audio.play({ freq: 494, duration: 0.6, gain: 0.045, delay: 0.1 });
        setPhaseNow(messageIndex + 1 >= MESSAGES.length ? "done" : "solved");
        return;
      }

      setNote(`Mark ${selected + 1} reads "${guess.label}".`);
    },
    [audio, message, messageIndex, selected, setPhaseNow, solvedSlots, usedWords]
  );

  /**
   * The spendable hint: it never names the answer. It strikes off half of the
   * readings still open on the selected mark, so the board is narrowed and the
   * player still does the last step. When one reading is all that is left, the
   * hint confirms it for free rather than charging for a certainty.
   */
  const spendHint = useCallback(() => {
    if (phaseRef.current !== "reading" || selected === null) return;
    if (solvedSlots[selected] !== undefined) return;
    const actual = message.words[selected];
    const struck = ruledOut[selected] ?? [];
    const open = order.filter(
      (id) => !usedWords.has(id) && !struck.includes(id) && id !== actual
    );
    if (open.length === 0) {
      setNote(
        `Only one reading is still open on mark ${selected + 1} — the marks have already ruled the rest out.`
      );
      return;
    }
    if (hints <= 0) {
      setNote("No hints left. Count the strokes and read the radical.");
      return;
    }
    const cut = Math.max(1, Math.ceil(open.length / 2));
    const removed = open.slice(0, cut);
    setRuledOut((current) => ({ ...current, [selected]: [...struck, ...removed] }));
    setHints((current) => current - 1);
    scoreRef.current = Math.max(0, scoreRef.current - HINT_COST);
    setScore(scoreRef.current);
    audio.play({ freq: 392, duration: 0.35, gain: 0.035, slideTo: 294 });
    const left = open.length - removed.length + 1;
    setNote(
      `Struck off ${removed.map((id) => word(id).label).join(", ")}. ${left} reading${
        left === 1 ? "" : "s"
      } still stand on mark ${selected + 1}.`
    );
  }, [audio, hints, message, order, ruledOut, selected, solvedSlots, usedWords]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "reading") setPhaseNow("paused");
    else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      setPhaseNow("reading");
    }
  }, [setPhaseNow]);

  // One rAF: it runs the long clock down and paints the dial. Reduced motion
  // gets the same board with a still dial and no clock at all — the puzzle is
  // the point, and it plays perfectly untimed.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    // Sampled once: the grade cannot change while this dialog is open, and
    // reading it per frame would cost a style recalculation per tint.
    const palette = getLiveThemePalette();
    const tint = (alpha: number) => withAlpha(palette.accent, alpha);

    const draw = () => {
      if (!canvas || !context) return;
      const { width: w, height: h } = canvasSize.current;
      if (!w || !h) return;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.38;
      const left = totalRef.current
        ? Math.max(0, Math.min(1, remainingRef.current / totalRef.current))
        : 1;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, w, h);
      context.strokeStyle = tint(0.18);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();

      // Twelve marks, the film's twelve shells.
      for (let mark = 0; mark < 12; mark += 1) {
        const angle = (mark / 12) * Math.PI * 2 - Math.PI / 2;
        context.strokeStyle = tint(mark % 3 === 0 ? 0.4 : 0.16);
        context.beginPath();
        context.moveTo(cx + Math.cos(angle) * radius * 0.86, cy + Math.sin(angle) * radius * 0.86);
        context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        context.stroke();
      }

      const head = -Math.PI / 2 + left * Math.PI * 2;
      context.strokeStyle = tint(left < 0.2 ? 0.95 : 0.7);
      context.lineWidth = left < 0.2 ? 3 : 2;
      context.beginPath();
      context.arc(cx, cy, radius, -Math.PI / 2, head);
      context.stroke();
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx + Math.cos(head) * radius * 0.8, cy + Math.sin(head) * radius * 0.8);
      context.stroke();
      context.fillStyle = palette.bright;
      context.beginPath();
      context.arc(cx + Math.cos(head) * radius, cy + Math.sin(head) * radius, 3, 0, Math.PI * 2);
      context.fill();
    };

    redrawRef.current = draw;
    draw();

    if (reducedMotion) return;

    lastRef.current = performance.now();
    let frame = 0;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(64, now - lastRef.current);
      lastRef.current = now;
      if (!document.hidden) {
        if (phaseRef.current === "reading") {
          remainingRef.current = Math.max(0, remainingRef.current - dt / 1000);
          setSecondsLeft((current) => {
            const ceil = Math.ceil(remainingRef.current);
            return ceil === current ? current : ceil;
          });
          if (remainingRef.current <= 0) {
            audio.play({ freq: 104, type: "sine", duration: 0.8, gain: 0.05, slideTo: 70 });
            setNote("The hand came round. The message scatters before it is read.");
            setPhaseNow("lost");
          }
        }
        draw();
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [audio, canvasSize, reducedMotion, setPhaseNow]);

  useEffect(() => {
    if (phase === "solved" || phase === "lost" || phase === "done") {
      window.requestAnimationFrame(() => focusRef.current?.focus());
    }
  }, [phase]);

  const status = useMemo(() => {
    if (note) return note;
    if (phase === "done") return `Every message holds. ${score} points banked.`;
    if (phase === "solved") return message.gloss;
    if (phase === "lost") return "The message scatters. Read it again.";
    if (phase === "paused") return "Held. The hand is still.";
    if (selected === null) return "Choose a mark to read.";
    // The first message reads the evidence aloud for you; after that the
    // reading is yours to do, and the key stays open beside it.
    if (messageIndex === 0) {
      const mark = word(message.words[selected]);
      return `Reading mark ${selected + 1}: ${describeMark(
        mark.family,
        mark.strokes
      )}. Find that in the key.`;
    }
    return `Reading mark ${selected + 1}. Name its radical, count its strokes, then choose.`;
  }, [message, messageIndex, note, phase, score, selected]);

  const multiplier = multiplierFor(streak);
  const clock = reducedMotion
    ? "untimed"
    : `${Math.floor(secondsLeft / 60)}:${String(Math.max(0, secondsLeft % 60)).padStart(2, "0")}`;

  return (
    <div
      data-sim-state={phase}
      data-remaining={remainingSlots}
      data-translate-message={Math.min(messageIndex + 1, MESSAGES.length)}
      data-translate-score={score}
      data-translate-streak={streak}
      data-translate-hints={hints}
      className="flex flex-col gap-3"
      onPointerDownCapture={markPress}
    >
      <ArrivalKeyframes />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          message <span className="text-accent">{Math.min(messageIndex + 1, MESSAGES.length)}</span>/
          {MESSAGES.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "arr-anim-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          streak{" "}
          <span className={multiplier > 1 ? "text-accent-bright" : "text-accent"}>x{multiplier}</span>{" "}
          ({streak})
        </span>
        <span>
          clock <span className="text-accent">{clock}</span>
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          {(phase === "reading" || phase === "paused") && !reducedMotion && (
            <button type="button" onClick={togglePause} className={ARRIVAL_BUTTON}>
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setKeyOpen((open) => !open)}
            aria-pressed={keyOpen}
            className={ARRIVAL_BUTTON}
          >
            {keyOpen ? "hide the key" : "show the key"}
          </button>
          <ArrivalMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
        </span>
      </div>

      {/* The message itself: one mark per slot, in order, with the sentence
        * assembling underneath as readings land. */}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-24 w-24 shrink-0 self-center border border-accent/25 bg-ink/60 sm:h-32 sm:w-32 sm:self-start"
        />
        <div
          className="flex min-w-0 flex-1 flex-wrap gap-2"
          role="group"
          aria-label="The message"
          style={{ touchAction: "manipulation" }}
        >
          {message.words.map((id, slot) => {
            const mark = word(id);
            const read = solvedSlots[slot];
            const isSelected = selected === slot;
            const struck = ruledOut[slot] ?? [];
            const label = read
              ? `Mark ${slot + 1} of ${message.words.length}, reads ${word(read).label}`
              : `Mark ${slot + 1} of ${message.words.length}, unread. ${describeMark(
                  mark.family,
                  mark.strokes
                )}.${struck.length ? ` Ruled out: ${struck.map((x) => word(x).label).join(", ")}.` : ""}`;
            return (
              <button
                key={slot}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                disabled={read !== undefined || (phase !== "reading" && phase !== "paused")}
                onClick={() => setSelected(slot)}
                className={`flex w-[7.5rem] flex-col items-center gap-1 border px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-75 ${
                  isSelected ? "border-accent bg-accent/15" : "border-accent/30 hover:bg-accent/10"
                }`}
              >
                <ArrivalGlyph
                  family={mark.family}
                  strokes={mark.strokes}
                  drawn={read !== undefined}
                  className="h-12 w-12"
                />
                <span
                  className={`block text-[10px] uppercase tracking-[0.1em] ${
                    read ? "text-white/85" : "text-white/35"
                  } ${read && !reducedMotion ? "arr-anim-rise" : ""}`}
                >
                  {read ? word(read).label : "unread"}
                </span>
                {!read && struck.length > 0 && (
                  <span aria-hidden className="block text-[9px] leading-tight text-white/30">
                    {struck.map((x) => (
                      <span key={x} className="mr-1 line-through">
                        {word(x).label}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {gained && (
          <p
            key={gained.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright ${
              reducedMotion ? "" : "arr-anim-float"
            }`}
          >
            {gained.text}
          </p>
        )}
      </div>

      <p className="text-[12px] normal-case leading-relaxed text-white/70">
        <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-white/40">reads</span>
        {message.words.map((id, slot) => (
          <span key={slot} className={solvedSlots[slot] ? "text-accent" : "text-white/30"}>
            {solvedSlots[slot] ? word(solvedSlots[slot]).label : "▮▮▮"}{" "}
          </span>
        ))}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="contents" role="group" aria-label="Readings">
        {order.map((id) => {
          const entry = word(id);
          const used = usedWords.has(id);
          const struckHere = selected !== null && (ruledOut[selected] ?? []).includes(id);
          const flashing = wrongFlash === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={`Reading ${entry.label}`}
              disabled={used || struckHere || selected === null || phase !== "reading"}
              onClick={() => commit(id)}
              className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${
                flashing
                  ? `border-accent bg-accent/20 ${reducedMotion ? "" : "arr-anim-shake"}`
                  : "border-accent/30 hover:bg-accent/10"
              } ${used || struckHere ? "text-white/40 line-through" : "text-accent"}`}
            >
              {entry.label}
            </button>
          );
        })}
        </span>
        <button
          type="button"
          onClick={spendHint}
          disabled={selected === null || phase !== "reading"}
          className={`${ARRIVAL_BUTTON} ml-auto`}
        >
          Hint · {hints} left
        </button>
      </div>

      {keyOpen && <ArrivalLexiconKey candidates={message.candidates} />}

      <p
        role="status"
        className="min-h-[2.6rem] text-[11px] normal-case leading-relaxed text-white/70"
      >
        {status}
      </p>

      <div className="flex min-h-[2.25rem] flex-wrap gap-2">
        {phase === "solved" && (
          <button
            ref={focusRef}
            type="button"
            onClick={() => {
              if (freshPress()) armMessage(messageIndex + 1, hints);
            }}
            className={ARRIVAL_BUTTON}
          >
            The next message
          </button>
        )}
        {phase === "lost" && (
          <button
            ref={focusRef}
            type="button"
            onClick={() => {
              if (freshPress()) armMessage(messageIndex, Math.max(START_HINTS, hints));
            }}
            className={ARRIVAL_BUTTON}
          >
            Read it again
          </button>
        )}
        {phase === "done" && (
          <button
            ref={focusRef}
            type="button"
            onClick={() => {
              if (freshPress()) restart();
            }}
            className={ARRIVAL_BUTTON}
          >
            Begin the message again
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ArrivalTranslate({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="arrival-translate-title"
      gameId="arrival-translate"
      eyebrow="Reading"
      title="Translate"
      startLabel="Read the message"
      stage
      reference={{
        quote: "What is your purpose on Earth?",
        scene: "Arrival (2016) · the one question everything hangs on",
      }}
      howToPlay={{
        objective:
          "Read four written messages. Each mark shows a radical (its family of meaning) and a number of strokes (which word inside that family) — match the key, and the sentence assembles itself.",
        controls: [
          { keys: "click a mark", does: "choose the logogram you are reading" },
          { keys: "click a word", does: "commit that reading; a wrong one tells you why" },
          { keys: "hint", does: "spend one to strike off half the readings still open on that mark" },
          { keys: "show the key", does: "open or close the radical key" },
        ],
        tip: "You start with three hints and earn one back for every message you finish. A hint costs 40 points and a wrong reading costs 20 — but a wrong reading is never wasted, it is struck off that mark and it tells you which radical or stroke count you misread.",
      }}
      onClose={onClose}
    >
      <TranslateTrial />
    </SimulationShell>
  );
}
