"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// A bulb on the basement stair flickers a message and dies a little every
// time. Read the dots and dashes, then tap them back symbol by symbol: each
// one is judged the moment it lands, a wrong tap costs filament and a strike,
// and asking for the message again costs more. Six patterns, each longer and
// faster than the last.

const ROUNDS = [
  { pattern: ".-", dot: 265 },
  { pattern: "-..", dot: 245 },
  { pattern: ".-.-", dot: 220 },
  { pattern: "-...-", dot: 200 },
  { pattern: ".--.-.", dot: 180 },
  { pattern: "-..-.--", dot: 162 },
] as const;

const LEAD_MS = 480;
const WRONG_COST = 9;
const REPLAY_COST = 14;
const MAX_STRIKES = 3;
const SCORE_ID = "parasite-morse";

type Phase = "watching" | "tapping" | "paused" | "failed" | "done";
type Segment = { lit: boolean; dur: number };
type Judgement = { index: number; ok: boolean; at: number };

const glyph = (symbol: string) => (symbol === "-" ? "—" : "·");

/** The flicker schedule for one pattern at one speed. */
function timeline(pattern: string, dot: number): { segments: Segment[]; total: number } {
  const dash = Math.round(dot * 2.6);
  const gap = Math.round(dot * 0.9);
  const segments: Segment[] = [{ lit: false, dur: LEAD_MS }];
  pattern.split("").forEach((symbol, index) => {
    segments.push({ lit: true, dur: symbol === "-" ? dash : dot });
    if (index < pattern.length - 1) segments.push({ lit: false, dur: gap });
  });
  return { segments, total: segments.reduce((sum, s) => sum + s.dur, 0) };
}

/** Filament burns faster the deeper into the message you are. */
const drainRate = (round: number) => 2.4 + round * 0.55;

function MorseInTheDark() {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("watching");
  const [input, setInput] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useParasiteAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lifeBarRef = useRef<HTMLDivElement>(null);
  const lifeTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const litRef = useRef(false);
  const lifeRef = useRef(100);
  const roundRef = useRef(0);
  const inputRef = useRef("");
  const strikesRef = useRef(0);
  const scoreRef = useRef(0);
  const clearedRef = useRef(0);
  const phaseRef = useRef<Phase>("watching");
  const lastRef = useRef(0);
  const flickerRef = useRef(-1);
  const drawRef = useRef<(now: number) => void>(() => {});

  const pattern = ROUNDS[round].pattern;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paintLife = useCallback(() => {
    const value = Math.max(0, lifeRef.current);
    if (lifeBarRef.current) lifeBarRef.current.style.width = `${value.toFixed(1)}%`;
    if (lifeTextRef.current) lifeTextRef.current.textContent = `${Math.round(value)}%`;
  }, []);

  const endRun = useCallback(
    (outcome: "failed" | "done") => {
      if (outcome === "done") {
        const bonus = Math.round(lifeRef.current * 6);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        setNote({ id: performance.now(), text: `message read +${bonus}` });
        audio.win();
      } else {
        audio.fail();
      }
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      litRef.current = false;
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const startRound = useCallback(
    (index: number) => {
      roundRef.current = index;
      inputRef.current = "";
      setRound(index);
      setInput("");
      setJudgement(null);
      litRef.current = false;
      // Reduced motion never flickers: the pattern is read as text instead, so
      // the watch phase is a page to read rather than a light to catch.
      phaseRef.current = "watching";
      setPhase("watching");
    },
    []
  );

  const restart = useCallback(() => {
    lifeRef.current = 100;
    strikesRef.current = 0;
    scoreRef.current = 0;
    clearedRef.current = 0;
    paintLife();
    setStrikes(0);
    setScore(0);
    setCleared(0);
    setNote(null);
    startRound(0);
  }, [paintLife, startRound]);

  const spendLife = useCallback(
    (amount: number) => {
      lifeRef.current = Math.max(0, lifeRef.current - amount);
      paintLife();
      if (lifeRef.current <= 0) {
        endRun("failed");
        return true;
      }
      return false;
    },
    [endRun, paintLife]
  );

  const tap = useCallback(
    (symbol: "." | "-") => {
      if (phaseRef.current !== "tapping") return;
      audio.unlock();
      const position = inputRef.current.length;
      const expected = ROUNDS[roundRef.current].pattern[position];
      if (symbol !== expected) {
        strikesRef.current += 1;
        setStrikes(strikesRef.current);
        setJudgement({ index: position, ok: false, at: performance.now() });
        flickerRef.current = performance.now();
        audio.wrong();
        if (spendLife(WRONG_COST)) return;
        if (strikesRef.current >= MAX_STRIKES) endRun("failed");
        return;
      }

      const next = inputRef.current + symbol;
      inputRef.current = next;
      setInput(next);
      setJudgement({ index: position, ok: true, at: performance.now() });
      scoreRef.current += 40 + roundRef.current * 12;
      setScore(scoreRef.current);
      audio.blip(position);
      if (next.length < ROUNDS[roundRef.current].pattern.length) return;

      // Pattern complete.
      clearedRef.current += 1;
      setCleared(clearedRef.current);
      const bonus = 120 + roundRef.current * 60;
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      setNote({ id: performance.now(), text: `pattern ${roundRef.current + 1} +${bonus}` });
      // A clean read gives a little filament back.
      lifeRef.current = Math.min(100, lifeRef.current + 6);
      paintLife();
      if (roundRef.current + 1 >= ROUNDS.length) {
        endRun("done");
        return;
      }
      audio.clear();
      startRound(roundRef.current + 1);
    },
    [audio, endRun, paintLife, spendLife, startRound]
  );

  const replay = useCallback(() => {
    if (phaseRef.current !== "tapping") return;
    audio.unlock();
    if (spendLife(REPLAY_COST)) return;
    setNote({ id: performance.now(), text: `−${REPLAY_COST}% filament` });
    phaseRef.current = "watching";
    setPhase("watching");
  }, [audio, spendLife]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "tapping") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "tapping";
      setPhase("tapping");
    }
  }, []);

  useEffect(() => {
    startRound(0);
    paintLife();
  }, [paintLife, startRound]);

  // Keyboard: the two symbols, straight from the keys they look like.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        tap(".");
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        tap("-");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap]);

  // Playback: the flicker itself, and the handoff into the reply window.
  useEffect(() => {
    if (phase !== "watching") return;
    if (reducedMotion) {
      // No flicker to catch — the message is on the page, and the reply
      // window opens as soon as the visitor is ready.
      litRef.current = false;
      phaseRef.current = "tapping";
      setPhase("tapping");
      return;
    }
    const { segments, total } = timeline(pattern, ROUNDS[round].dot);
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      if (document.hidden) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const elapsed = performance.now() - start;
      if (elapsed >= total) {
        litRef.current = false;
        lastRef.current = performance.now();
        phaseRef.current = "tapping";
        setPhase("tapping");
        return;
      }
      let acc = 0;
      let current = false;
      for (const segment of segments) {
        acc += segment.dur;
        if (elapsed < acc) {
          current = segment.lit;
          break;
        }
      }
      if (current !== litRef.current) {
        litRef.current = current;
        if (current) audio.tone({ freq: 660, duration: 0.05, gain: 0.35, type: "sine" });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [audio, pattern, phase, reducedMotion, round]);

  // The stairwell: the bulb, its cone of light, dust, and the filament drain.
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

      const bulbX = width * 0.5;
      const bulbY = height * 0.3;
      const life = lifeRef.current / 100;
      const lit = litRef.current;
      const jitter =
        !reducedMotion && flickerRef.current > 0 && now - flickerRef.current < 320
          ? (Math.random() - 0.5) * 5
          : 0;

      // The stairs falling away below the bulb.
      context.strokeStyle = accentAlpha(0.14 + (lit ? 0.2 : 0));
      context.lineWidth = 1;
      for (let i = 0; i < 7; i += 1) {
        const t = i / 7;
        const y = height * (0.62 + t * 0.34);
        const inset = width * (0.16 - t * 0.1);
        context.beginPath();
        context.moveTo(inset, y);
        context.lineTo(width - inset, y);
        context.stroke();
      }

      // The cone of light, which is really the whole message.
      if (lit || life > 0) {
        const strength = lit ? 1 : 0.1 + life * 0.12;
        const cone = context.createLinearGradient(0, bulbY, 0, height);
        cone.addColorStop(0, accentAlpha(0.28 * strength));
        cone.addColorStop(1, accentAlpha(0));
        context.fillStyle = cone;
        context.beginPath();
        context.moveTo(bulbX + jitter, bulbY);
        context.lineTo(width * 0.06, height);
        context.lineTo(width * 0.94, height);
        context.closePath();
        context.fill();
      }

      // Flex and bulb.
      context.strokeStyle = accentAlpha(0.35);
      context.beginPath();
      context.moveTo(width * 0.5, 0);
      context.lineTo(bulbX + jitter, bulbY - 12);
      context.stroke();

      const radius = 13;
      if (lit) {
        const glow = context.createRadialGradient(
          bulbX + jitter,
          bulbY,
          2,
          bulbX + jitter,
          bulbY,
          radius * 5
        );
        glow.addColorStop(0, accentAlpha(0.55));
        glow.addColorStop(1, accentAlpha(0));
        context.fillStyle = glow;
        context.beginPath();
        context.arc(bulbX + jitter, bulbY, radius * 5, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = accentAlpha(lit ? 0.95 : 0.3);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(bulbX + jitter, bulbY, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = lit ? palette.bright : accentAlpha(0.08 + life * 0.1);
      context.beginPath();
      context.arc(bulbX + jitter, bulbY, radius - 2, 0, Math.PI * 2);
      context.fill();
      // The filament: shorter and dimmer as the bulb burns down.
      context.strokeStyle = lit ? palette.inkSoft : accentAlpha(0.25 + life * 0.5);
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 0; i <= 6; i += 1) {
        const fx = bulbX + jitter - 5 + i * (10 / 6) * Math.max(0.3, life);
        const fy = bulbY + (i % 2 === 0 ? -3 : 3) * Math.max(0.3, life);
        if (i === 0) context.moveTo(fx, fy);
        else context.lineTo(fx, fy);
      }
      context.stroke();

      // Dust in the beam, only while the bulb is on.
      if (!reducedMotion && lit) {
        for (let i = 0; i < 14; i += 1) {
          const dx = bulbX + Math.sin(now / 900 + i * 2.1) * width * 0.22;
          const dy = bulbY + 30 + ((now / 26 + i * 47) % (height * 0.6));
          context.fillStyle = accentAlpha(0.22);
          context.fillRect(dx, dy, 1.4, 1.4);
        }
      }

      // Filament failing: the frame darkens as the bulb gives out.
      if (life < 0.6) {
        context.fillStyle = accentAlpha(0.02 + (0.6 - life) * 0.2);
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
        if (phaseRef.current === "tapping") {
          lifeRef.current = Math.max(0, lifeRef.current - dt * drainRate(roundRef.current));
          paintLife();
          if (lifeRef.current <= 0) endRun("failed");
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [endRun, paintLife, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, phase, input, strikes]);

  const status = useMemo(() => {
    if (phase === "failed")
      return `The bulb gave out on pattern ${round + 1}. ${cleared} read, ${score} points.`;
    if (phase === "done") return `Message read in full. ${cleared} patterns, ${score} points.`;
    if (phase === "paused") return "Held. The filament is resting.";
    if (phase === "watching")
      return reducedMotion
        ? `Pattern ${round + 1} of ${ROUNDS.length} — the message is written out below.`
        : `Pattern ${round + 1} of ${ROUNDS.length} — watch the bulb.`;
    return round === 0 && input.length === 0
      ? "Tap it back, one symbol at a time. Each tap is judged as it lands."
      : `Tap it back — symbol ${input.length + 1} of ${pattern.length}.`;
  }, [cleared, input.length, pattern.length, phase, reducedMotion, round, score]);

  const over = phase === "failed" || phase === "done";
  const showPattern = reducedMotion && (phase === "tapping" || phase === "watching");

  return (
    <div
      data-sim-state={phase}
      data-round={round + 1}
      data-morse-input={input.length}
      data-morse-score={score}
      data-strikes={strikes}
      className="flex flex-col gap-3"
    >
      <ParasiteKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          pattern <span className="text-accent">{round + 1}</span>/{ROUNDS.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "para-pop text-accent"}>
            {score}
          </span>
        </span>
        <span aria-label={`${strikes} of ${MAX_STRIKES} strikes`}>
          strikes{" "}
          <span aria-hidden className="text-accent">
            {"✕".repeat(strikes)}
            <span className="text-white/25">{"·".repeat(MAX_STRIKES - strikes)}</span>
          </span>
        </span>
        <span>
          filament <span ref={lifeTextRef} className="text-accent">100%</span>
        </span>
        <span className="ml-auto flex gap-2">
          <ParasiteMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "tapping" || phase === "paused") && (
            <ParasiteChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </ParasiteChip>
          )}
        </span>
      </div>

      {/* Filament meter */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={lifeBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      {/* The stairwell */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-64"
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
                {phase === "paused" ? "paused" : phase === "failed" ? "the bulb died" : "message read"}
              </p>
              {over && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {cleared} patterns · {score} points
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reduced motion reads the message as text instead of light. */}
      {showPattern && (
        <p aria-hidden className="text-center text-lg tracking-[0.5em] text-accent">
          {pattern.split("").map(glyph).join("")}
        </p>
      )}

      {/* The reply rail: one slot per symbol, judged as it lands. */}
      <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
        {pattern.split("").map((symbol, index) => {
          const solved = index < input.length;
          const current = index === input.length && phase === "tapping";
          const flagged = judgement && judgement.index === index && !judgement.ok;
          return (
            <span
              key={`${index}-${judgement?.at ?? 0}`}
              className={`grid h-8 w-8 place-items-center border text-sm ${
                solved
                  ? "border-accent bg-accent/15 text-accent-bright"
                  : flagged
                    ? "border-accent-bright text-accent-bright"
                    : current
                      ? "border-accent/70 text-accent"
                      : "border-white/15 text-white/25"
              } ${!reducedMotion && flagged ? "para-shake" : ""} ${
                !reducedMotion && solved && index === input.length - 1 ? "para-pop" : ""
              }`}
            >
              {solved ? glyph(symbol) : flagged ? "✕" : current ? "▮" : "▯"}
            </span>
          );
        })}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/65">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {!over ? (
          <>
            <button
              type="button"
              onClick={() => tap(".")}
              disabled={phase !== "tapping"}
              aria-label="Tap a dot"
              className="para-press border border-accent/30 px-5 py-2 text-[13px] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              · dot
            </button>
            <button
              type="button"
              onClick={() => tap("-")}
              disabled={phase !== "tapping"}
              aria-label="Tap a dash"
              className="para-press border border-accent/30 px-5 py-2 text-[13px] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              — dash
            </button>
            {!reducedMotion && (
              <ParasiteChip
                onClick={replay}
                disabled={phase !== "tapping"}
                label={`Flash the message again, costs ${REPLAY_COST} percent filament`}
              >
                flash again −{REPLAY_COST}%
              </ParasiteChip>
            )}
            <span className="text-white/35">keys . and − work too</span>
          </>
        ) : (
          <ParasiteChip innerRef={actionRef} onClick={restart} bright>
            {phase === "done" ? "Read it again" : "Watch again"}
          </ParasiteChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function ParasiteMorse({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="parasite-morse-title"
      gameId="parasite-morse"
      eyebrow="Signal decode"
      title="Morse in the dark"
      startLabel="Watch the bulb"
      stage
      howToPlay={{
        objective:
          "Read what the bulb flickers, then tap the same pattern back — six patterns before the filament burns out.",
        controls: [
          { keys: ".", does: "tap a dot — the comma key works too" },
          { keys: "−", does: "tap a dash — underscore works too" },
          { keys: "click", does: "the dot and dash buttons do the same" },
          { keys: "flash again", does: "replay the message, at a cost in filament" },
        ],
        tip: "Every tap is judged the moment it lands: a wrong symbol costs filament and a strike, three strikes end the run, and a clean pattern gives a little filament back.",
      }}
      reference={{
        quote: "Respect!",
        scene: "Parasite (2019) · the flickering stair light",
      }}
      onClose={onClose}
    >
      <MorseInTheDark />
    </SimulationShell>
  );
}
