"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { createDuneSynth, type DuneSynth } from "./DuneAudio";

// The sandwalk: cross three legs of open dune one step at a time, but never
// let the taps settle into a heartbeat. Two steps of the same length feed the
// maker's attention; a third seals the run. Each leg is longer and the maker
// more discerning. Thumpers picked up along the way can be planted to draw it
// off and buy a few safe, steady steps.
const SCORE_ID = "dune-sandwalk";
const LEGS = [
  { steps: 12, ratio: 0.16, decay: 0.24, thumperAt: 4 },
  { steps: 16, ratio: 0.2, decay: 0.2, thumperAt: 6 },
  { steps: 20, ratio: 0.24, decay: 0.16, thumperAt: 7 },
] as const;
// A rhythmic step feeds the maker; a broken one buys a little quiet back.
const RHYTHM_PENALTY = 0.45;
const BREAK_REWARD = 0.16;
// A planted thumper drums for you: this many steps ignore cadence entirely.
const SAFE_STEPS = 3;
const MAX_CHARGES = 2;
const STEP_SCORE = 10;
const LEG_BONUS = 50;
const CROSS_BONUS = 150;

type Phase = "running" | "paused" | "failed" | "done";

type Footprint = Readonly<{ x: number; side: number }>;

const makerWord = (alert: number) => {
  if (alert < 0.25) return "quiet";
  if (alert < 0.5) return "listening";
  if (alert < 0.75) return "rising";
  return "breaching";
};

/**
 * The crossing itself. Mounted by the shell only once the visitor starts, so
 * mounting arms the walk: the maker is listening from the first step, and the
 * clock that governs idle-decay starts here, not while the card is still up.
 */
function Sandwalk() {
  const [phase, setPhase] = useState<Phase>("running");
  const [leg, setLeg] = useState(0);
  const [stepInLeg, setStepInLeg] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [charges, setCharges] = useState(0);
  const [alert, setAlert] = useState(0);
  const [muted, setMuted] = useState(false);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  // The mechanic lives in refs so a tap resolves without waiting on a frame.
  const phaseRef = useRef<Phase>("running");
  const lastTapRef = useRef(0);
  const lastIntervalRef = useRef(0);
  const alertRef = useRef(0);
  const legRef = useRef(0);
  const stepInLegRef = useRef(0);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const chargesRef = useRef(0);
  const safeRef = useRef(0);
  const pausedAtRef = useRef(0);
  // Presentation-only refs the canvas reads.
  const footprintsRef = useRef<Footprint[]>([]);
  const bobAtRef = useRef(0);
  const eruptAtRef = useRef(0);
  const bannerAtRef = useRef(0);
  const plantAtRef = useRef(0);
  const plantXRef = useRef(0);
  const synthRef = useRef<DuneSynth | null>(null);
  const mutedRef = useRef(false);

  const synth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = createDuneSynth(mutedRef.current);
    }
    return synthRef.current;
  }, []);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    // Arm the walk: focus the step control and set the clock's origin so the
    // first interval is measured from mount, not from an unset zero.
    lastTapRef.current = performance.now();
    lastIntervalRef.current = 0;
    window.requestAnimationFrame(() => stepButtonRef.current?.focus());
    const current = synthRef;
    return () => current.current?.dispose();
  }, []);

  const over = phase === "failed" || phase === "done";

  // Hand focus to the verdict once a run ends, so keyboard replay is one tap.
  useEffect(() => {
    if (over) window.requestAnimationFrame(() => restartButtonRef.current?.focus());
  }, [over]);

  const restart = useCallback(() => {
    phaseRef.current = "running";
    alertRef.current = 0;
    legRef.current = 0;
    stepInLegRef.current = 0;
    streakRef.current = 0;
    scoreRef.current = 0;
    chargesRef.current = 0;
    safeRef.current = 0;
    lastIntervalRef.current = 0;
    lastTapRef.current = performance.now();
    footprintsRef.current = [];
    eruptAtRef.current = 0;
    bannerAtRef.current = 0;
    plantAtRef.current = 0;
    setPhase("running");
    setLeg(0);
    setStepInLeg(0);
    setTotalSteps(0);
    setStreak(0);
    setScore(0);
    setCharges(0);
    setAlert(0);
    window.requestAnimationFrame(() => stepButtonRef.current?.focus());
  }, []);

  const step = useCallback(() => {
    if (phaseRef.current !== "running") return;
    const now = performance.now();
    const interval = now - lastTapRef.current;
    const conf = LEGS[legRef.current];

    // Idle since the last tap settles the sand first, so pausing your feet is
    // always a safe way to break a cadence.
    let next = Math.max(0, alertRef.current - (interval / 1000) * conf.decay);

    const previous = lastIntervalRef.current;
    if (safeRef.current > 0) {
      // The planted thumper is drumming: the maker isn't listening to you.
      safeRef.current -= 1;
      synth().tone(120, 90, { type: "sine", gain: 0.035 });
    } else if (previous > 0) {
      const longer = Math.max(interval, previous);
      const relative = longer > 0 ? Math.abs(interval - previous) / longer : 1;
      if (relative < conf.ratio) {
        next = Math.min(1, next + RHYTHM_PENALTY); // an even step: the maker hears it
        streakRef.current = 0;
        synth().tone(72, 260, { type: "sine", gain: 0.05, glide: 46 });
      } else {
        next = Math.max(0, next - BREAK_REWARD); // a broken step: quiet returns
        streakRef.current += 1;
        synth().tone(150 + Math.min(streakRef.current, 12) * 9, 90, { gain: 0.04 });
      }
    }

    alertRef.current = next;
    lastIntervalRef.current = interval;
    lastTapRef.current = now;
    setAlert(next);
    setStreak(streakRef.current);

    if (next >= 1) {
      eruptAtRef.current = now;
      setPhaseSafe("failed");
      recordSimulationScore(SCORE_ID, scoreRef.current);
      synth().tone(140, 700, { type: "sawtooth", gain: 0.05, glide: 30 });
      return;
    }

    const taken = stepInLegRef.current + 1;
    stepInLegRef.current = taken;
    bobAtRef.current = now;
    footprintsRef.current = [
      ...footprintsRef.current,
      { x: taken / conf.steps, side: taken % 2 === 0 ? 1 : -1 },
    ];
    scoreRef.current += Math.round(STEP_SCORE * (1 + Math.min(streakRef.current, 10) * 0.1));

    if (taken === conf.thumperAt && chargesRef.current < MAX_CHARGES) {
      chargesRef.current += 1;
      setCharges(chargesRef.current);
      synth().tone(420, 140, { gain: 0.04, glide: 640 });
    }

    if (taken >= conf.steps) {
      if (legRef.current >= LEGS.length - 1) {
        scoreRef.current += CROSS_BONUS;
        setScore(scoreRef.current);
        setStepInLeg(taken);
        setTotalSteps((count) => count + 1);
        setPhaseSafe("done");
        recordSimulationScore(SCORE_ID, scoreRef.current);
        synth().tone(320, 180, { gain: 0.05 });
        synth().tone(480, 260, { gain: 0.05, glide: 640 });
        return;
      }
      // Next leg: fresh sand, a breather on the alert, a fresh cadence.
      scoreRef.current += LEG_BONUS;
      legRef.current += 1;
      stepInLegRef.current = 0;
      alertRef.current = Math.max(0, alertRef.current * 0.6);
      lastIntervalRef.current = 0;
      footprintsRef.current = [];
      bannerAtRef.current = now;
      setLeg(legRef.current);
      setAlert(alertRef.current);
      synth().tone(260, 200, { gain: 0.045, glide: 390 });
    }

    setScore(scoreRef.current);
    setStepInLeg(stepInLegRef.current);
    setTotalSteps((count) => count + 1);
  }, [setPhaseSafe, synth]);

  const plantThumper = useCallback(() => {
    if (phaseRef.current !== "running" || chargesRef.current <= 0) return;
    chargesRef.current -= 1;
    safeRef.current = SAFE_STEPS;
    alertRef.current = Math.max(0, alertRef.current * 0.25);
    plantAtRef.current = performance.now();
    plantXRef.current = stepInLegRef.current / LEGS[legRef.current].steps;
    setCharges(chargesRef.current);
    setAlert(alertRef.current);
    synth().tone(90, 160, { type: "sine", gain: 0.055 });
    synth().tone(90, 160, { type: "sine", gain: 0.045, glide: 60 });
  }, [synth]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") {
      pausedAtRef.current = performance.now();
      setPhaseSafe("paused");
    } else if (phaseRef.current === "paused") {
      // Shift the tap clock so the paused stretch doesn't count as idle rest.
      lastTapRef.current += performance.now() - pausedAtRef.current;
      setPhaseSafe("running");
      window.requestAnimationFrame(() => stepButtonRef.current?.focus());
    }
  }, [setPhaseSafe]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      synthRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // The dune, the walker, the worm mound that surfaces as the maker closes in.
  // Decorative only (the meter and status carry the same information), so it
  // is aria-hidden; reduced motion repaints a still frame on each state change
  // instead of running the loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const crest = (x: number) =>
      height * 0.66 +
      Math.sin((x / width) * Math.PI * 1.15 + 0.35) * -height * 0.15 +
      Math.sin((x / width) * 7) * height * 0.015;

    const draw = (time: number) => {
      const palette = getLiveThemePalette();
      const conf = LEGS[legRef.current];
      const liveAlert =
        phaseRef.current === "running"
          ? Math.max(
              0,
              alertRef.current - ((time - lastTapRef.current) / 1000) * conf.decay
            )
          : alertRef.current;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Twin moons, high and patient.
      context.beginPath();
      context.arc(width * 0.76, height * 0.16, 7, 0, Math.PI * 2);
      context.fillStyle = accentAlpha(0.3);
      context.fill();
      context.beginPath();
      context.arc(width * 0.83, height * 0.24, 4, 0, Math.PI * 2);
      context.fillStyle = accentAlpha(0.2);
      context.fill();

      // Drifting sand on the wind (motion only).
      if (!reducedMotion) {
        for (let i = 0; i < 26; i += 1) {
          const px = (i * 137 + time * (0.02 + (i % 5) * 0.008)) % width;
          const py = height * (0.12 + ((i * 53) % 40) / 100);
          context.fillStyle = accentAlpha(0.08 + (i % 3) * 0.03);
          context.fillRect(px, py, 2, 1);
        }
      }

      // The worm mound: a bulge of sand behind the ridge, swelling with the
      // maker's attention; on failure it erupts through the crest.
      const wormX = width * 0.8;
      const erupting = phaseRef.current === "failed";
      const eruptT = erupting
        ? Math.min(1, (time - eruptAtRef.current) / 700)
        : 0;
      const mound = erupting
        ? height * (0.2 + eruptT * 0.34)
        : liveAlert * height * 0.2;
      if (mound > 2) {
        context.beginPath();
        context.moveTo(wormX - mound * 1.1, crest(wormX));
        context.quadraticCurveTo(wormX, crest(wormX) - mound, wormX + mound * 1.1, crest(wormX));
        context.closePath();
        context.fillStyle = accentAlpha(erupting ? 0.45 : 0.12 + liveAlert * 0.2);
        context.fill();
        context.strokeStyle = accentAlpha(erupting ? 0.8 : 0.3);
        context.stroke();
        if (erupting) {
          // The open maw: ring teeth around the crest of the eruption.
          const mouthY = crest(wormX) - mound;
          for (let t = 0; t < 7; t += 1) {
            const angle = Math.PI + (t / 6) * Math.PI;
            context.beginPath();
            context.moveTo(wormX + Math.cos(angle) * mound * 0.5, mouthY + mound * 0.4);
            context.lineTo(
              wormX + Math.cos(angle) * mound * 0.32,
              mouthY + mound * 0.4 + Math.sin(angle) * mound * 0.28
            );
            context.strokeStyle = accentAlpha(0.7);
            context.stroke();
          }
        }
      }

      // A shudder through the whole frame while the maker breaches.
      if (erupting && !reducedMotion && eruptT < 1) {
        const magnitude = (1 - eruptT) * 4;
        context.save();
        context.translate(
          Math.sin(time * 0.09) * magnitude,
          Math.cos(time * 0.11) * magnitude
        );
      }

      // Dune crest the walker travels along.
      context.beginPath();
      context.moveTo(0, height);
      for (let x = 0; x <= width; x += 6) context.lineTo(x, crest(x));
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = accentAlpha(0.1);
      context.fill();
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= width; x += 6) {
        if (x === 0) context.moveTo(x, crest(x));
        else context.lineTo(x, crest(x));
      }
      context.stroke();

      const xFor = (fraction: number) => fraction * (width - 32) + 16;

      // The waiting thumper on this leg, until it's been picked up.
      if (stepInLegRef.current < conf.thumperAt && phaseRef.current !== "done") {
        const tx = xFor(conf.thumperAt / conf.steps);
        const ty = crest(tx);
        const pulse = reducedMotion ? 0.5 : 0.35 + Math.abs(Math.sin(time * 0.004)) * 0.4;
        context.strokeStyle = accentAlpha(pulse);
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(tx, ty);
        context.lineTo(tx, ty - 12);
        context.stroke();
        context.beginPath();
        context.arc(tx, ty - 13, 2.4, 0, Math.PI * 2);
        context.fillStyle = accentAlpha(pulse);
        context.fill();
      }

      // A freshly planted thumper: expanding rings drawing the maker away.
      if (plantAtRef.current > 0 && time - plantAtRef.current < 1600) {
        const px = xFor(plantXRef.current);
        const py = crest(px);
        const t = (time - plantAtRef.current) / 1600;
        for (let r = 0; r < 3; r += 1) {
          const radius = (t * 30 + r * 8) % 38;
          context.beginPath();
          context.arc(px, py, radius, 0, Math.PI * 2);
          context.strokeStyle = accentAlpha(0.3 * (1 - t));
          context.lineWidth = 1;
          context.stroke();
        }
      }

      // Footprints already laid on this leg, alternating feet.
      for (const print of footprintsRef.current) {
        const px = xFor(print.x);
        context.beginPath();
        context.ellipse(px, crest(px) + 5 + print.side * 2, 2.2, 1.3, 0, 0, Math.PI * 2);
        context.fillStyle = accentAlpha(0.3);
        context.fill();
      }

      // The walker, hopping slightly on each fresh step.
      const progress = Math.min(1, stepInLegRef.current / conf.steps);
      const sinceBob = time - bobAtRef.current;
      const hop =
        !reducedMotion && sinceBob < 220 ? Math.sin((sinceBob / 220) * Math.PI) * 4 : 0;
      const wx = xFor(progress);
      const wy = crest(wx) - hop;
      context.beginPath();
      context.arc(wx, wy - 9, 3, 0, Math.PI * 2);
      context.fillStyle = accentAlpha(0.95);
      context.fill();
      context.fillRect(wx - 1, wy - 7, 2, 8);
      const stride = footprintsRef.current.length % 2 === 0 ? 1 : -1;
      context.beginPath();
      context.moveTo(wx, wy + 1);
      context.lineTo(wx - 3 * stride, wy + 6);
      context.moveTo(wx, wy + 1);
      context.lineTo(wx + 3 * stride, wy + 6);
      context.strokeStyle = accentAlpha(0.95);
      context.stroke();

      // Tremor lines: the sand shivers harder the more the maker has heard.
      if (liveAlert > 0.02) {
        for (let r = 0; r < 3; r += 1) {
          const y = height * (0.82 + r * 0.05);
          context.beginPath();
          for (let x = 0; x <= width; x += 8) {
            const wobble = reducedMotion
              ? 0
              : Math.sin(x * 0.05 + time * 0.008 + r) * liveAlert * 4;
            if (x === 0) context.moveTo(x, y + wobble);
            else context.lineTo(x, y + wobble);
          }
          context.strokeStyle = accentAlpha(0.12 + liveAlert * 0.4);
          context.stroke();
        }
      }

      if (erupting && !reducedMotion && eruptT < 1) context.restore();

      // A brief banner as each new leg opens.
      if (bannerAtRef.current > 0 && time - bannerAtRef.current < 1400) {
        const fade = 1 - (time - bannerAtRef.current) / 1400;
        context.fillStyle = accentAlpha(0.75 * fade);
        context.font = "12px monospace";
        context.textAlign = "center";
        context.fillText(
          `LEG ${legRef.current + 1} OF ${LEGS.length} — LONGER, AND IT LISTENS CLOSER`,
          width / 2,
          height * 0.2
        );
        context.textAlign = "start";
      }
    };

    if (reducedMotion) {
      draw(performance.now());
      return () => window.removeEventListener("resize", resize);
    }
    let frame = 0;
    const loop = (time: number) => {
      if (!document.hidden) draw(time);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
    // The still frame must repaint when the discrete game state advances.
  }, [reducedMotion, phase, totalSteps, alert, leg, charges]);

  const status = useMemo(() => {
    if (phase === "failed")
      return `The sand opens — the maker found your heartbeat. Score ${score}.`;
    if (phase === "done")
      return `Across all ${LEGS.length} legs of open sand. Score ${score}.`;
    if (phase === "paused") return "Paused. The sand waits.";
    if (totalSteps === 0)
      return "Tap step with uneven gaps — two even steps in a row and the maker hears.";
    return `Leg ${leg + 1}: step ${stepInLeg} of ${LEGS[leg].steps}. Maker ${makerWord(alert)}.`;
  }, [phase, score, totalSteps, leg, stepInLeg, alert]);

  return (
    <div
      data-sim-state={phase}
      data-steps={totalSteps}
      data-leg={leg + 1}
      data-charges={charges}
      data-score={score}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          Leg {leg + 1}/{LEGS.length} · Streak {streak} · Score {score}
        </span>
        <span className="flex items-center gap-3">
          <span>
            Thumpers {charges}/{MAX_CHARGES}
          </span>
          <button
            type="button"
            onClick={togglePause}
            disabled={over}
            aria-label={phase === "paused" ? "Resume the crossing" : "Pause the crossing"}
            className="border border-accent/30 px-2 py-0.5 hover:bg-accent/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {phase === "paused" ? "resume" : "pause"}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="border border-accent/30 px-2 py-0.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {muted ? "muted" : "sound"}
          </button>
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-64"
        />
        {phase === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 text-[11px] uppercase tracking-[0.2em] text-white/70">
            The sand waits
          </div>
        )}
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/85">
                {phase === "done"
                  ? "Across. No rhythm heard."
                  : "The maker found your heartbeat."}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                Score {score} · {totalSteps} steps
              </p>
              <button
                ref={restartButtonRef}
                type="button"
                onClick={restart}
                className="border border-accent/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cross again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
        <span className="shrink-0">Maker · {makerWord(alert)}</span>
        <div className="relative h-1.5 w-full bg-white/10" aria-hidden>
          <div
            className="h-full bg-accent/80 transition-[width] duration-150"
            style={{ width: `${(alert * 100).toFixed(1)}%` }}
          />
          {[25, 50, 75].map((tick) => (
            <span
              key={tick}
              className="absolute top-0 h-full w-px bg-white/25"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>
      </div>

      {!over && (
        <div className="flex items-stretch gap-2">
          <button
            ref={stepButtonRef}
            type="button"
            onClick={step}
            disabled={phase === "paused"}
            className="h-14 flex-1 touch-none select-none border border-accent/40 text-[12px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Step
          </button>
          <button
            type="button"
            onClick={plantThumper}
            disabled={phase === "paused" || charges === 0}
            className="w-32 touch-none select-none border border-accent/30 px-2 text-[10px] uppercase tracking-[0.14em] hover:bg-accent/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-40"
          >
            Plant thumper
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
          {status}
        </p>
        {!over && (
          <p className="hidden text-right text-[10px] uppercase tracking-[0.12em] text-white/35 sm:block">
            A thumper buys {SAFE_STEPS} steady steps
          </p>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function DuneSandwalk({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="dune-sandwalk-title"
      gameId="dune-sandwalk"
      eyebrow="Desert crossing"
      title="Walk without rhythm"
      startLabel="Cross the dune"
      stage
      howToPlay={{
        objective:
          "Cross three legs of open sand without ever taking two evenly spaced steps in a row.",
        controls: [
          { keys: "step", does: "take one step — change the gap between taps every time" },
          {
            keys: "plant thumper",
            does: "spend a charge for three steps the maker ignores",
          },
          { keys: "pause", does: "hold the crossing still; the sand waits" },
          {
            keys: "Space",
            does: "presses whichever control has focus — step starts focused",
          },
        ],
        tip: "Two steps at nearly the same interval spike the maker; an uneven one cools it and builds a scoring streak. Standing still also settles the sand.",
      }}
      reference={{
        quote: "You must walk without rhythm.",
        scene: "Dune (2021) · the sandwalk, broken steps so the worm doesn't hear a heartbeat",
      }}
      onClose={onClose}
    >
      <Sandwalk />
    </SimulationShell>
  );
}
