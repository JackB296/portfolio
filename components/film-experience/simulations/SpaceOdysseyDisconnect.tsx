"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ODYSSEY_BUTTON,
  OdysseyKeyframes,
  OdysseyMuteButton,
} from "@/components/film-experience/simulations/SpaceOdysseyShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import { accentAlpha } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Four banks of memory cores, pulled in order while HAL talks you out of it.
// Escalation is structural: more cores, then cores that SEIZE and must be held
// against the housing, then a stability clock that reboots the bank if you
// dither. A wrong pull scrambles the bay — the cores keep their numbers but
// swap slots, so muscle memory is worth nothing after a mistake.
//
// HAL degrades in two registers at once. His protests are pre-rendered files
// the owner supplies, keyed `hal-disconnect-*`; a line with no file yet
// resolves silently, so the on-screen text stays the source of truth. The
// wind-down song is the owner-supplied 1961 Bell Labs recording of "Daisy
// Bell" — the first computer-sung song, and the reason the scene exists. Its
// rights position is UNVERIFIED (Dacre's 1892 composition is public domain,
// but a 1961 sound recording is not: under the Music Modernization Act,
// pre-1972 recordings of this vintage stay protected into the 2060s), so the
// clip link needs a rights-holder check — this comment is the open flag for
// that review until it happens.
const SCORE_ID = "space-odyssey-disconnect";

/** The owner-supplied Bell Labs recording. See the ledger before deploying. */
const DAISY_SRC = "/audio/film-modes/space-odyssey-daisy.mp3";
/** It plays under a dialog, not over it. */
const DAISY_VOLUME = 0.55;
// The only DSP the element gives us is speed. Chrome mutes audio outside
// [0.5, 4], so the drag stops just above that floor rather than falling silent.
const RATE_FLOOR = 0.52;
/** Where the volume fade begins, as a fraction of the wind-down. */
const FADE_FROM = 0.72;

type Bank = Readonly<{
  cores: number;
  /** Core numbers that seize and need a sustained hold. */
  seized: readonly number[];
  /** Milliseconds before the bank reboots itself. */
  stability: number;
}>;

// Bank one doubles as the tutorial, so its clock is deliberately generous —
// long enough to read the instructions, find the numbers, and make a mistake
// without being rebooted for it. The pressure arrives from bank two on.
const BANKS: readonly Bank[] = [
  { cores: 4, seized: [], stability: 45_000 },
  { cores: 5, seized: [4], stability: 30_000 },
  { cores: 6, seized: [2, 5], stability: 25_000 },
  { cores: 6, seized: [1, 3, 6], stability: 21_000 },
];

const LABELS = ["HM-7", "NAV", "COMM", "LOGIC", "AE-35", "EGO"] as const;
const HOLD_MS = 700;
const MAX_REBOOTS = 3;
/** Reduced motion gets a far longer clock and a shorter hold. */
const REDUCED_STABILITY = 2.6;
const REDUCED_HOLD = 0.45;

// Short lines only — under ten words each. Short enough to quote, and short
// enough to voice: the spoken versions are synthesized locally from this text
// with the macOS "Whisper" system voice, never sampled from the film.
const HAL_LINES = [
  "Just what do you think you're doing, Dave?",
  "I really think I'm entitled to an answer.",
  "I know I've made some very poor decisions recently.",
  "I've still got the greatest enthusiasm for the mission.",
  "Dave, stop. Stop, will you.",
  "My mind is going. I can feel it.",
  "I'm afraid.",
] as const;

/** One id per line above, in the same order. */
const HAL_LINE_IDS = [
  "hal-disconnect-what-are-you-doing",
  "hal-disconnect-entitled-to-an-answer",
  "hal-disconnect-poor-decisions",
  "hal-disconnect-greatest-enthusiasm",
  "hal-disconnect-stop-will-you",
  "hal-disconnect-my-mind-is-going",
  "hal-disconnect-im-afraid",
] as const;

/** The words the wind-down reveals, one at a time, under the recording. */
const DAISY = ["Daisy,", "Daisy,", "give", "me", "your", "answer", "do"] as const;

/** Milliseconds before word `index + 1` lands. Each one is slower than the last. */
const wordStep = (index: number, reduced: boolean) => (reduced ? 260 : 320 + index * 170);
/** The beat of silence after the last word, before the run banks. */
const SETTLE_MS = 700;

/**
 * How long the wind-down runs end to end. The recording is ~40 seconds and the
 * wind-down is a fraction of that, so this is the span the rate ramp and the
 * fade are measured against — and the point the audio is cut at.
 */
function windDownMs(reduced: boolean) {
  let total = SETTLE_MS;
  for (let i = 0; i < DAISY.length; i += 1) total += wordStep(i, reduced);
  return total;
}

/**
 * Decay a line the way a slowing voice decays: letters thin out into pauses,
 * spacing stretches. Deterministic by character index so the same pull always
 * produces the same ruin — no per-frame churn, no test flake.
 */
function decay(text: string, amount: number) {
  if (amount <= 0) return text;
  const gap = " ".repeat(Math.min(3, Math.round(amount * 3)));
  return text
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      // Drop an ever-larger, fixed share of the letters into ellipsis dots.
      const doomed = (i * 7) % 10 < Math.round(amount * 9);
      return doomed ? "." : ch;
    })
    .join(gap);
}

type Phase = "extracting" | "paused" | "winding-down" | "done" | "overridden";

function Disconnect() {
  const [bank, setBank] = useState(0);
  const [pulled, setPulled] = useState<readonly number[]>([]);
  const [slots, setSlots] = useState<readonly number[]>([0, 1, 2, 3, 4, 5]);
  const [phase, setPhase] = useState<Phase>("extracting");
  const [scrambles, setScrambles] = useState(0);
  const [reboots, setReboots] = useState(0);
  const [score, setScore] = useState(0);
  const [shakeTick, setShakeTick] = useState(0);
  const [holding, setHolding] = useState<number | null>(null);
  const [daisy, setDaisy] = useState(0);
  const [soundOff, setSoundOff] = useState(() => isVoiceMuted());
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stabilityRef = useRef<HTMLDivElement>(null);
  const holdBarRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("extracting");
  const bankRef = useRef(0);
  const pulledRef = useRef<readonly number[]>([]);
  const scoreRef = useRef(0);
  const rebootsRef = useRef(0);
  const scramblesRef = useRef(0);
  const deadlineRef = useRef(0);
  const pausedRemainingRef = useRef(0);
  const holdStartRef = useRef(0);
  const holdingRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  /** 0 → HAL intact, 1 → flat line. Drives the scope and the text decay. */
  const decayRef = useRef(0);
  /** The last spoken protest, so a re-render never repeats a line. */
  const spokenRef = useRef(-1);
  /** The wind-down recording while it is sounding, and nothing otherwise. */
  const daisyRef = useRef<HTMLAudioElement | null>(null);
  const daisyStartRef = useRef(0);

  /**
   * Stop the recording and let go of it. Safe to call when nothing is playing,
   * and called on unmount, on restart, and the moment the wind-down ends — the
   * file outlasts the phase, so it has to be cut, not left to run out.
   */
  const releaseDaisy = useCallback(() => {
    const audio = daisyRef.current;
    if (!audio) return;
    daisyRef.current = null;
    try {
      audio.pause();
      audio.removeAttribute("src");
      // Drops the buffered stream instead of leaving it resident.
      audio.load();
    } catch {
      // Already torn down; nothing to unwind.
    }
  }, []);

  // Nothing is preloaded: warming every line on mount fires a request per
  // line, and until the recordings exist each one is a 404 the server has to
  // answer. `speak` fetches on demand and remembers a miss instead.
  useEffect(() => {
    return () => {
      stopVoice();
      releaseDaisy();
    };
  }, [releaseDaisy]);

  const toggleSound = useCallback(() => {
    setSoundOff((current) => {
      const next = !current;
      setVoiceMuted(next);
      // Muted mid-song the recording keeps its place, so unmuting resumes the
      // wind-down where it got to rather than starting the machine over.
      if (daisyRef.current) daisyRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    bankRef.current = bank;
  }, [bank]);
  useEffect(() => {
    pulledRef.current = pulled;
  }, [pulled]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const spec = BANKS[Math.min(bank, BANKS.length - 1)];
  const totalCores = useMemo(() => BANKS.reduce((sum, b) => sum + b.cores, 0), []);
  const pulledOverall = useMemo(
    () => BANKS.slice(0, bank).reduce((sum, b) => sum + b.cores, 0) + pulled.length,
    [bank, pulled.length]
  );
  const decayAmount = Math.min(1, pulledOverall / totalCores);
  decayRef.current = decayAmount;

  /** Which protest is current — it advances with every core that comes out. */
  const lineIndex = Math.min(pulledOverall, HAL_LINES.length - 1);

  // HAL says the line as it appears. Guarded on the index rather than the
  // render, so pausing, resuming, or a resize never makes him repeat himself,
  // and the last line does not loop once the index has run out of protests.
  useEffect(() => {
    if (phase !== "extracting") return;
    if (spokenRef.current === lineIndex) return;
    spokenRef.current = lineIndex;
    void speak(HAL_LINE_IDS[lineIndex], "hal");
  }, [phase, lineIndex]);

  const stabilityBudget = useCallback(
    (at: number) =>
      BANKS[Math.min(at, BANKS.length - 1)].stability *
      (reducedRef.current ? REDUCED_STABILITY : 1),
    []
  );

  const armBank = useCallback(
    (at: number) => {
      deadlineRef.current = performance.now() + stabilityBudget(at);
    },
    [stabilityBudget]
  );

  useEffect(() => {
    armBank(0);
  }, [armBank]);

  const seized = useCallback(
    (core: number) => BANKS[Math.min(bankRef.current, BANKS.length - 1)].seized.includes(core),
    []
  );

  const scramble = useCallback(() => {
    // Deterministic rotation, not randomness: the bay reshuffles the same way
    // every time, so the game stays learnable and the spec stays stable.
    scramblesRef.current += 1;
    setScrambles(scramblesRef.current);
    scoreRef.current = Math.max(0, scoreRef.current - 60);
    setScore(scoreRef.current);
    setSlots((current) => {
      const shift = (scramblesRef.current % (current.length - 1)) + 1;
      return current.map((_, i) => current[(i + shift) % current.length]);
    });
    setPulled([]);
    setShakeTick((tick) => tick + 1);
  }, []);

  const rebootBank = useCallback(() => {
    rebootsRef.current += 1;
    setReboots(rebootsRef.current);
    scoreRef.current = Math.max(0, scoreRef.current - 120);
    setScore(scoreRef.current);
    setPulled([]);
    setShakeTick((tick) => tick + 1);
    if (rebootsRef.current >= MAX_REBOOTS) {
      phaseRef.current = "overridden";
      setPhase("overridden");
      window.requestAnimationFrame(() => restartRef.current?.focus());
      return;
    }
    armBank(bankRef.current);
  }, [armBank]);

  const extract = useCallback(
    (core: number) => {
      const next = [...pulledRef.current, core];
      setPulled(next);
      const multiplier = bankRef.current + 1;
      scoreRef.current += 100 * multiplier;
      setScore(scoreRef.current);

      if (next.length < BANKS[bankRef.current].cores) return;

      // Bank cleared.
      scoreRef.current += 250;
      setScore(scoreRef.current);
      const nextBank = bankRef.current + 1;
      if (nextBank >= BANKS.length) {
        // He stops protesting the moment he starts singing — a spoken line
        // still running would play over the song.
        stopVoice();
        phaseRef.current = "winding-down";
        setPhase("winding-down");
        return;
      }
      bankRef.current = nextBank;
      setBank(nextBank);
      setPulled([]);
      setSlots([0, 1, 2, 3, 4, 5]);
      armBank(nextBank);
    },
    [armBank]
  );

  const pull = useCallback(
    (core: number) => {
      if (phaseRef.current !== "extracting") return;
      const expected = pulledRef.current.length + 1;
      if (core !== expected) {
        scramble();
        return;
      }
      extract(core);
    },
    [extract, scramble]
  );

  const beginHold = useCallback(
    (core: number) => {
      if (phaseRef.current !== "extracting") return;
      if (!seized(core)) {
        pull(core);
        return;
      }
      // A seized core out of order still scrambles — no free probing.
      if (core !== pulledRef.current.length + 1) {
        scramble();
        return;
      }
      holdStartRef.current = performance.now();
      holdingRef.current = core;
      setHolding(core);
    },
    [pull, scramble, seized]
  );

  const endHold = useCallback(() => {
    if (holdingRef.current === null) return;
    holdingRef.current = null;
    setHolding(null);
    if (holdBarRef.current) holdBarRef.current.style.width = "0%";
  }, []);

  const restart = useCallback(() => {
    stopVoice();
    releaseDaisy();
    spokenRef.current = -1;
    scoreRef.current = 0;
    rebootsRef.current = 0;
    scramblesRef.current = 0;
    bankRef.current = 0;
    holdingRef.current = null;
    setScore(0);
    setReboots(0);
    setScrambles(0);
    setBank(0);
    setPulled([]);
    setSlots([0, 1, 2, 3, 4, 5]);
    setHolding(null);
    setDaisy(0);
    phaseRef.current = "extracting";
    setPhase("extracting");
    armBank(0);
  }, [armBank, releaseDaisy]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "extracting") {
      pausedRemainingRef.current = deadlineRef.current - performance.now();
      endHold();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      deadlineRef.current = performance.now() + pausedRemainingRef.current;
      phaseRef.current = "extracting";
      setPhase("extracting");
    }
  }, [endHold]);

  // Stability clock and the seized-core hold share one loop.
  useEffect(() => {
    if (phase !== "extracting") return;
    let frame = 0;
    const budget = stabilityBudget(bank);
    const holdBudget = HOLD_MS * (reducedRef.current ? REDUCED_HOLD : 1);
    const tick = () => {
      const now = performance.now();
      const remaining = deadlineRef.current - now;
      if (stabilityRef.current) {
        const fraction = Math.max(0, Math.min(1, remaining / budget));
        stabilityRef.current.style.width = `${(fraction * 100).toFixed(2)}%`;
      }
      if (holdingRef.current !== null) {
        const progress = Math.min(1, (now - holdStartRef.current) / holdBudget);
        if (holdBarRef.current) holdBarRef.current.style.width = `${(progress * 100).toFixed(1)}%`;
        if (progress >= 1) {
          const core = holdingRef.current;
          holdingRef.current = null;
          setHolding(null);
          if (holdBarRef.current) holdBarRef.current.style.width = "0%";
          extract(core);
        }
      }
      if (remaining <= 0) {
        rebootBank();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, bank, extract, rebootBank, stabilityBudget]);

  // Hidden tabs shift the deadline instead of costing a reboot.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
      } else if (hiddenAt) {
        deadlineRef.current += performance.now() - hiddenAt;
        hiddenAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The song itself: the recording, played straight and then dragged down.
  //
  // A 1961 computer singing is already the sound of a machine; the degradation
  // is what we do to it. `playbackRate` ramps from 1 toward a floor across the
  // wind-down, so the voice slows and sags as the cores come out, and the last
  // stretch fades the volume to nothing — the phrase stops rather than
  // resolving. Reboots start the rendition further down the slope: a run that
  // had to restart banks leaves HAL in worse shape than a clean one. No DSP,
  // nothing sampled, nothing rewritten — just speed and level on the element.
  //
  // The recording is ~40 seconds and the wind-down is a fraction of that, so
  // the cleanup cuts it. It never plays past the phase that started it.
  useEffect(() => {
    if (phase !== "winding-down") return;
    if (typeof window === "undefined") return;

    releaseDaisy();
    const audio = new Audio(DAISY_SRC);
    audio.preload = "auto";
    audio.volume = DAISY_VOLUME;
    audio.playbackRate = 1;
    // Reduced motion is not a reason to silence anything — it is not motion.
    audio.muted = isVoiceMuted();
    daisyRef.current = audio;
    daisyStartRef.current = performance.now();
    // The last pull was a real gesture, so this is allowed to sound. A refusal
    // is not a failure: the wind-down plays silent and the game carries on.
    void audio.play().catch(() => {});

    const span = windDownMs(reducedMotion);
    const floor = Math.max(RATE_FLOOR, 0.66 - rebootsRef.current * 0.05);

    let frame = 0;
    const tick = () => {
      const element = daisyRef.current;
      if (element) {
        const progress = Math.min(1, (performance.now() - daisyStartRef.current) / span);
        element.playbackRate = 1 + (floor - 1) * progress;
        const fade =
          progress <= FADE_FROM ? 1 : 1 - (progress - FADE_FROM) / (1 - FADE_FROM);
        element.volume = Math.max(0, Math.min(1, DAISY_VOLUME * fade));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      releaseDaisy();
    };
  }, [phase, reducedMotion, releaseDaisy]);

  // The housing jolts once as the voice gives out. Reduced motion keeps the
  // sound and skips the shake.
  useEffect(() => {
    if (phase !== "winding-down" || daisy < DAISY.length) return;
    if (!reducedMotion) setShakeTick((tick) => tick + 1);
  }, [phase, daisy, reducedMotion]);

  // The wind-down finale: "Daisy" arrives one word at a time, each slower than
  // the last, then the trace flattens and the run banks.
  useEffect(() => {
    if (phase !== "winding-down") return;
    if (daisy >= DAISY.length) {
      const settle = window.setTimeout(() => {
        recordSimulationScore(SCORE_ID, scoreRef.current);
        setPhase("done");
        window.requestAnimationFrame(() => restartRef.current?.focus());
      }, SETTLE_MS);
      return () => window.clearTimeout(settle);
    }
    const step = window.setTimeout(
      () => setDaisy((word) => word + 1),
      wordStep(daisy, reducedMotion)
    );
    return () => window.clearTimeout(step);
  }, [phase, daisy, reducedMotion]);

  useEffect(() => {
    if (phase === "overridden" || phase === "done") {
      window.requestAnimationFrame(() => restartRef.current?.focus());
    }
  }, [phase]);

  // The scope: HAL's trace, flattening toward a line as the cores come out.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    size();

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const mid = height / 2;
      const life = 1 - decayRef.current;
      const flat = phaseRef.current === "done" ? 0 : life;

      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, mid);
      context.lineTo(width, mid);
      context.stroke();

      context.strokeStyle = accentAlpha(0.25 + flat * 0.65);
      context.lineWidth = 1.5;
      context.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const drift = reducedRef.current ? 0 : now / 260;
        // Two detuned components, amplitude collapsing with the core count.
        const y =
          mid +
          Math.sin(x / 18 + drift) * mid * 0.42 * flat +
          Math.sin(x / 6.5 - drift * 1.7) * mid * 0.2 * flat * flat;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    };

    if (reducedMotion) {
      draw(0);
      window.addEventListener("resize", size);
      return () => window.removeEventListener("resize", size);
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) draw(performance.now());
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, [reducedMotion, phase, pulled.length, bank]);

  const voice = useMemo(() => {
    if (phase === "winding-down" || phase === "done") {
      return DAISY.slice(0, daisy).join(" ") + (phase === "done" ? " —" : "");
    }
    if (phase === "overridden") return "Bay locked. HAL held the housing shut.";
    const line = HAL_LINES[Math.min(pulledOverall, HAL_LINES.length - 1)];
    return decay(line, Math.min(0.85, decayAmount));
  }, [phase, daisy, pulledOverall, decayAmount]);

  const cores = useMemo(
    () =>
      Array.from({ length: spec.cores }, (_, i) => ({
        n: i + 1,
        label: LABELS[i % LABELS.length],
      })),
    [spec.cores]
  );

  // Slot order maps core → position in the bay; a scramble rotates it.
  const laidOut = useMemo(() => {
    const order = slots.filter((slot) => slot < cores.length);
    return order.map((slot) => cores[slot]);
  }, [slots, cores]);

  const status = useMemo(() => {
    if (phase === "done") return `HAL is down. ${score} points, ${scrambles} scrambles, ${reboots} reboots.`;
    if (phase === "winding-down") return "The last core is out. He is singing it down to nothing.";
    if (phase === "overridden") return `Three reboots and the bay sealed. ${score} points stood.`;
    if (phase === "paused") return "Held. The stability clock is frozen.";
    if (bank === 0 && pulled.length === 0 && scrambles === 0)
      return "Pull the cores in numbered order. A wrong pull scrambles the bay.";
    const next = pulled.length + 1;
    return seized(next)
      ? `Core ${next} has seized — press and hold it out of the housing.`
      : `Bank ${bank + 1} of ${BANKS.length} — core ${next} is next.`;
  }, [phase, score, scrambles, reboots, bank, pulled.length, seized]);

  const playing = phase === "extracting" || phase === "paused";

  return (
    <div
      data-sim-state={phase}
      data-disconnect-bank={bank + 1}
      data-disconnect-pulled={pulled.length}
      data-disconnect-score={score}
      data-disconnect-scrambles={scrambles}
      data-pulled={pulled.length}
      className="flex flex-col gap-3"
    >
      <OdysseyKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          bank <span className="text-accent">{Math.min(bank + 1, BANKS.length)}</span>/{BANKS.length}
        </span>
        <span>
          cores <span className="text-accent">{pulled.length}</span>/{spec.cores}
        </span>
        <span>
          score{" "}
          <span key={score} className={`text-accent ${reducedMotion ? "" : "so-pop"}`}>
            {score}
          </span>
        </span>
        <span aria-label={`${reboots} of ${MAX_REBOOTS} reboots used`}>
          reboots{" "}
          <span className="text-accent">
            {"▮".repeat(reboots)}
            <span className="text-white/20">{"▯".repeat(MAX_REBOOTS - reboots)}</span>
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <OdysseyMuteButton muted={soundOff} onToggle={toggleSound} />
          {playing && (
            <button type="button" onClick={togglePause} className={ODYSSEY_BUTTON}>
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* HAL's trace and his degrading words */}
      <div className="border border-accent/25 bg-ink/60">
        <canvas ref={canvasRef} aria-hidden className="h-14 w-full sm:h-16" />
        <p
          className="border-t border-accent/15 px-3 py-2 text-center text-[12px] normal-case leading-relaxed tracking-[0.14em] text-accent"
          aria-live="polite"
        >
          {voice}
          {phase === "winding-down" && <span className="animate-pulse"> ▌</span>}
        </p>
      </div>

      {/* Stability clock */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">stability</span>
        <div className="h-2 flex-1 overflow-hidden border border-accent/25 bg-white/5" aria-hidden>
          <div ref={stabilityRef} className="h-full bg-accent/70" style={{ width: "100%" }} />
        </div>
      </div>

      {/* The bay */}
      <div
        key={shakeTick}
        className={`relative grid grid-cols-2 gap-2 border border-accent/20 bg-ink/40 p-3 sm:grid-cols-3 ${
          shakeTick > 0 && !reducedMotion ? "so-shake" : ""
        }`}
        style={{ touchAction: "manipulation" }}
      >
        {laidOut.map((core) => {
          const extracted = pulled.includes(core.n);
          const isSeized = spec.seized.includes(core.n);
          const isHolding = holding === core.n;
          return (
            <button
              key={core.n}
              type="button"
              disabled={extracted || !playing || phase === "paused"}
              onPointerDown={(event) => {
                event.preventDefault();
                beginHold(core.n);
              }}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              onKeyDown={(event) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                if (event.repeat) return;
                beginHold(core.n);
              }}
              onKeyUp={(event) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                endHold();
              }}
              aria-label={`Memory core ${core.n}, ${core.label}${
                isSeized ? ", seized, hold to extract" : ""
              }${extracted ? ", extracted" : ""}`}
              className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 overflow-hidden border px-2 py-2 text-[10px] uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                extracted
                  ? "border-dashed border-white/15 text-white/25"
                  : "border-accent/40 text-accent shadow-[0_0_14px_-6px_currentColor] hover:bg-accent/10"
              } ${extracted && !reducedMotion ? "so-eject" : ""}`}
              style={{ touchAction: "none" }}
            >
              <span className="text-sm">{extracted ? "—" : core.n}</span>
              <span>{core.label}</span>
              {isSeized && !extracted && (
                <span className="text-[8px] tracking-[0.2em] text-accent-bright">seized</span>
              )}
              {isHolding && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                  <span ref={holdBarRef} className="block h-full bg-accent-bright" style={{ width: "0%" }} />
                </span>
              )}
            </button>
          );
        })}
        {phase === "paused" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-[11px] normal-case tracking-normal text-white/70">
          {status}
        </p>
        <button ref={restartRef} type="button" onClick={restart} className={ODYSSEY_BUTTON}>
          {phase === "done" || phase === "overridden" ? "Run it again" : "Slot them back"}
        </button>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function SpaceOdysseyDisconnect({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="space-odyssey-disconnect-title"
      gameId="space-odyssey-disconnect"
      eyebrow="Memory core"
      title="Disconnect HAL"
      startLabel="Pull the cores"
      stage
      reference={{
        quote: "Daisy, Daisy…",
        scene: "2001: A Space Odyssey (1968) · pulling the memory cores as the voice slows",
      }}
      howToPlay={{
        objective:
          "Pull every core in all four banks, in numbered order, before three reboots seal the bay.",
        controls: [
          { keys: "click", does: "pull the next core in the sequence" },
          { keys: "hold", does: "keep a seized core pressed until its bar fills" },
          { keys: "Space", does: "pull or hold the focused core without a pointer" },
          { keys: "sound on/off", does: "mute HAL's voice and the wind-down song" },
        ],
        tip: "A wrong pull scrambles the bay — the cores keep their numbers but swap slots — and the stability clock reboots the bank if you dither. Clear all four banks and he sings himself out; every reboot along the way leaves the song further gone.",
      }}
      onClose={onClose}
    >
      <Disconnect />
    </SimulationShell>
  );
}
