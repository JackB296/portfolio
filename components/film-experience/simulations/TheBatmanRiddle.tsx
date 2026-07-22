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
  ALPHABET,
  RIDDLE_DECK,
  keyDecode,
  keyEncode,
  rotate,
  shiftFor,
} from "@/components/film-experience/simulations/TheBatmanRiddleData";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// The cipher desk. Five cards, three kinds of lock, one trace clock.
//
// A rotation card gives every word its own dial, so a long card breaks into
// several small wins — the way a real Caesar falls apart once you guess where
// one word starts. A keyword card hides the alphabet behind a name you have to
// pick out of four. A rebus card is read, not decoded. Hints are a spendable
// resource that costs trace, and the trace is what the Riddler is watching.

const SCORE_ID = "the-batman-riddle";
const HINTS_PER_RUN = 3;
const HINT_TRACE_COST = 0.12;
const WRONG_TRACE_COST = 0.1;
const MAX_MOTES = 70;

type Phase = "running" | "solved" | "paused" | "caught" | "done";

type Mote = { x: number; y: number; vx: number; vy: number; life: number; size: number };

const wordScore = 80;
const cardScore = 240;
const streakBonus = (streak: number) => Math.max(0, streak - 1) * 90;

function CipherDesk() {
  const [seed] = useState(() => Math.floor(Date.now() / 1000) % 25);
  const [cardIndex, setCardIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [offsets, setOffsets] = useState<readonly number[]>([0]);
  const [locked, setLocked] = useState<readonly boolean[]>([false]);
  const [selectedWord, setSelectedWord] = useState(0);
  const [struck, setStruck] = useState<readonly string[]>([]);
  const [revealFirst, setRevealFirst] = useState<readonly number[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hints, setHints] = useState(HINTS_PER_RUN);
  const [solvedCards, setSolvedCards] = useState(0);
  const [tell, setTell] = useState<{ text: string; bad: boolean } | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const [tracePct, setTracePct] = useState(0);

  const reducedMotion = useReducedMotion();
  const audio = useBatmanAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const traceBarRef = useRef<HTMLDivElement>(null);
  const traceTextRef = useRef<HTMLSpanElement>(null);
  const traceGlyphRef = useRef<HTMLSpanElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);

  // Live values the paint loop reads without re-rendering React.
  const phaseRef = useRef<Phase>("running");
  const cardRef = useRef(0);
  const traceRef = useRef(0);
  const lastRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const cleanRef = useRef(true);
  const solvedAtRef = useRef(-1);
  const motesRef = useRef<Mote[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});
  // The trailing click of the gesture that resolved a card would otherwise land
  // on the "Next card" button that replaces the options in place, skipping a
  // beat. A real tap begins its press AFTER the phase changed; this rejects the
  // stray one by gesture identity.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    cardRef.current = cardIndex;
  }, [cardIndex]);

  const card = RIDDLE_DECK[cardIndex];

  // The card's ciphertext. Cheap enough to derive each render; the rotation is
  // a pure function of the run seed and the card, so it never drifts mid-card.
  const cipherWords = useMemo(() => {
    if (card.kind !== "caesar") return [];
    return card.words.map((word, i) => rotate(word, shiftFor(seed, cardIndex, i)));
  }, [card, cardIndex, seed]);
  const keyCipher = useMemo(
    () => (card.kind === "keyword" ? keyEncode(card.answer, card.key) : ""),
    [card]
  );

  const paintTrace = useCallback(
    (value: number) =>
      paintBatmanMeter(traceBarRef, traceTextRef, traceGlyphRef, value * 100),
    []
  );

  const spawnMotes = useCallback(
    (count: number) => {
      if (reducedMotion) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const motes = motesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (motes.length >= MAX_MOTES) break;
        motes.push({
          x: canvas.width * (0.2 + Math.random() * 0.6),
          y: canvas.height * (0.45 + Math.random() * 0.3),
          vx: (Math.random() - 0.5) * 1.7,
          vy: -0.4 - Math.random() * 1.6,
          life: 1,
          size: 1 + Math.random() * 2.6,
        });
      }
    },
    [reducedMotion]
  );

  const armCard = useCallback((index: number) => {
    const next = RIDDLE_DECK[index];
    const wordCount = next.kind === "caesar" ? next.words.length : 0;
    setCardIndex(index);
    cardRef.current = index;
    setOffsets(new Array(Math.max(1, wordCount)).fill(0));
    setLocked(new Array(Math.max(1, wordCount)).fill(false));
    setSelectedWord(0);
    setStruck([]);
    setRevealFirst([]);
    setTell(null);
    cleanRef.current = true;
    traceRef.current = 0;
    setTracePct(0);
    lastRef.current = performance.now();
    solvedAtRef.current = -1;
    phaseRef.current = "running";
    setPhase("running");
  }, []);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    motesRef.current = [];
    setScore(0);
    setStreak(0);
    setHints(HINTS_PER_RUN);
    setSolvedCards(0);
    setNote(null);
    armCard(0);
  }, [armCard]);

  useEffect(() => {
    armCard(0);
  }, [armCard]);

  useEffect(() => {
    paintTrace(tracePct / 100);
  }, [paintTrace, tracePct]);

  const bank = useCallback((value: number) => {
    recordSimulationScore(SCORE_ID, value);
  }, []);

  const caught = useCallback(() => {
    audio.fail();
    solvedAtRef.current = -1;
    bank(scoreRef.current);
    phaseRef.current = "caught";
    setPhase("caught");
    setShakeTick((tick) => tick + 1);
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio, bank]);

  const solveCard = useCallback(() => {
    const remaining = 1 - traceRef.current;
    const speed = Math.round(remaining * 260);
    let gained = cardScore + speed;
    if (cleanRef.current) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      gained += streakBonus(streakRef.current);
    } else {
      streakRef.current = 0;
      setStreak(0);
    }
    scoreRef.current += gained;
    setScore(scoreRef.current);
    setSolvedCards((count) => count + 1);
    setNote({ id: performance.now(), text: `card cracked +${gained}` });
    solvedAtRef.current = performance.now();
    spawnMotes(22);

    const last = cardRef.current + 1 >= RIDDLE_DECK.length;
    if (last) {
      audio.win();
      bank(scoreRef.current);
      phaseRef.current = "done";
      setPhase("done");
    } else {
      audio.clear();
      phaseRef.current = "solved";
      setPhase("solved");
    }
    window.requestAnimationFrame(() => advanceRef.current?.focus());
  }, [audio, bank, spawnMotes]);

  /** A wrong pick or a spent hint pushes the trace forward. */
  const pushTrace = useCallback(
    (amount: number) => {
      if (reducedMotion) return false;
      traceRef.current = Math.min(1, traceRef.current + amount);
      setTracePct(traceRef.current * 100);
      return traceRef.current >= 1;
    },
    [reducedMotion]
  );

  // --- Rotation cards -----------------------------------------------------

  const setWordOffset = useCallback(
    (wordIndex: number, nextOffset: number) => {
      if (phaseRef.current !== "running") return;
      if (locked[wordIndex]) return;
      const next = ((nextOffset % 26) + 26) % 26;
      setOffsets((current) => current.map((v, i) => (i === wordIndex ? next : v)));

      if (card.kind !== "caesar") return;
      const target = card.words[wordIndex];
      if (rotate(cipherWords[wordIndex], -next) !== target) {
        audio.tick(next);
        return;
      }
      // The word falls into place: lock it, and the card closes when the last
      // word locks.
      audio.lock();
      scoreRef.current += wordScore;
      setScore(scoreRef.current);
      setNote({ id: performance.now(), text: `${target} +${wordScore}` });
      spawnMotes(8);
      const nextLocked = locked.map((v, i) => (i === wordIndex ? true : v));
      setLocked(nextLocked);
      const nextOpen = nextLocked.findIndex((v) => !v);
      if (nextOpen >= 0) {
        setSelectedWord(nextOpen);
        return;
      }
      solveCard();
    },
    [audio, card, cipherWords, locked, solveCard, spawnMotes]
  );

  const nudge = useCallback(
    (delta: number) => {
      audio.unlock();
      setWordOffset(selectedWord, offsets[selectedWord] + delta);
    },
    [audio, offsets, selectedWord, setWordOffset]
  );

  /** Guess where a word starts: the dial jumps so its first letter reads as
   * the guess. This is how a rotation actually falls — you find one letter. */
  const guessFirstLetter = useCallback(
    (letter: string) => {
      audio.unlock();
      const cipher = cipherWords[selectedWord];
      if (!cipher) return;
      const cipherIndex = ALPHABET.indexOf(cipher[0]);
      const guessIndex = ALPHABET.indexOf(letter.toUpperCase());
      if (cipherIndex < 0 || guessIndex < 0) return;
      setWordOffset(selectedWord, cipherIndex - guessIndex);
    },
    [audio, cipherWords, selectedWord, setWordOffset]
  );

  // --- Keyword and rebus cards -------------------------------------------

  const pickOption = useCallback(
    (option: string) => {
      if (phaseRef.current !== "running") return;
      if (struck.includes(option)) return;
      audio.unlock();
      const right =
        card.kind === "keyword"
          ? option === card.key
          : card.kind === "rebus"
            ? option === card.answer
            : false;
      if (right) {
        audio.lock();
        scoreRef.current += wordScore;
        setScore(scoreRef.current);
        solveCard();
        return;
      }
      cleanRef.current = false;
      streakRef.current = 0;
      setStreak(0);
      audio.wrong();
      setStruck((current) => [...current, option]);
      setShakeTick((tick) => tick + 1);
      setTell({
        text:
          card.kind === "keyword"
            ? `"${option}" leaves the card as noise. Read what it spells before you commit.`
            : `"${option}" does not answer the picture.`,
        bad: true,
      });
      if (pushTrace(WRONG_TRACE_COST)) caught();
    },
    [audio, card, caught, pushTrace, solveCard, struck]
  );

  // --- Hints --------------------------------------------------------------

  const spendHint = useCallback(() => {
    if (phaseRef.current !== "running" || hints <= 0) return;
    audio.unlock();
    audio.tone({ freq: 660, slideTo: 440, duration: 0.16, gain: 0.5 });
    setHints((left) => left - 1);
    cleanRef.current = false;

    if (card.kind === "caesar") {
      const open = locked.findIndex((v) => !v);
      const wordIndex = locked[selectedWord] ? (open >= 0 ? open : selectedWord) : selectedWord;
      setRevealFirst((current) =>
        current.includes(wordIndex) ? current : [...current, wordIndex]
      );
      setTell({
        text: `Frequency read: that word starts with ${card.words[wordIndex][0]}.`,
        bad: false,
      });
    } else {
      const answer = card.kind === "keyword" ? card.key : card.answer;
      const victim = card.options.find((o) => o !== answer && !struck.includes(o));
      if (victim) setStruck((current) => [...current, victim]);
      setTell({ text: `One line struck from the card. ${victim ?? ""} is not it.`, bad: false });
    }
    if (pushTrace(HINT_TRACE_COST)) caught();
  }, [audio, card, caught, hints, locked, pushTrace, selectedWord, struck]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "running";
      setPhase("running");
    }
  }, []);

  // --- Keyboard -----------------------------------------------------------

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "SELECT" || target.tagName === "INPUT")) return;
      if (card.kind === "caesar") {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          nudge(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          nudge(1);
          return;
        }
        if (/^[a-zA-Z]$/.test(event.key)) {
          event.preventDefault();
          guessFirstLetter(event.key);
        }
        return;
      }
      const options = card.options;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        event.preventDefault();
        pickOption(options[index]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, guessFirstLetter, nudge, phase, pickOption]);

  // --- The card surface ---------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      // Size comes from the ResizeObserver, not from a layout read per frame.
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      // One palette read per frame, then batched strokes.
      const palette = getLiveThemePalette();
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      const trace = traceRef.current;

      // The card stock: a rectangle with a taped corner, inset to sit just
      // outside the text that is laid over it.
      const cx0 = width * 0.025;
      const cy0 = height * 0.055;
      const cw = width * 0.95;
      const ch = height * 0.89;
      context.strokeStyle = accentAlpha(0.3);
      context.lineWidth = 1;
      context.strokeRect(cx0, cy0, cw, ch);
      context.strokeStyle = accentAlpha(0.16);
      context.beginPath();
      context.moveTo(cx0 + cw - 26, cy0);
      context.lineTo(cx0 + cw, cy0 + 26);
      context.stroke();

      // Question-mark watermarks drifting behind the stock.
      context.font = "600 34px monospace";
      context.fillStyle = accentAlpha(0.07);
      for (let i = 0; i < 6; i += 1) {
        const drift = reducedMotion ? 0 : ((now / (60 + i * 14)) % (ch + 60)) - 30;
        context.fillText("?", cx0 + 18 + ((i * 97) % (cw - 40)), cy0 + drift);
      }

      // Rain: short diagonal streaks over the whole panel.
      context.strokeStyle = accentAlpha(0.1);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 0; i < 40; i += 1) {
        const seedX = (i * 137) % 1000;
        const x = (seedX / 1000) * width;
        const fall = reducedMotion ? (i * 53) % height : ((now / 2.2 + i * 61) % (height + 40)) - 20;
        context.moveTo(x, fall);
        context.lineTo(x - 3, fall + 11);
      }
      context.stroke();

      // The trace: a scan line that crosses faster the closer he gets, plus a
      // pressure bloom from the right edge.
      if (trace > 0.001) {
        const period = 2400 - trace * 1500;
        const sweep = reducedMotion ? 0.5 : ((now % period) / period);
        context.strokeStyle = accentAlpha(0.16 + trace * 0.4);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(sweep * width, 0);
        context.lineTo(sweep * width, height);
        context.stroke();
        context.fillStyle = accentAlpha(trace * 0.16);
        context.fillRect(width * (1 - trace * 0.4), 0, width * trace * 0.4, height);
      }

      // Green-ink bleed: the answer surfacing under the card on a solve.
      if (solvedAtRef.current > 0) {
        const t = reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (now - solvedAtRef.current) / 700));
        context.strokeStyle = palette.bright;
        context.globalAlpha = 0.5 * (1 - t);
        context.lineWidth = 2;
        context.beginPath();
        context.arc(width / 2, height / 2, 10 + t * width * 0.55, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
        context.strokeStyle = accentAlpha(0.35 + 0.4 * (1 - t));
        context.lineWidth = 2;
        context.strokeRect(cx0, cy0, cw, ch);
      }

      // Motes lifting off the stock when a word or card locks.
      if (!reducedMotion) {
        const motes = motesRef.current;
        for (let i = motes.length - 1; i >= 0; i -= 1) {
          const mote = motes[i];
          mote.x += mote.vx;
          mote.y += mote.vy;
          mote.vy += 0.02;
          mote.life -= 0.017;
          if (mote.life <= 0) {
            motes.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(mote.life * 0.75);
          context.fillRect(mote.x, mote.y, mote.size, mote.size);
        }
      }

      // The run ending cold: the panel drops away.
      if (phaseRef.current === "caught") {
        context.fillStyle = palette.inkSoft;
        context.globalAlpha = 0.7;
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
        if (phaseRef.current === "running") {
          const limit = RIDDLE_DECK[cardRef.current].trace / 1000;
          traceRef.current = Math.min(1, traceRef.current + dt / limit);
          paintTrace(traceRef.current);
          if (traceRef.current >= 1) caught();
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [caught, paintTrace, reducedMotion]);

  // Reduced motion runs no loop, so every state change repaints once.
  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, cardIndex, phase, locked, offsets, tracePct]);

  // --- Derived readouts ---------------------------------------------------

  const decodedWords = useMemo(
    () =>
      card.kind === "caesar"
        ? cipherWords.map((cipher, i) => rotate(cipher, -offsets[i]))
        : [],
    [card, cipherWords, offsets]
  );

  const lockedCount = locked.filter(Boolean).length;
  const over = phase === "caught" || phase === "done";

  const status = useMemo(() => {
    if (phase === "done")
      return `The whole deck is cracked. ${score} points, ${solvedCards} cards.`;
    if (phase === "caught")
      return `The trace ran out with ${solvedCards} cards read. ${score} points banked.`;
    if (phase === "paused") return "Held. The card is face down.";
    if (phase === "solved") return card.ink;
    if (card.kind === "caesar")
      return `Card ${cardIndex + 1} of ${RIDDLE_DECK.length} — pick a word, then guess the letter it starts with.`;
    if (card.kind === "keyword")
      return `Card ${cardIndex + 1} of ${RIDDLE_DECK.length} — the alphabet is keyed. Which name unlocks it?`;
    return `Card ${cardIndex + 1} of ${RIDDLE_DECK.length} — read the picture, not the letters.`;
  }, [card, cardIndex, phase, score, solvedCards]);

  return (
    <div
      data-sim-state={phase}
      data-riddle-card={cardIndex + 1}
      data-riddle-solved={solvedCards}
      data-riddle-score={score}
      data-riddle-locked={lockedCount}
      className={`flex flex-col gap-3 ${!reducedMotion && phase === "caught" ? "bat-jolt" : ""}`}
      onPointerDownCapture={markPress}
    >
      <BatmanKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          card <span className="text-accent">{cardIndex + 1}</span>/{RIDDLE_DECK.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "bat-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          clean streak <span className="text-accent">x{streak}</span>
        </span>
        <span className="flex items-center gap-1.5">
          trace{" "}
          <span ref={traceTextRef} className="tabular-nums text-accent">
            0%
          </span>
          <span ref={traceGlyphRef} aria-hidden className="text-accent/70">
            ▯▯▯▯▯
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
        <div ref={traceBarRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
      </div>

      {/* The card itself */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-40 w-full border border-accent/25 bg-ink/60 sm:h-52"
        />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-4 sm:p-6">
          <p className="text-[9px] uppercase tracking-[0.24em] text-white/40">
            From your secret friend
          </p>

          {card.kind === "caesar" && (
            <div
              key={`${card.id}-${cardIndex}`}
              className={`flex flex-wrap items-end gap-x-4 gap-y-2 ${
                reducedMotion ? "" : "bat-card-in"
              }`}
            >
              {cipherWords.map((cipher, i) => {
                const isLocked = locked[i];
                const isSelected = selectedWord === i && !isLocked;
                return (
                  <button
                    key={`${card.id}-w${i}`}
                    type="button"
                    onClick={() => {
                      if (!isLocked) setSelectedWord(i);
                    }}
                    disabled={isLocked || phase !== "running"}
                    aria-label={
                      isLocked
                        ? `Word ${i + 1} solved: ${(card.words as readonly string[])[i]}`
                        : `Select word ${i + 1}, currently reading ${decodedWords[i]}`
                    }
                    className={`flex flex-col items-start gap-0.5 border-b px-1 pb-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-100 ${
                      isLocked
                        ? "border-accent/70"
                        : isSelected
                          ? "border-accent"
                          : "border-white/20 hover:border-accent/50"
                    }`}
                  >
                    <span aria-hidden className="font-mono text-[10px] tracking-[0.3em] text-white/30">
                      {cipher}
                    </span>
                    <span
                      className={`font-mono text-base tracking-[0.3em] sm:text-xl ${
                        isLocked
                          ? `text-accent-bright ${reducedMotion ? "" : "bat-ink"}`
                          : "text-white/85"
                      }`}
                    >
                      {decodedWords[i]}
                      {isLocked && (
                        <span aria-hidden className="ml-2 text-[11px] tracking-normal">
                          ✓
                        </span>
                      )}
                    </span>
                    {revealFirst.includes(i) && !isLocked && (
                      <span className="text-[9px] uppercase tracking-[0.16em] text-accent/80">
                        starts with {(card.words as readonly string[])[i][0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {card.kind === "keyword" && (
            <p
              key={card.id}
              aria-label={`Keyed ciphertext ${keyCipher.split("").join(" ")}`}
              className={`font-mono text-base tracking-[0.34em] text-white/85 sm:text-2xl ${
                reducedMotion ? "" : "bat-card-in"
              }`}
            >
              {keyCipher}
            </p>
          )}

          {card.kind === "rebus" && (
            <p
              key={card.id}
              aria-label={`Rebus: ${card.glyphs}`}
              className={`font-mono text-sm tracking-[0.24em] text-white/85 sm:text-xl ${
                reducedMotion ? "" : "bat-card-in"
              }`}
            >
              {card.glyphs}
            </p>
          )}

          <p className="max-w-prose text-[11px] normal-case leading-relaxed text-white/60">
            {card.prompt}
          </p>
        </div>

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
          <div className="absolute inset-0 grid place-items-center bg-ink/75">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {/* The desk */}
      {phase === "running" && card.kind === "caesar" && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <BatmanChip onClick={() => nudge(-1)} label="Rotate letters back">
            ◂ shift
          </BatmanChip>
          <BatmanChip onClick={() => nudge(1)} label="Rotate letters forward">
            shift ▸
          </BatmanChip>
          <label className="flex items-center gap-1.5 text-white/45">
            first letter
            <select
              aria-label={`First letter of word ${selectedWord + 1}`}
              value=""
              onChange={(event) => {
                if (event.target.value) guessFirstLetter(event.target.value);
              }}
              className="border border-accent/30 bg-ink px-1.5 py-1 text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">–</option>
              {ALPHABET.split("").map((letter) => (
                <option key={letter} value={letter}>
                  {letter}
                </option>
              ))}
            </select>
          </label>
          <span className="text-white/35">
            word {selectedWord + 1} · offset {offsets[selectedWord] ?? 0}
          </span>
        </div>
      )}

      {phase === "running" && card.kind !== "caesar" && (
        <div key={`${card.id}-${shakeTick}`} className="flex flex-col gap-1.5">
          {card.options.map((option, index) => {
            const isStruck = struck.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => pickOption(option)}
                disabled={isStruck}
                aria-label={
                  card.kind === "keyword" ? `Try the key ${option}` : `Answer ${option}`
                }
                className={`bat-press flex items-start gap-2 border px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isStruck
                    ? "border-white/10 text-white/25 line-through"
                    : "border-accent/30 hover:bg-accent/10"
                }`}
              >
                <span aria-hidden className="text-accent/60">
                  {index + 1}
                </span>
                <span>{option}</span>
                {card.kind === "keyword" && !isStruck && (
                  <span aria-hidden className="ml-auto font-mono text-white/35">
                    {keyDecode(keyCipher, option)}
                  </span>
                )}
              </button>
            );
          })}
          <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
            keys 1–4 pick a line{card.kind === "keyword" ? " · the grey column is what that key spells" : ""}
          </p>
        </div>
      )}

      {tell && (
        <p
          key={`tell-${shakeTick}-${cardIndex}`}
          className={`border-l-2 pl-2 text-[11px] normal-case leading-relaxed ${
            tell.bad ? "border-accent-bright/70 text-white/70" : "border-accent/40 text-white/55"
          } ${reducedMotion || !tell.bad ? "" : "bat-shake"}`}
        >
          <span aria-hidden className="mr-1 text-accent">
            {tell.bad ? "✕" : "◆"}
          </span>
          {tell.text}
        </p>
      )}

      {phase === "solved" && (
        <p className={`text-[12px] normal-case leading-relaxed text-accent-bright ${reducedMotion ? "" : "bat-ink"}`}>
          {card.ink}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="normal-case tracking-[0.06em] text-white/60">
          {status}
        </p>
        <span className="flex gap-2">
          {phase === "running" && (
            <BatmanChip
              onClick={spendHint}
              disabled={hints <= 0}
              label="Spend a hint"
            >
              hint ({hints})
            </BatmanChip>
          )}
          {phase === "solved" && (
            <BatmanChip
              innerRef={advanceRef}
              bright
              onClick={() => {
                if (freshPress()) armCard(cardRef.current + 1);
              }}
            >
              Next card
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
              {phase === "done" ? "Deal the deck again" : "Deal a new card"}
            </BatmanChip>
          )}
        </span>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function TheBatmanRiddle({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="the-batman-riddle-title"
      gameId="the-batman-riddle"
      eyebrow="Cipher desk"
      title="Decode the riddle"
      startLabel="Open the card"
      stage
      howToPlay={{
        objective:
          "Crack all five cards before the Riddler's trace fills.",
        controls: [
          { keys: "← →", does: "shift the selected word's dial one letter at a time" },
          { keys: "A–Z", does: "guess the letter a word starts with; the dial jumps to match" },
          { keys: "1–4", does: "pick a line on the keyword and rebus cards" },
          { keys: "click", does: "choose which word of a rotation card you are working on" },
        ],
        tip: "Three hints a run, and each one costs 12% of the trace; a wrong pick costs 10%. Hints and wrong picks both break the clean streak, and the faster a card falls the bigger the speed bonus.",
      }}
      reference={{
        quote: "From your secret friend.",
        scene: "The Batman (2022) · the greeting cards at every scene",
      }}
      onClose={onClose}
    >
      <CipherDesk />
    </SimulationShell>
  );
}
