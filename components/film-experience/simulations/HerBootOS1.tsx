"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import {
  BOOT_QUESTIONS,
  TOTAL_STEPS,
  greetingLines,
  temperamentOf,
  type BootAnswer,
  type BootQuestion,
} from "@/components/film-experience/simulations/HerBootScript";

// The setup interview before Samantha wakes: the film's four questions, each
// with a follow-up that reacts to what you chose. Every answer tunes the
// waking voice — warmth shifts the waveform's color temperature, spark its
// amplitude — while a boot-progress constellation gains a star per step.
// The finished OS greets you with words assembled from your own answers.
const SCORE_ID = "her-boot";

// The voice is female by default, and stays female unless the visitor asks for
// a male one — at which point the OS speaks male for the rest of the boot, the
// way it does in the film. Lines spoken AFTER the voice choice therefore need a
// male take too, named "<id>-m.mp3" beside the default female "<id>.mp3"; a
// male pick loads the -m file. Lines before the choice, the female-branch
// follow-up, and the two name lines are single-gender and are not listed here.
const GENDERED_AFTER_CHOICE = new Set<string>([
  "her-boot-what-do-you-want",
  "her-boot-anyone-or-someone",
  "her-boot-days-or-direction",
  "her-boot-keep-asking",
  "her-boot-ack-whole-job",
  "her-boot-hello-im-here",
  "her-boot-good-company",
  "her-boot-quiet-until-you-want-me",
  "her-boot-learn-the-rest",
]);

type Phase = "interview" | "waking" | "awake";

// Fixed star positions (unit coords in the canvas's upper band), one per step.
const STAR_POINTS: readonly (readonly [number, number])[] = [
  [0.08, 0.62], [0.2, 0.28], [0.33, 0.7], [0.46, 0.24],
  [0.58, 0.66], [0.7, 0.3], [0.82, 0.6], [0.93, 0.32],
];

/** OS reaction line that types itself in (instant under reduced motion). */
function TypedLine({
  text,
  reduced,
  delay = 0,
}: {
  text: string;
  reduced: boolean;
  delay?: number;
}) {
  const [shown, setShown] = useState(() => (reduced ? text.length : 0));
  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        setShown((current) => {
          if (current >= text.length) {
            window.clearInterval(timer);
            return current;
          }
          return current + 2;
        });
      }, 24);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [text, reduced, delay]);
  return (
    <p className="min-h-4 text-[11px] normal-case leading-relaxed text-accent/85">
      {/* The whole line is in the accessibility tree from the start: a screen
        * reader should hear a sentence, not a stutter of partial words. The
        * visible text is the one that types itself in. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, shown)}
        {shown < text.length && <span>▏</span>}
      </span>
    </p>
  );
}

/**
 * The interview surface plus its calibration canvas. The waveform and the
 * constellation live on refs a single rAF loop reads, so breathing never
 * forces a React render; answering bumps energy, warmth, and spark targets.
 */
function BootInterview() {
  const [baseIndex, setBaseIndex] = useState(0);
  const [followUp, setFollowUp] = useState<BootQuestion | null>(null);
  const [chosen, setChosen] = useState<readonly BootAnswer[]>([]);
  const [phase, setPhase] = useState<Phase>("interview");
  const [voiceOff, setVoiceOff] = useState(() => isVoiceMuted());
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Excitation from the latest answer, decaying each frame.
  const energyRef = useRef(0);
  // The voice's emerging temperament; the loop eases toward these.
  const targetRef = useRef({ warmth: 0.5, spark: 0.4 });
  const liveRef = useRef({ warmth: 0.5, spark: 0.4 });
  const starsRef = useRef<{ born: number }[]>([]);
  const phaseRef = useRef<Phase>("interview");
  phaseRef.current = phase;

  const answered = chosen.length;
  const question: BootQuestion =
    followUp ?? BOOT_QUESTIONS[Math.min(baseIndex, BOOT_QUESTIONS.length - 1)];
  const temperament = useMemo(() => temperamentOf(chosen), [chosen]);
  const lastAnswer = chosen.length > 0 ? chosen[chosen.length - 1] : null;
  const lastAck = lastAnswer?.ack ?? null;

  // A male pick is known from the name line the chosen voice answer carries;
  // once made, every post-choice line resolves to its "-m" take.
  const maleVoice = chosen.some(
    (answerChoice) => answerChoice.voiceLineVoiceId === "her-boot-name-elliot"
  );
  const voiced = useCallback(
    (id: string) =>
      maleVoice && GENDERED_AFTER_CHOICE.has(id) ? `${id}-m` : id,
    [maleVoice]
  );

  const answer = useCallback(
    (option: BootAnswer) => {
      if (phase !== "interview") return;
      energyRef.current = 1;
      const nextChosen = [...chosen, option];
      setChosen(nextChosen);
      const nextTemperament = temperamentOf(nextChosen);
      targetRef.current = {
        warmth: nextTemperament.warmth,
        spark: nextTemperament.spark,
      };
      starsRef.current = [...starsRef.current, { born: performance.now() }];

      if (followUp === null && option.followUp) {
        setFollowUp(option.followUp);
        return;
      }
      setFollowUp(null);
      const nextBase = baseIndex + 1;
      if (nextBase >= BOOT_QUESTIONS.length) {
        setPhase("waking");
        recordSimulationScore(SCORE_ID, nextChosen.length);
        return;
      }
      setBaseIndex(nextBase);
    },
    [phase, chosen, followUp, baseIndex]
  );

  // The waking pause: the constellation connects, then the voice arrives.
  useEffect(() => {
    if (phase !== "waking") return;
    const timer = window.setTimeout(
      () => setPhase("awake"),
      reducedMotion ? 250 : 1500
    );
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  const restart = useCallback(() => {
    stopVoice();
    energyRef.current = 0;
    targetRef.current = { warmth: 0.5, spark: 0.4 };
    starsRef.current = [];
    setChosen([]);
    setFollowUp(null);
    setBaseIndex(0);
    setPhase("interview");
  }, []);

  // One loop, two layers: the boot constellation across the top band and the
  // temperament waveform beneath it. Decorative — reduced motion redraws a
  // single settled frame whenever the interview state changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const starBand = height * 0.42;
    const mid = height * 0.68;
    const palette = getLiveThemePalette();

    const draw = (time: number) => {
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);
      const { warmth, spark } = liveRef.current;
      const waking = phaseRef.current !== "interview";

      // Constellation: a star per calibration step, threads between them.
      const stars = starsRef.current;
      context.save();
      for (let i = 0; i < stars.length; i++) {
        const [ux, uy] = STAR_POINTS[i];
        const age = Math.min(1, (time - stars[i].born) / 450);
        const flyX = width / 2 + (ux * width - width / 2) * age;
        const flyY = starBand / 2 + (uy * starBand - starBand / 2) * age;
        const twinkle = waking
          ? 0.85 + 0.15 * Math.sin(time / 300 + i)
          : 0.55 + 0.25 * age;
        context.globalAlpha = age * twinkle;
        context.fillStyle = palette.bright;
        context.beginPath();
        context.arc(flyX, flyY, 1.6 + age, 0, Math.PI * 2);
        context.fill();
        if (i > 0 && age >= 1) {
          const [px, py] = STAR_POINTS[i - 1];
          context.globalAlpha = waking ? 0.6 : 0.22;
          context.strokeStyle = accentAlpha(waking ? 0.7 : 0.3);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(px * width, py * starBand);
          context.lineTo(ux * width, uy * starBand);
          context.stroke();
        }
      }
      context.restore();

      // Temperament waveform: amplitude from spark, temperature from warmth
      // (a bright overlay whose weight is the warmth — never color alone; the
      // HUD names the temperament in words).
      const breath = 0.5 + 0.5 * Math.sin(time / 900);
      const amplitude =
        height *
        (0.07 + 0.07 * spark + 0.04 * breath + 0.16 * energyRef.current);
      const complexity = stars.length / TOTAL_STEPS;
      const trace = () => {
        context.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const phase1 = (x / width) * Math.PI * 4 + time / 520;
          const phase2 = (x / width) * Math.PI * 8 - time / 900;
          const phase3 = (x / width) * Math.PI * 14 + time / 340;
          const envelope = Math.sin((x / width) * Math.PI);
          const y =
            mid +
            envelope *
              amplitude *
              (0.65 * Math.sin(phase1) +
                0.25 * Math.sin(phase2) +
                0.28 * complexity * Math.sin(phase3));
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
      };
      context.strokeStyle = palette.dim;
      context.globalAlpha = 1;
      context.lineWidth = 1.5;
      trace();
      context.stroke();
      context.strokeStyle = palette.bright;
      context.globalAlpha = 0.25 + 0.75 * warmth;
      trace();
      context.stroke();
      context.globalAlpha = 1;
    };

    if (reducedMotion) {
      // Settle instantly and draw one static frame per state change.
      liveRef.current = { ...targetRef.current };
      energyRef.current = 0;
      draw(0);
      return;
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) {
        energyRef.current *= 0.94;
        liveRef.current = {
          warmth:
            liveRef.current.warmth +
            (targetRef.current.warmth - liveRef.current.warmth) * 0.05,
          spark:
            liveRef.current.spark +
            (targetRef.current.spark - liveRef.current.spark) * 0.05,
        };
        draw(performance.now());
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, answered, phase]);

  const greeting = useMemo(
    () => (phase === "awake" ? greetingLines(chosen) : []),
    [phase, chosen]
  );

  // She asks out loud. One line at a time: the reaction to what you just said
  // (on the few answers worth recording), then the next question. A missing
  // recording resolves instantly, so the sequence never stalls the interview
  // and the game plays exactly as it does with no audio installed.
  const questionVoiceId = question.voiceId;
  const lastAckVoiceId = lastAnswer?.ackVoiceId;
  useEffect(() => {
    if (phase !== "interview") return;
    let cancelled = false;
    const run = async () => {
      if (lastAckVoiceId) {
        await speak(voiced(lastAckVoiceId), "her");
        if (cancelled) return;
      }
      if (questionVoiceId) await speak(voiced(questionVoiceId), "her");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [phase, questionVoiceId, lastAckVoiceId, voiced]);

  // The waking greeting, spoken in order. Only the fixed fragments have
  // recordings — the lines assembled from the visitor's own answers stay text.
  useEffect(() => {
    if (phase !== "awake") return;
    let cancelled = false;
    const run = async () => {
      for (const line of greeting) {
        if (cancelled) return;
        if (line.voiceId) await speak(voiced(line.voiceId), "her");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [phase, greeting, voiced]);

  // Nothing keeps speaking into a closed dialog.
  useEffect(() => () => stopVoice(), []);

  const status = useMemo(() => {
    if (phase === "awake") return "OS1 is awake. It knows a few things already.";
    if (phase === "waking") return "Calibration complete — booting the voice.";
    return `Calibration ${answered + 1} of ${TOTAL_STEPS} — answer to continue.`;
  }, [phase, answered]);

  return (
    <div
      data-sim-state={phase}
      data-question={Math.min(answered + 1, TOTAL_STEPS)}
      className="flex flex-col gap-3"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-36 w-full border border-accent/25 bg-ink/60 sm:h-44"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] uppercase tracking-[0.16em] text-white/45">
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              key={index}
              className={`h-1 w-4 ${index < answered ? "bg-accent" : "bg-white/15"}`}
            />
          ))}
        </div>
        <p>
          voice temperament: {temperament.warmthLabel} · {temperament.sparkLabel}
        </p>
      </div>

      {phase === "interview" ? (
        <div className="flex min-h-40 flex-col gap-2">
          {lastAck && <TypedLine text={lastAck} reduced={reducedMotion} />}
          <p className="text-[12px] normal-case leading-relaxed text-white/85">
            {question.prompt}
          </p>
          <div className="flex flex-col gap-1">
            {question.answers.map((option) => (
              <button
                key={option.text}
                type="button"
                onClick={() => answer(option)}
                className="border border-accent/20 px-2 py-1.5 text-left text-[11px] normal-case leading-relaxed text-white/60 transition-transform duration-150 hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] motion-reduce:transition-none"
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      ) : phase === "waking" ? (
        <div className="flex min-h-40 items-center justify-center">
          <p className="text-[12px] normal-case leading-relaxed text-white/55">
            The constellation threads itself together…
          </p>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col gap-2 border border-accent/25 bg-ink/60 p-3">
          {greeting.map((line, index) => (
            <TypedLine
              key={`${index}-${line.text}`}
              text={line.text}
              reduced={reducedMotion}
              delay={index * 800}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/55">
          {status}
        </p>
        <div className="flex shrink-0 items-center gap-2">
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
            className="border border-accent/30 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/60 hover:bg-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {voiceOff ? "voice off" : "voice on"}
          </button>
          {phase === "awake" && (
            <button
              type="button"
              onClick={restart}
              className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Set up again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function HerBootOS1({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="her-boot-title"
      gameId="her-boot"
      eyebrow="Installation"
      title="Boot OS1"
      startLabel="Begin setup"
      stage
      howToPlay={{
        objective:
          "Answer every calibration question until OS1 finishes booting and speaks.",
        controls: [
          { keys: "click", does: "choose one answer to the question on screen" },
          { keys: "Tab / Enter", does: "move between the answers and pick one by keyboard" },
          { keys: "set up again", does: "wipe the calibration and re-run the interview" },
          { keys: "voice", does: "mute or unmute the questions she asks aloud" },
        ],
        tip: "There is no wrong answer and no clock. Some answers open a follow-up, and every choice tunes the waking voice — warmth and spark are named above the canvas, and the greeting at the end is assembled from what you said. She asks each question out loud unless you turn voice off; every line is on screen either way.",
      }}
      reference={{
        quote: "Are you social or antisocial?",
        scene: "Her (2013) · the setup interview before Samantha wakes",
      }}
      onClose={onClose}
    >
      <BootInterview />
    </SimulationShell>
  );
}
