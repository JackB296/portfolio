"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import MatrixDecodeGraph, {
  type DecodeSample,
} from "@/components/film-experience/simulations/MatrixDecodeGraph";
import {
  DECODE_VOICE_IDS,
  FREEPLAY_PHRASES,
  TRIAL_PHRASES,
  randomGlyph,
  roundBudget,
  scramble,
  shuffled,
  type DecodePhrase,
} from "@/components/film-experience/simulations/MatrixDecodeData";
import { createMatrixSimAudio, type MatrixSimAudio } from "@/components/film-experience/simulations/MatrixSimAudio";
import { recordSimulationScore } from "@/lib/simulationScores";
import { preloadVoice, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import { accentAlpha, getLiveThemePalette, withAlpha } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

const ERROR_PENALTY_MS = 450;
const PURGE_PUSHBACK_MS = 2_500;
const PURGE_CHARGE_CHARS = 20;
const MAX_PURGES = 2;
const WARN_FRACTION = 0.72;
const SCORE_ID = "matrix-decode";

const COLUMN_WIDTH = 14;
const MAX_PARTICLES = 140;
const MAX_MELT = 220;
const MAX_SAMPLES = 600;
const SAMPLE_MS = 1_000;

type Phase = "running" | "paused" | "failed" | "done";
type Mode = "trial" | "freeplay";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; glyph: string };

/** A character that has fallen out of a completed word. */
type MeltGlyph = {
  x: number;
  y: number;
  vy: number;
  life: number;
  fade: number;
  glyph: string;
  /** Length of the green smear it drags behind it, in pixels. */
  smear: number;
};

type FloatNote = { id: number; text: string };

const multiplierFor = (combo: number) =>
  combo >= 30 ? 4 : combo >= 18 ? 3 : combo >= 8 ? 2 : 1;

/** "rgb(r, g, b)" → "rgba(r, g, b, a)" for canvas fades. */
/** Characters of `value` that are settled behind a completed word boundary. */
const completedWordChars = (value: string) => {
  const lastSpace = value.lastIndexOf(" ");
  return lastSpace < 0 ? 0 : lastSpace + 1;
};

/**
 * The trial itself. Mounted by the shell only after the visitor starts from
 * the reference card, so mounting IS the start signal.
 *
 * Two modes share one loop:
 *  - trial: five fixed phrases, each against a tightening trace clock.
 *  - freeplay: untimed and endless, phrase after phrase, for the graph.
 *
 * In both, the phrase lives on the canvas so a completed word can physically
 * melt out of it — the glyphs drop, smear, and fade into the rain.
 */
function DecodeTrial() {
  const [mode, setMode] = useState<Mode>("trial");
  const [round, setRound] = useState(0);
  const [phrase, setPhrase] = useState<DecodePhrase>(TRIAL_PHRASES[0]);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("running");
  const [wpm, setWpm] = useState(0);
  const [raw, setRaw] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [samples, setSamples] = useState<DecodeSample[]>([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [purges, setPurges] = useState(0);
  const [warning, setWarning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceOff, setVoiceOff] = useState(false);
  const [errorTick, setErrorTick] = useState(0);
  const [floatNote, setFloatNote] = useState<FloatNote | null>(null);
  const [scrambled, setScrambled] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  // The trace deadline lives in refs so the rAF loop never re-renders React;
  // hidden-tab time shifts the deadline instead of counting against the run.
  const deadlineRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef(0);
  // Run-wide typing ledger. `runStart` arms on the first keystroke, so staring
  // at the phrase before you commit does not tank the speed.
  const runStartRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseStartRef = useRef(0);
  const correctCharsRef = useRef(0);
  const errorCharsRef = useRef(0);
  // Score/combo mirrors so keystroke handlers never read stale state.
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const purgesRef = useRef(0);
  const purgeChargeRef = useRef(0);
  // Freeplay draws phrases from a shuffled cycle, refilled when it runs out.
  const queueRef = useRef<DecodePhrase[]>([]);
  // Canvas-side effects written by handlers, read by the render loop.
  const particlesRef = useRef<Particle[]>([]);
  const meltRef = useRef<MeltGlyph[]>([]);
  const meltedCountRef = useRef(0);
  const glitchUntilRef = useRef(0);
  const audioRef = useRef<MatrixSimAudio | null>(null);
  // Mirror of everything the canvas needs, so the loop is built once.
  const viewRef = useRef({ target: "", typed: "", phase: "running" as Phase, reduced: false });
  // Per-character screen positions, written by the loop, read when a word melts.
  const layoutRef = useRef({ startX: 0, y: 0, charW: 0, fontSize: 12 });

  const target = phrase.text;
  const phrases = mode === "trial" ? TRIAL_PHRASES : FREEPLAY_PHRASES;

  viewRef.current = { target, typed, phase, reduced: reducedMotion };

  const audio = () => (audioRef.current ??= createMatrixSimAudio());

  useEffect(() => {
    preloadVoice(DECODE_VOICE_IDS.slice(0, TRIAL_PHRASES.length));
    return () => {
      audioRef.current?.dispose();
      stopVoice();
    };
  }, []);

  const elapsedMs = useCallback(() => {
    if (!runStartRef.current) return 0;
    const frozen = pauseStartRef.current ? performance.now() - pauseStartRef.current : 0;
    return Math.max(0, performance.now() - runStartRef.current - pausedTotalRef.current - frozen);
  }, []);

  /** Recompute the three readouts from the ledger. Cheap; safe every keystroke. */
  const refreshMetrics = useCallback(() => {
    const ms = elapsedMs();
    const minutes = ms / 60_000;
    const correct = correctCharsRef.current;
    const errors = errorCharsRef.current;
    const nextWpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
    const nextRaw = minutes > 0 ? Math.round((correct + errors) / 5 / minutes) : 0;
    setWpm(nextWpm);
    setRaw(nextRaw);
    setAccuracy(correct + errors > 0 ? Math.round((correct / (correct + errors)) * 100) : 100);
    return { t: ms / 1_000, wpm: nextWpm, raw: nextRaw };
  }, [elapsedMs]);

  // One sample a second while the run is live: the graph's whole data source.
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      if (!runStartRef.current || document.hidden) return;
      const sample = refreshMetrics();
      setSamples((current) =>
        current.length >= MAX_SAMPLES ? current : [...current, sample]
      );
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [phase, refreshMetrics]);

  const spawnBurst = useCallback(
    (count: number) => {
      if (reducedMotion) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.6 + Math.random() * 2.4;
        particles.push({
          x: cx + (Math.random() - 0.5) * canvas.width * 0.5,
          y: cy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.6,
          life: 1,
          glyph: randomGlyph(),
        });
      }
    },
    [reducedMotion]
  );

  /**
   * Drop the glyphs of `text` between two indices out of the phrase line.
   * Each one falls under gravity trailing a short green smear — the film's
   * code, finally falling. Reduced motion keeps them in place and fades them.
   */
  const meltRange = useCallback(
    (text: string, from: number, to: number, force = 1) => {
      const { startX, y, charW } = layoutRef.current;
      if (!charW) return;
      const melts = meltRef.current;
      for (let index = from; index < to; index += 1) {
        const ch = text[index];
        if (!ch || ch === " ") continue;
        if (melts.length >= MAX_MELT) break;
        melts.push({
          x: startX + index * charW,
          y,
          vy: reducedMotion ? 0 : 0.2 + Math.random() * 0.6 * force,
          life: 1,
          fade: reducedMotion ? 0.045 : 0.009 + Math.random() * 0.006,
          glyph: ch,
          smear: reducedMotion ? 0 : 10 + Math.random() * 18 * force,
        });
      }
    },
    [reducedMotion]
  );

  const startRound = useCallback(
    (index: number, nextMode: Mode) => {
      let next: DecodePhrase;
      if (nextMode === "trial") {
        next = TRIAL_PHRASES[index];
      } else {
        if (queueRef.current.length === 0) queueRef.current = shuffled(FREEPLAY_PHRASES);
        next = queueRef.current.pop() as DecodePhrase;
      }
      setRound(index);
      setPhrase(next);
      setTyped("");
      setPhase("running");
      setWarning(false);
      setScrambled(null);
      meltedCountRef.current = 0;
      if (nextMode === "trial") {
        deadlineRef.current = performance.now() + roundBudget(index);
        // The line is spoken as the round opens. Missing audio resolves
        // silently, so this is a no-op until the MP3s land.
        void speak(next.voiceId, "matrix");
      }
      window.requestAnimationFrame(() => inputRef.current?.focus());
    },
    []
  );

  const resetRun = useCallback(
    (nextMode: Mode) => {
      correctCharsRef.current = 0;
      errorCharsRef.current = 0;
      scoreRef.current = 0;
      comboRef.current = 0;
      purgesRef.current = 0;
      purgeChargeRef.current = 0;
      runStartRef.current = 0;
      pausedTotalRef.current = 0;
      pauseStartRef.current = 0;
      meltRef.current = [];
      queueRef.current = nextMode === "freeplay" ? shuffled(FREEPLAY_PHRASES) : [];
      setWpm(0);
      setRaw(0);
      setAccuracy(100);
      setSamples([]);
      setScore(0);
      setCombo(0);
      setPurges(0);
      setFloatNote(null);
      startRound(0, nextMode);
    },
    [startRound]
  );

  const restart = useCallback(() => resetRun(mode), [resetRun, mode]);

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      stopVoice();
      setMode(next);
      resetRun(next);
    },
    [mode, resetRun]
  );

  useEffect(() => {
    resetRun("trial");
    // Mount is the start signal; later runs go through restart/switchMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trace bar + timeout + warning pulse. Trial only: freeplay has no clock.
  useEffect(() => {
    if (phase !== "running" || mode !== "trial") return;
    let frame = 0;
    let warned = false;
    const budget = roundBudget(round);
    const tick = () => {
      const remaining = deadlineRef.current - performance.now();
      const fraction = Math.min(1, Math.max(0, 1 - remaining / budget));
      if (traceRef.current) {
        traceRef.current.style.width = `${(fraction * 100).toFixed(2)}%`;
      }
      if (fraction >= WARN_FRACTION !== warned) {
        warned = !warned;
        setWarning(warned);
      }
      if (remaining <= 0 && hiddenAtRef.current === null) {
        setPhase("failed");
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, round, mode]);

  // Failure staging: scramble the phrase, glitch the canvas, bank nothing.
  useEffect(() => {
    if (phase !== "failed") return;
    glitchUntilRef.current = performance.now() + 700;
    audioRef.current?.fail();
    stopVoice();
    const scrambleTimer = window.setInterval(() => setScrambled(scramble(target)), 90);
    const stop = window.setTimeout(() => window.clearInterval(scrambleTimer), 900);
    window.requestAnimationFrame(() => restartRef.current?.focus());
    return () => {
      window.clearInterval(scrambleTimer);
      window.clearTimeout(stop);
    };
  }, [phase, target]);

  useEffect(() => {
    if (phase !== "done") return;
    window.requestAnimationFrame(() => restartRef.current?.focus());
  }, [phase]);

  // A hidden tab pauses the trial: the deadline shifts by however long the
  // visitor was away, so returning mid-round is not an instant loss.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
      } else if (hiddenAtRef.current !== null) {
        const away = performance.now() - hiddenAtRef.current;
        deadlineRef.current += away;
        pausedTotalRef.current += away;
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Glyph rain + the phrase itself + melting words + bursts + failure glitch:
  // one canvas loop, built once, reading live state from refs. Reduced motion
  // keeps the loop (the phrase has to redraw as you type) but freezes the rain
  // and turns the melt into an in-place fade.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];
    let frozenRain: Array<{ x: number; y: number; glyph: string }> = [];
    // The grade is sampled once per loop build, not per frame.
    const palette = getLiveThemePalette();
    const fade = withAlpha(palette.inkSoft, 0.16);

    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      columns = Math.max(1, Math.floor(width / COLUMN_WIDTH));
      drops = Array.from({ length: columns }, () => Math.random() * height);
      frozenRain = [];
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < Math.ceil(height / 26); row += 1) {
          frozenRain.push({
            x: column * COLUMN_WIDTH,
            y: 12 + row * 26 + ((column % 3) * 8),
            glyph: randomGlyph(),
          });
        }
      }
    };
    size();

    const paintRain = () => {
      context.fillStyle = accentAlpha(0.9);
      context.font = "12px monospace";
      for (let column = 0; column < columns; column += 1) {
        context.fillText(randomGlyph(), column * COLUMN_WIDTH, drops[column]);
        drops[column] = drops[column] > height ? 0 : drops[column] + COLUMN_WIDTH;
      }
    };

    const paintFrozenRain = () => {
      context.fillStyle = accentAlpha(0.28);
      context.font = "12px monospace";
      for (const cell of frozenRain) context.fillText(cell.glyph, cell.x, cell.y);
    };

    const paintPhrase = () => {
      const view = viewRef.current;
      const text = view.target;
      if (!text) return;
      // Monospace: one measured advance sizes the whole line.
      const fontSize = Math.max(
        11,
        Math.min(26, Math.floor((width * 0.88) / (text.length * 0.62)))
      );
      context.font = `${fontSize}px monospace`;
      const charW = context.measureText("M").width;
      const startX = Math.max(4, (width - charW * text.length) / 2);
      const y = height / 2 + fontSize / 3;
      layoutRef.current = { startX, y, charW, fontSize };

      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      // A slab behind the line keeps it readable over the rain.
      context.fillStyle = withAlpha(palette.inkSoft, 0.78);
      context.fillRect(startX - 6, y - fontSize, charW * text.length + 12, fontSize * 1.5);

      const melted = meltedCountRef.current;
      for (let index = 0; index < text.length; index += 1) {
        if (index < melted) continue; // already dripped away
        const ch = text[index];
        if (ch === " ") continue;
        const isTyped = index < view.typed.length;
        context.fillStyle = isTyped ? palette.bright : accentAlpha(0.4);
        context.fillText(ch, startX + index * charW, y);
      }
      if (view.phase === "running") {
        // Caret at the write head.
        context.fillStyle = withAlpha(palette.bright, 0.55 + 0.45 * Math.sin(performance.now() / 220));
        context.fillRect(startX + view.typed.length * charW, y - fontSize * 0.8, 2, fontSize * 0.9);
      }
    };

    const paintMelt = () => {
      const melts = meltRef.current;
      const reduced = viewRef.current.reduced;
      const { fontSize } = layoutRef.current;
      context.font = `${fontSize}px monospace`;
      for (let i = melts.length - 1; i >= 0; i -= 1) {
        const glyph = melts[i];
        if (!reduced) {
          glyph.vy += 0.22;
          glyph.y += glyph.vy;
          // The odd character rewrites itself on the way down.
          if (Math.random() < 0.06) glyph.glyph = randomGlyph();
        }
        glyph.life -= glyph.fade;
        if (glyph.life <= 0 || glyph.y > height + 20) {
          melts.splice(i, 1);
          continue;
        }
        if (glyph.smear > 0) {
          const gradient = context.createLinearGradient(0, glyph.y - glyph.smear, 0, glyph.y);
          gradient.addColorStop(0, accentAlpha(0));
          gradient.addColorStop(1, accentAlpha(glyph.life * 0.35));
          context.fillStyle = gradient;
          context.fillRect(glyph.x, glyph.y - glyph.smear, Math.max(2, fontSize * 0.55), glyph.smear);
        }
        context.fillStyle = withAlpha(palette.bright, glyph.life);
        context.fillText(glyph.glyph, glyph.x, glyph.y);
      }
    };

    const paintParticles = () => {
      const particles = particlesRef.current;
      context.font = "11px monospace";
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.03;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        context.fillStyle =
          p.life > 0.5 ? withAlpha(palette.bright, p.life) : accentAlpha(p.life);
        context.fillText(p.glyph, p.x, p.y);
      }
    };

    const paintGlitch = () => {
      // Horizontal slice displacement: the room tearing when the trace lands.
      for (let i = 0; i < 7; i += 1) {
        const sliceY = Math.random() * height;
        const sliceH = 3 + Math.random() * 9;
        const shift = (Math.random() - 0.5) * 46;
        context.drawImage(canvas, 0, sliceY, width, sliceH, shift, sliceY, width, sliceH);
      }
      context.fillStyle = accentAlpha(0.06);
      context.fillRect(0, 0, width, height);
    };

    let frame = 0;
    const step = () => {
      if (!document.hidden) {
        const reduced = viewRef.current.reduced;
        if (reduced) {
          context.fillStyle = palette.inkSoft;
          context.fillRect(0, 0, width, height);
          paintFrozenRain();
        } else {
          context.fillStyle = fade;
          context.fillRect(0, 0, width, height);
          paintRain();
        }
        paintPhrase();
        paintMelt();
        if (!reduced) {
          paintParticles();
          if (performance.now() < glitchUntilRef.current) paintGlitch();
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);

  const bankAndFinish = useCallback(
    (finalScore: number) => {
      setPhase("done");
      stopVoice();
      audioRef.current?.win();
      refreshMetrics();
      recordSimulationScore(SCORE_ID, finalScore);
    },
    [refreshMetrics]
  );

  const onType = (value: string) => {
    if (phase !== "running") return;
    if (!runStartRef.current) runStartRef.current = performance.now();

    // Only prefixes of the target land; a wrong keystroke breaks the combo
    // and (in trial) jolts the trace forward instead.
    if (!target.startsWith(value)) {
      comboRef.current = 0;
      setCombo(0);
      errorCharsRef.current += 1;
      if (mode === "trial") deadlineRef.current -= ERROR_PENALTY_MS;
      setErrorTick((t) => t + 1);
      audioRef.current?.error();
      refreshMetrics();
      return;
    }
    const gained = value.length - typed.length;
    setTyped(value);
    if (gained <= 0) {
      // Backspace: allowed and uneventful, but a word walked back comes home.
      if (value.length < meltedCountRef.current) meltedCountRef.current = value.length;
      return;
    }

    comboRef.current += gained;
    setCombo(comboRef.current);
    const mult = multiplierFor(comboRef.current);
    scoreRef.current += gained * 10 * mult;
    setScore(scoreRef.current);
    correctCharsRef.current += gained;
    purgeChargeRef.current += gained;
    if (purgeChargeRef.current >= PURGE_CHARGE_CHARS && purgesRef.current < MAX_PURGES) {
      purgeChargeRef.current -= PURGE_CHARGE_CHARS;
      purgesRef.current += 1;
      setPurges(purgesRef.current);
    }
    spawnBurst(Math.min(gained * 3, 9));
    audio().blip(comboRef.current);
    refreshMetrics();

    // A finished word drips out of the line.
    const settled = completedWordChars(value);
    if (settled > meltedCountRef.current) {
      meltRange(target, meltedCountRef.current, settled);
      meltedCountRef.current = settled;
    }

    if (value !== target) return;

    // Phrase cleared: the whole remaining line cascades, then bank and advance.
    const now = performance.now();
    meltRange(target, meltedCountRef.current, target.length, 2.2);
    meltedCountRef.current = target.length;
    const remaining = mode === "trial" ? Math.max(0, deadlineRef.current - now) : 0;
    const bonus =
      mode === "trial"
        ? 150 + round * 50 + Math.floor(remaining / 100)
        : 120 + Math.min(160, target.length * 6);
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setFloatNote({
      id: now,
      text: mode === "trial" ? `round ${round + 1} cleared +${bonus}` : `decoded +${bonus}`,
    });
    spawnBurst(28);

    if (mode === "freeplay" || round + 1 < TRIAL_PHRASES.length) {
      audioRef.current?.clear();
      startRound(round + 1, mode);
      return;
    }
    bankAndFinish(scoreRef.current);
  };

  const activatePurge = () => {
    if (phase !== "running" || mode !== "trial" || purgesRef.current <= 0) return;
    purgesRef.current -= 1;
    setPurges(purgesRef.current);
    deadlineRef.current += PURGE_PUSHBACK_MS;
    setFloatNote({ id: performance.now(), text: "trace purged" });
    audio().whoosh();
  };

  const togglePause = () => {
    if (phase === "running") {
      pausedRemainingRef.current = deadlineRef.current - performance.now();
      pauseStartRef.current = performance.now();
      setPhase("paused");
      stopVoice();
    } else if (phase === "paused") {
      if (pauseStartRef.current) {
        pausedTotalRef.current += performance.now() - pauseStartRef.current;
        pauseStartRef.current = 0;
      }
      deadlineRef.current = performance.now() + pausedRemainingRef.current;
      setPhase("running");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const endFreeplay = () => {
    if (mode !== "freeplay" || (phase !== "running" && phase !== "paused")) return;
    if (pauseStartRef.current) {
      pausedTotalRef.current += performance.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
    }
    bankAndFinish(scoreRef.current);
  };

  const status = useMemo(() => {
    if (phase === "failed")
      return `Trace complete. Connection lost on round ${round + 1} with ${score} points at ${wpm} wpm.`;
    if (phase === "done")
      return `Run banked: ${score} points, ${wpm} wpm net, ${raw} raw, ${accuracy}% accurate.`;
    if (phase === "paused") return "Line held. The clock and the graph are frozen.";
    if (mode === "freeplay")
      return `Freeplay — phrase ${round + 1}, no trace. The graph is recording.`;
    if (round === 0 && typed.length === 0)
      return "Type the phrase before the trace bar fills. Wrong keys speed the trace.";
    return `Phrase ${round + 1} of ${TRIAL_PHRASES.length} — type it before the trace lands.`;
  }, [phase, round, score, typed.length, wpm, raw, accuracy, mode]);

  const mult = multiplierFor(combo);
  const finished = phase === "done" || phase === "failed";
  const controlClass =
    "border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div
      data-sim-state={phase}
      data-decode-mode={mode}
      data-decode-round={round + 1}
      data-decode-combo={combo}
      data-decode-score={score}
      data-decode-wpm={wpm}
      data-decode-raw={raw}
      data-decode-accuracy={accuracy}
      data-decode-samples={samples.length}
      data-decode-purges={purges}
      className="flex flex-col gap-3"
    >
      <style>{`
        @keyframes matrix-decode-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes matrix-decode-pop { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
        @keyframes matrix-decode-float { 0% { opacity: 0; transform: translateY(8px); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
        @keyframes matrix-decode-warn { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>

      {/* Mode + sound row */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
        <span className="text-white/40">mode</span>
        <div className="flex gap-1">
          {(["trial", "freeplay"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchMode(option)}
              aria-pressed={mode === option}
              aria-label={option === "trial" ? "Trial mode" : "Freeplay mode"}
              className={`${controlClass} ${
                mode === option ? "bg-accent/15 text-accent-bright" : "text-white/55"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !voiceOff;
              setVoiceOff(next);
              setVoiceMuted(next);
            }}
            aria-pressed={voiceOff}
            aria-label={voiceOff ? "Unmute spoken lines" : "Mute spoken lines"}
            className={controlClass}
          >
            {voiceOff ? "voice off" : "voice on"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              audio().setMuted(next);
              audio().unlock();
            }}
            aria-pressed={muted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className={controlClass}
          >
            {muted ? "unmute" : "mute"}
          </button>
          {(phase === "running" || phase === "paused") && (
            <button type="button" onClick={togglePause} className={controlClass}>
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          {mode === "trial" ? (
            <>
              round <span className="text-accent">{round + 1}</span>/{TRIAL_PHRASES.length}
            </>
          ) : (
            <>
              phrase <span className="text-accent">{round + 1}</span>/{phrases.length} pool
            </>
          )}
        </span>
        <span>
          score{" "}
          <span
            key={score}
            className="inline-block text-accent"
            style={reducedMotion ? undefined : { animation: "matrix-decode-pop 240ms ease-out" }}
          >
            {score}
          </span>
        </span>
        <span>
          combo{" "}
          <span className={mult > 1 ? "text-accent-bright" : "text-accent"}>x{mult}</span> ({combo})
        </span>
        {mode === "trial" && (
          <span aria-label={`${purges} purges ready`}>
            purge{" "}
            <span className="text-accent">
              {"▮".repeat(purges)}
              <span className="text-white/25">{"▯".repeat(MAX_PURGES - purges)}</span>
            </span>
          </span>
        )}
      </div>

      {/* Play field — the phrase lives on the canvas so its words can melt. */}
      <div className="relative h-44 overflow-hidden border border-accent/25 sm:h-60">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none" }}
        />
        <p className="sr-only">
          {phase === "failed" && scrambled ? scrambled : `Phrase to type: ${target}`}
        </p>
        {phase === "failed" && (
          <p
            aria-hidden
            key={`failed-${errorTick}`}
            className="absolute inset-x-0 bottom-3 z-10 text-center text-[11px] tracking-[0.14em] text-accent/70"
          >
            {scrambled ?? scramble(target)}
          </p>
        )}
        {errorTick > 0 && phase === "running" && !reducedMotion && (
          <div
            key={errorTick}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 border-2 border-accent-bright/40"
            style={{ animation: "matrix-decode-shake 220ms ease-out" }}
          />
        )}
        {floatNote && (
          <p
            key={floatNote.id}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-4 z-20 text-center text-[10px] uppercase tracking-[0.2em] text-accent-bright"
            style={{
              animation: reducedMotion ? undefined : "matrix-decode-float 1400ms ease-out forwards",
            }}
          >
            {floatNote.text}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {/* Trace clock — trial only; freeplay says so rather than showing a dead bar. */}
      {mode === "trial" ? (
        <div className="h-1.5 w-full bg-white/10" aria-hidden>
          <div
            ref={traceRef}
            className={warning ? "h-full bg-accent-bright" : "h-full bg-accent/80"}
            style={{
              width: "0%",
              animation:
                warning && !reducedMotion ? "matrix-decode-warn 600ms linear infinite" : undefined,
            }}
          />
        </div>
      ) : (
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">no trace · freeplay</p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={typed}
        onChange={(event) => onType(event.target.value)}
        onKeyDown={(event) => {
          audio().unlock();
          if (event.key === "Enter") {
            event.preventDefault();
            activatePurge();
          }
        }}
        disabled={phase !== "running"}
        aria-label="Type the pass phrase"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full border border-accent/30 bg-transparent px-2 py-1.5 text-sm text-accent placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        placeholder="type here"
      />

      {/* The live speed chart — present while running and after the run ends. */}
      <MatrixDecodeGraph
        samples={samples}
        wpm={wpm}
        raw={raw}
        accuracy={accuracy}
        finished={finished}
      />

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/55 normal-case tracking-[0.08em]">
          {status}
        </p>
        <span className="flex shrink-0 gap-2">
          {phase === "running" && mode === "trial" && purges > 0 && (
            <button
              type="button"
              onClick={activatePurge}
              className={`${controlClass} text-accent-bright`}
            >
              Purge trace (enter)
            </button>
          )}
          {mode === "freeplay" && (phase === "running" || phase === "paused") && (
            <button type="button" onClick={endFreeplay} className={controlClass}>
              End run
            </button>
          )}
          {finished && (
            <button ref={restartRef} type="button" onClick={restart} className={controlClass}>
              Run it back
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

type MatrixDecodeRainProps = {
  onClose: () => void;
};

export default function MatrixDecodeRain({ onClose }: MatrixDecodeRainProps) {
  return (
    <SimulationShell
      titleId="matrix-decode-title"
      gameId="matrix-decode"
      eyebrow="Operator trial"
      title="Decode the rain"
      startLabel="Run the trace"
      stage
      howToPlay={{
        objective:
          "Trial: type all five phrases, each before the trace bar fills. Freeplay: type forever and watch the speed graph.",
        controls: [
          { keys: "type", does: "enter the phrase exactly, in the field under the rain" },
          { keys: "trial / freeplay", does: "switch between the timed run and the endless one" },
          { keys: "Enter", does: "spend a charged purge and shove the trace back (trial)" },
          { keys: "Backspace", does: "walk back a mistake — it costs nothing on its own" },
          { keys: "pause", does: "freeze the trace clock and the graph between keystrokes" },
          { keys: "voice", does: "mute or unmute the spoken line that opens each round" },
        ],
        tip: "Finished words melt out of the line and fall into the rain. The chart under the field plots net wpm against raw wpm every second, and it stays up when the run ends. A wrong key breaks the combo and jolts the trace; twenty clean characters charge a purge, and the multiplier climbs at eight, eighteen and thirty.",
      }}
      reference={{
        quote: "Wake up, Neo…",
        scene: "The Matrix (1999) · the green rain, and the message that starts everything",
      }}
      onClose={onClose}
    >
      <DecodeTrial />
    </SimulationShell>
  );
}
