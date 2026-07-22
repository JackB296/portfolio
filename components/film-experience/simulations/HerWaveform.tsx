"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import { createAudioContext } from "@/lib/filmAudio";

// A duet with a voice made of light. The OS speaks a cadence — a short
// pattern of pulses — and you answer it back in the same rhythm. Locked-in
// answers pull your waveform into harmony with hers; drift pushes the two
// lines apart. Five rounds, each pattern longer and quicker, ending in a
// sustained-harmony celebration if the duet held.
const SCORE_ID = "her-waveform";

type Round = Readonly<{ beats: number; tempo: number; tolerance: number }>;

const ROUNDS: readonly Round[] = [
  { beats: 3, tempo: 700, tolerance: 210 },
  { beats: 4, tempo: 640, tolerance: 190 },
  { beats: 4, tempo: 560, tolerance: 170 },
  { beats: 5, tempo: 520, tolerance: 155 },
  { beats: 6, tempo: 480, tolerance: 140 },
];

const CONNECT_THRESHOLD = 55;
const LEAD_IN_MS = 750;

/**
 * What she says before each round's cadence. The middle rounds share a line
 * on purpose: three recordings cover five rounds, and the pulses — not the
 * words — are what changes round to round. The recorded text:
 *
 *   her-wave-hello         "Hello. I'm here. Listen — and then answer me back."
 *   her-wave-again-quicker "Again. A little quicker this time."
 *   her-wave-last-one      "Last one. Stay with me."
 *   her-wave-connected     "Two lines, one voice. You stayed with me the whole way."
 *   her-wave-faded         "I lost you somewhere in there. Reach out again — I'll wait."
 */
const ROUND_VOICE_IDS: readonly string[] = [
  "her-wave-hello",
  "her-wave-again-quicker",
  "her-wave-again-quicker",
  "her-wave-again-quicker",
  "her-wave-last-one",
];

type Phase = "speaking" | "responding" | "connected" | "faded";
type TapQuality = "first" | "locked" | "drift" | null;

type Ring = { born: number; kind: "os" | "player"; locked: boolean };
type Mote = { x: number; y: number; vy: number; sway: number; born: number };

/**
 * The duet surface. Pattern playback runs on timeouts (cleaned per phase);
 * a single rAF loop only draws — waveforms, pulse rings, and the celebration
 * motes all live on refs so rhythm never forces a render storm.
 */
function WaveformDuet() {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("speaking");
  const [beatsPlayed, setBeatsPlayed] = useState(0);
  const [tapsMade, setTapsMade] = useState(0);
  const [harmonies, setHarmonies] = useState<readonly number[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastQuality, setLastQuality] = useState<TapQuality>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [voiceOff, setVoiceOff] = useState(() => isVoiceMuted());
  const [runId, setRunId] = useState(0);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const osEnergyRef = useRef(0.15);
  const playerEnergyRef = useRef(0.1);
  const ringsRef = useRef<Ring[]>([]);
  const motesRef = useRef<Mote[]>([]);
  const lastTapRef = useRef<number | null>(null);
  const tapsRef = useRef(0);
  const accuraciesRef = useRef<number[]>([]);
  const harmonyRef = useRef(0);
  const phaseStartRef = useRef(performance.now());
  const audioRef = useRef<{ context: AudioContext | null; on: boolean }>({
    context: null,
    on: false,
  });

  const current = ROUNDS[round];
  const harmony = useMemo(() => {
    if (harmonies.length === 0) return 0;
    return Math.round(
      harmonies.reduce((sum, h) => sum + h, 0) / harmonies.length
    );
  }, [harmonies]);
  harmonyRef.current = harmony;

  // Self-rendered blips only: a soft oscillator per pulse, context created on
  // the sound toggle's user gesture and closed on unmount.
  const beep = useCallback((frequency: number, type: OscillatorType) => {
    const { context, on } = audioRef.current;
    if (!context || !on || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.04, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      if (next && !audioRef.current.context) {
        audioRef.current.context = createAudioContext();
      }
      audioRef.current.on = next;
      void audioRef.current.context?.resume();
      return next;
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      void audio.context?.close();
      audio.context = null;
    };
  }, []);

  // The OS speaks: schedule this round's pattern on timeouts, then hand the
  // turn over. Replays and restarts re-enter via phase/round/runId changes.
  useEffect(() => {
    if (phase !== "speaking") return;
    const { beats, tempo } = ROUNDS[round];
    phaseStartRef.current = performance.now();
    setBeatsPlayed(0);
    setTapsMade(0);
    const timers: number[] = [];
    for (let i = 0; i < beats; i++) {
      timers.push(
        window.setTimeout(() => {
          osEnergyRef.current = 1;
          ringsRef.current.push({
            born: performance.now(),
            kind: "os",
            locked: true,
          });
          beep(520, "sine");
          setBeatsPlayed(i + 1);
        }, LEAD_IN_MS + i * tempo)
      );
    }
    timers.push(
      window.setTimeout(() => {
        lastTapRef.current = null;
        tapsRef.current = 0;
        accuraciesRef.current = [];
        setLastQuality(null);
        setPhase("responding");
        phaseStartRef.current = performance.now();
      }, LEAD_IN_MS + (beats - 1) * tempo + 650)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, round, runId, beep]);

  const finishRound = useCallback(
    (accuracies: readonly number[]) => {
      const roundHarmony = Math.round(
        (accuracies.reduce((sum, a) => sum + a, 0) /
          Math.max(1, accuracies.length)) *
          100
      );
      const nextHarmonies = [...harmonies, roundHarmony];
      setHarmonies(nextHarmonies);
      if (round + 1 >= ROUNDS.length) {
        const total = Math.round(
          nextHarmonies.reduce((sum, h) => sum + h, 0) / nextHarmonies.length
        );
        if (total >= CONNECT_THRESHOLD) {
          setPhase("connected");
          recordSimulationScore(SCORE_ID, total);
          motesRef.current = Array.from({ length: 26 }, () => ({
            x: Math.random(),
            y: 1 + Math.random() * 0.3,
            vy: 0.1 + Math.random() * 0.18,
            sway: Math.random() * Math.PI * 2,
            born: performance.now(),
          }));
        } else {
          setPhase("faded");
        }
        phaseStartRef.current = performance.now();
        return;
      }
      setRound(round + 1);
      setPhase("speaking");
    },
    [harmonies, round]
  );

  const pulse = useCallback(() => {
    if (phase !== "responding") return;
    const { beats, tempo, tolerance } = current;
    // Tap count lives on a ref so a burst of rapid taps can't desync the round.
    if (tapsRef.current >= beats) return;
    const now = performance.now();
    playerEnergyRef.current = 1;
    const last = lastTapRef.current;
    lastTapRef.current = now;
    let locked = true;
    if (last === null) {
      setLastQuality("first");
    } else {
      const error = Math.abs(now - last - tempo);
      locked = error <= tolerance;
      const accuracy = Math.max(0, Math.min(1, 1 - error / (tolerance * 1.8)));
      accuraciesRef.current.push(accuracy);
      setLastQuality(locked ? "locked" : "drift");
      setStreak((s) => {
        const next = locked ? s + 1 : 0;
        if (next > 0) setBestStreak((b) => Math.max(b, next));
        return next;
      });
    }
    ringsRef.current.push({ born: now, kind: "player", locked });
    beep(392, "triangle");
    tapsRef.current += 1;
    setTapsMade(tapsRef.current);
    if (tapsRef.current >= beats) finishRound(accuraciesRef.current);
  }, [phase, current, beep, finishRound]);

  // She takes her turn out loud: a word before the cadence, and a word about
  // how the duet ended. One line at a time — starting a round cuts whatever
  // was still speaking, and a line with no recording yet is simply silent.
  useEffect(() => {
    if (phase !== "speaking") return;
    void speak(ROUND_VOICE_IDS[round] ?? ROUND_VOICE_IDS[0], "her");
  }, [phase, round, runId]);

  useEffect(() => {
    if (phase === "connected") void speak("her-wave-connected", "her");
    else if (phase === "faded") void speak("her-wave-faded", "her");
  }, [phase]);

  useEffect(() => () => stopVoice(), []);

  const replayPattern = useCallback(() => {
    if (phase !== "responding") return;
    setPhase("speaking");
  }, [phase]);

  const restart = useCallback(() => {
    stopVoice();
    ringsRef.current = [];
    motesRef.current = [];
    osEnergyRef.current = 0.15;
    playerEnergyRef.current = 0.1;
    lastTapRef.current = null;
    tapsRef.current = 0;
    accuraciesRef.current = [];
    setRound(0);
    setHarmonies([]);
    setStreak(0);
    setBestStreak(0);
    setLastQuality(null);
    setBeatsPlayed(0);
    setTapsMade(0);
    setPhase("speaking");
    setRunId((id) => id + 1);
  }, []);

  // The drawing loop: her line, your line, pulse rings, celebration motes.
  // Harmony pulls the two lines' phase offset together. Reduced motion draws
  // one static frame per state change instead of animating.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const mid = height / 2;
    const palette = getLiveThemePalette();
    const phaseNow = phase;

    const traceWave = (
      time: number,
      amplitude: number,
      offset: number,
      color: string,
      alpha: number
    ) => {
      context.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const envelope = Math.sin((x / width) * Math.PI);
        const wobble =
          0.7 * Math.sin((x / width) * Math.PI * 6 + time / 260 + offset) +
          0.3 * Math.sin((x / width) * Math.PI * 12 - time / 420 + offset);
        const y = mid + envelope * amplitude * wobble;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.stroke();
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);
      const gap = (1 - harmonyRef.current / 100) * 1.6;

      if (phaseNow === "connected") {
        // One voice now: a single bright line breathing, motes rising.
        const breath = 0.5 + 0.5 * Math.sin(time / 700);
        traceWave(time, height * (0.16 + 0.1 * breath), 0, palette.bright, 1);
        for (const mote of motesRef.current) {
          const age = (time - mote.born) / 1000;
          const y = (mote.y - mote.vy * age) * height;
          if (y < -8) continue;
          const x =
            (mote.x + 0.02 * Math.sin(time / 500 + mote.sway)) * width;
          context.globalAlpha = Math.max(0, 0.7 - age * 0.18);
          context.fillStyle = palette.bright;
          context.beginPath();
          context.arc(x, y, 1.8, 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      } else if (phaseNow === "faded") {
        traceWave(time, height * 0.05, 0, palette.dim, 0.8);
      } else {
        // Her voice and yours; harmony narrows the offset between them.
        traceWave(
          time,
          height * (0.1 + 0.28 * osEnergyRef.current),
          0,
          palette.accent,
          0.95
        );
        traceWave(
          time,
          height * (0.08 + 0.26 * playerEnergyRef.current),
          gap,
          palette.dim,
          0.85
        );
      }

      // Pulse rings: hers bright and centered, yours dim and lower; a missed
      // beat draws a broken ring so the miss reads without color.
      const rings = ringsRef.current;
      for (const ring of rings) {
        const age = (time - ring.born) / 600;
        if (age > 1) continue;
        const radius = 6 + age * 34;
        const y = ring.kind === "os" ? mid - height * 0.12 : mid + height * 0.12;
        context.globalAlpha = (1 - age) * 0.8;
        context.strokeStyle =
          ring.kind === "os" ? palette.bright : palette.dim;
        context.lineWidth = 1.5;
        if (ring.locked) {
          context.beginPath();
          context.arc(width / 2, y, radius, 0, Math.PI * 2);
          context.stroke();
        } else {
          context.setLineDash([4, 5]);
          context.beginPath();
          context.arc(width / 2, y, radius, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
        }
      }
      context.globalAlpha = 1;
      if (rings.length > 40) ringsRef.current = rings.slice(-24);
    };

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) {
        osEnergyRef.current = Math.max(0.15, osEnergyRef.current * 0.95);
        playerEnergyRef.current = Math.max(0.1, playerEnergyRef.current * 0.95);
        draw(performance.now());
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, phase, beatsPlayed, tapsMade, runId]);

  const status = useMemo(() => {
    if (phase === "connected") {
      return `Sustained harmony ${harmony}% — two lines, one voice. Best streak ${bestStreak}.`;
    }
    if (phase === "faded") {
      return `The voice drifted — harmony ${harmony}%. Reach out again.`;
    }
    if (phase === "speaking") {
      return `Round ${round + 1} of ${ROUNDS.length} — listen. ${current.beats} pulses.`;
    }
    const quality =
      lastQuality === "locked"
        ? " In step."
        : lastQuality === "drift"
          ? " Adrift — steady the pace."
          : "";
    return `Your turn — answer ${current.beats} pulses at her pace.${quality}`;
  }, [phase, harmony, bestStreak, round, current.beats, lastQuality]);

  const patternDots = (count: number, filled: number) =>
    Array.from({ length: count }, (_, i) => (i < filled ? "●" : "○")).join(" ");

  return (
    <div
      data-sim-state={phase}
      data-round={round + 1}
      data-harmony={harmony}
      data-streak={streak}
      className="flex flex-col gap-3"
    >
      <p className="text-[11px] normal-case leading-relaxed text-white/55">
        She speaks a cadence; answer it back in the same rhythm. Tap the wave —
        or press enter while it is focused — once per pulse.
      </p>

      <button
        type="button"
        onClick={pulse}
        aria-label="Pulse in time"
        className="relative block w-full touch-none select-none border border-accent/25 bg-ink/60 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none block h-40 w-full sm:h-52"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-3 text-[9px] uppercase tracking-[0.2em] text-white/35"
        >
          {phase === "responding" ? "tap to answer" : phase === "speaking" ? "listening…" : ""}
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <p>
          her&nbsp;
          <span aria-hidden>{patternDots(current.beats, beatsPlayed)}</span>
          <span className="sr-only">
            {beatsPlayed} of {current.beats} pulses spoken
          </span>
        </p>
        <p>
          you&nbsp;
          <span aria-hidden>{patternDots(current.beats, tapsMade)}</span>
          <span className="sr-only">
            {tapsMade} of {current.beats} pulses answered
          </span>
        </p>
        <p>streak {streak}</p>
      </div>

      <div className="h-1 w-full bg-white/10" aria-hidden>
        <div
          className="h-full bg-accent/80 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${harmony}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {phase === "responding" && (
            <button
              type="button"
              onClick={replayPattern}
              className="border border-accent/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Play it again
            </button>
          )}
          {(phase === "connected" || phase === "faded") && (
            <button
              type="button"
              onClick={restart}
              className="border border-accent/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Reach out again
            </button>
          )}
          {(phase === "speaking" || phase === "responding") &&
            (round > 0 || harmonies.length > 0) && (
              <button
                type="button"
                onClick={restart}
                className="border border-accent/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Start over
              </button>
            )}
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            className="border border-accent/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !voiceOff;
              setVoiceMuted(next);
              setVoiceOff(next);
            }}
            aria-pressed={!voiceOff}
            aria-label={
              voiceOff ? "Unmute the spoken lines" : "Mute the spoken lines"
            }
            className="border border-accent/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {voiceOff ? "Voice off" : "Voice on"}
          </button>
        </div>
        <p
          role="status"
          className="text-right text-[10px] uppercase tracking-[0.12em] text-white/55"
        >
          {status}
        </p>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function HerWaveform({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="her-waveform-title"
      gameId="her-waveform"
      eyebrow="First contact"
      title="Waveform"
      startLabel="Listen for the voice"
      stage
      howToPlay={{
        objective:
          "Take turns with her: she speaks a cadence, you answer it back at the same tempo, five rounds.",
        controls: [
          { keys: "listen", does: "her turn — watch her pulses, you cannot answer yet" },
          { keys: "click wave", does: "your turn — one tap per pulse, matching her pace" },
          { keys: "Enter", does: "the same tap from the keyboard while the wave is focused" },
          { keys: "play it again", does: "hand the turn back so she repeats the cadence" },
          { keys: "sound", does: "toggle the pulse blips on or off" },
          { keys: "voice", does: "mute or unmute the words she speaks between rounds" },
        ],
        tip: "Your first tap only starts the clock — every tap after it is judged on the gap since the last one, which has to land inside the round's window around her tempo. Answer the full count and the round ends itself. Average harmony of 55% or better across the five rounds connects.",
      }}
      reference={{
        quote: "Hello, I'm here.",
        scene: "Her (2013) · a voice made of light, first words",
      }}
      onClose={onClose}
    >
      <WaveformDuet />
    </SimulationShell>
  );
}
