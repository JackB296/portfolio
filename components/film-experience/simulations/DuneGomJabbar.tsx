"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { createDuneSynth, type DuneSynth } from "./DuneAudio";

// The gom jabbar: your hand is in the box, the pain climbs, and the needle
// waits at your neck. Pull the hand out early and the needle takes you. The
// test comes in three trials, each longer, with surges of deeper pain — and
// the one counterweight is your breath: exhale on the ring's out-breath and
// the pain slows; gasp on the in-breath and it spikes.
const SCORE_ID = "dune-gom-jabbar";
/** A window of deeper pain within a trial, in ms from the trial's start. */
type SurgeWindow = Readonly<{ from: number; to: number }>;
const TRIALS = [
  { name: "The first pain", endureMs: 3200, surges: [] as ReadonlyArray<SurgeWindow> },
  { name: "Deeper", endureMs: 5200, surges: [{ from: 1800, to: 2800 }] as ReadonlyArray<SurgeWindow> },
  {
    name: "The crest",
    endureMs: 7200,
    surges: [
      { from: 1600, to: 2600 },
      { from: 4300, to: 5400 },
    ] as ReadonlyArray<SurgeWindow>,
  },
] as const;
const BREATH_PERIOD_MS = 2000;
const SURGE_RATE = 1.8;
const CALM_RATE = 0.55;
const CALM_MS = 1500;
const BAD_EXHALE_SPIKE_MS = 250;
const EXHALE_LOCK_MS = 900;
const TRIAL_SCORE = 100;
const EXHALE_SCORE = 10;

type Phase = "ready" | "holding" | "between" | "failed" | "done";

/**
 * The test itself. Mounted by the shell only after the visitor starts, so the
 * box is open from mount: press and hold the control to keep the hand inside,
 * and the pain clock arms on the first press, not while the card is still up.
 */
function GomJabbar() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [trial, setTrial] = useState(0);
  const [pain, setPain] = useState(0);
  const [exhales, setExhales] = useState(0);
  const [surging, setSurging] = useState(false);
  const [calm, setCalm] = useState(false);
  const [breathOut, setBreathOut] = useState(false);
  const [muted, setMuted] = useState(false);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  // The pain clock runs on its own rAF while the hand is in the box; refs keep
  // it off the React path until something the player sees changes.
  const phaseRef = useRef<Phase>("ready");
  const trialRef = useRef(0);
  const holdingRef = useRef(false);
  const holdStartRef = useRef(0);
  const lastTickRef = useRef(0);
  const accumulatedRef = useRef(0);
  const painRef = useRef(0);
  const calmUntilRef = useRef(0);
  const exhaleLockRef = useRef(0);
  const exhalesRef = useRef(0);
  const trialsPassedRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const failAtRef = useRef(0);
  const spikeAtRef = useRef(0);
  const synthRef = useRef<DuneSynth | null>(null);
  const mutedRef = useRef(false);

  const synth = useCallback(() => {
    if (!synthRef.current) synthRef.current = createDuneSynth(mutedRef.current);
    return synthRef.current;
  }, []);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => holdButtonRef.current?.focus());
    const frames = frameRef;
    const synths = synthRef;
    return () => {
      window.cancelAnimationFrame(frames.current);
      synths.current?.dispose();
    };
  }, []);

  const score = useCallback(
    () => trialsPassedRef.current * TRIAL_SCORE + exhalesRef.current * EXHALE_SCORE,
    []
  );

  const endHold = useCallback(
    (reachedCrest: boolean) => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      pointerIdRef.current = null;
      window.cancelAnimationFrame(frameRef.current);
      synthRef.current?.stopDrone();
      setSurging(false);
      setCalm(false);
      if (reachedCrest) {
        trialsPassedRef.current += 1;
        if (trialRef.current >= TRIALS.length - 1) {
          setPhaseSafe("done");
          recordSimulationScore(SCORE_ID, score() + TRIAL_SCORE);
          synth().tone(320, 220, { gain: 0.05 });
          synth().tone(480, 320, { gain: 0.05, glide: 640 });
        } else {
          setPhaseSafe("between");
          synth().tone(260, 240, { gain: 0.045, glide: 390 });
          window.requestAnimationFrame(() => continueButtonRef.current?.focus());
        }
      } else {
        // The hand came out early: the needle answers.
        failAtRef.current = performance.now();
        setPhaseSafe("failed");
        recordSimulationScore(SCORE_ID, score());
        synth().tone(900, 500, { type: "sawtooth", gain: 0.045, glide: 70 });
      }
    },
    [score, setPhaseSafe, synth]
  );

  const tick = useCallback(() => {
    if (!holdingRef.current) return;
    const now = performance.now();
    // Full wall-clock dt: the pain tracks real time even if frames run slow.
    // (Losing the window entirely releases the hold via the blur listener.)
    const dt = Math.max(0, now - lastTickRef.current);
    lastTickRef.current = now;

    const conf = TRIALS[trialRef.current];
    const elapsed = now - holdStartRef.current;
    const inSurge = conf.surges.some(({ from, to }) => elapsed >= from && elapsed < to);
    const inCalm = now < calmUntilRef.current;
    let rate = inSurge ? SURGE_RATE : 1;
    if (inCalm) rate *= CALM_RATE;
    accumulatedRef.current += dt * rate;

    const level = Math.min(1, accumulatedRef.current / conf.endureMs);
    painRef.current = level;
    setPain(level);
    setSurging(inSurge);
    setCalm(inCalm);
    setBreathOut(((elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS) >= 0.5);
    synthRef.current?.drone(50 + level * 110, 0.02 + level * 0.02);

    if (level >= 1) {
      endHold(true);
      return;
    }
    frameRef.current = window.requestAnimationFrame(tick);
  }, [endHold]);

  const beginHold = useCallback(() => {
    if (phaseRef.current === "holding") return;
    if (phaseRef.current === "between" || phaseRef.current === "done") return;
    accumulatedRef.current = 0;
    painRef.current = 0;
    calmUntilRef.current = 0;
    exhaleLockRef.current = 0;
    setPain(0);
    holdingRef.current = true;
    holdStartRef.current = performance.now();
    lastTickRef.current = holdStartRef.current;
    setPhaseSafe("holding");
    synth().drone(50, 0.02);
    frameRef.current = window.requestAnimationFrame(tick);
  }, [setPhaseSafe, synth, tick]);

  // A timed breath: on the ring's out-breath it slows the pain; on the
  // in-breath it spikes it. Keyboard: E. Touch: a second finger on the pad.
  const exhale = useCallback(() => {
    if (!holdingRef.current) return;
    const now = performance.now();
    if (now < exhaleLockRef.current) return;
    exhaleLockRef.current = now + EXHALE_LOCK_MS;
    const elapsed = now - holdStartRef.current;
    const out = ((elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS) >= 0.5;
    if (out) {
      calmUntilRef.current = now + CALM_MS;
      exhalesRef.current += 1;
      setExhales(exhalesRef.current);
      synth().tone(340, 260, { type: "sine", gain: 0.035, glide: 250 });
    } else {
      accumulatedRef.current += BAD_EXHALE_SPIKE_MS;
      spikeAtRef.current = now;
      synth().tone(110, 220, { type: "sine", gain: 0.05, glide: 70 });
    }
  }, [synth]);

  // The pull-out: any release before the crest is a failure. Only the pointer
  // (or key) that began the hold can end it — a second finger is a breath.
  const release = useCallback(
    (pointerId: number | null) => {
      if (!holdingRef.current) return;
      if (pointerIdRef.current !== null && pointerId !== null && pointerId !== pointerIdRef.current)
        return;
      endHold(painRef.current >= 1);
    },
    [endHold]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      event.preventDefault();
      if (holdingRef.current) {
        exhale();
        return;
      }
      pointerIdRef.current = event.pointerId;
      beginHold();
    },
    [beginHold, exhale]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.repeat) return; // key auto-repeat is still one continuous hold
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        pointerIdRef.current = null;
        beginHold();
      }
    },
    [beginHold]
  );

  const onKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") release(null);
    },
    [release]
  );

  // While holding, "E" anywhere is the breath, and losing the window entirely
  // counts as the hand coming out.
  useEffect(() => {
    if (phase !== "holding") return;
    const onWindowKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        exhale();
      }
    };
    const onBlur = () => release(pointerIdRef.current);
    window.addEventListener("keydown", onWindowKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onWindowKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase, exhale, release]);

  const nextTrial = useCallback(() => {
    trialRef.current += 1;
    setTrial(trialRef.current);
    setPain(0);
    painRef.current = 0;
    setPhaseSafe("ready");
    window.requestAnimationFrame(() => holdButtonRef.current?.focus());
  }, [setPhaseSafe]);

  const restartAll = useCallback(() => {
    trialRef.current = 0;
    trialsPassedRef.current = 0;
    exhalesRef.current = 0;
    painRef.current = 0;
    setTrial(0);
    setExhales(0);
    setPain(0);
    setPhaseSafe("ready");
    window.requestAnimationFrame(() => holdButtonRef.current?.focus());
  }, [setPhaseSafe]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      synthRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // The box, the hand, the heat, the needle. Decorative (the meter and status
  // carry the same information): reduced motion repaints a still frame as the
  // pain advances instead of running the loop, and drops the trembling.
  const painBucket = Math.round(pain * 25);
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

    const draw = (time: number) => {
      const palette = getLiveThemePalette();
      const level = painRef.current;
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Surge flash: the whole frame's border burns while the pain surges.
      const conf = TRIALS[trialRef.current];
      const elapsed = holdingRef.current ? time - holdStartRef.current : 0;
      const inSurge =
        holdingRef.current &&
        conf.surges.some(({ from, to }) => elapsed >= from && elapsed < to);
      if (inSurge) {
        context.strokeStyle = accentAlpha(
          reducedMotion ? 0.5 : 0.3 + Math.abs(Math.sin(time * 0.02)) * 0.4
        );
        context.lineWidth = 3;
        context.strokeRect(1.5, 1.5, width - 3, height - 3);
      }

      // The box, larger now, right of center.
      const bx = width * 0.42;
      const by = height * 0.18;
      const bw = width * 0.42;
      const bh = height * 0.62;
      context.strokeStyle = accentAlpha(0.45);
      context.lineWidth = 1;
      context.strokeRect(bx, by, bw, bh);

      // Heat inside: bands that fill upward with the pain.
      const bands = 10;
      for (let i = 0; i < bands; i += 1) {
        const lit = i / bands < level;
        context.fillStyle = accentAlpha(lit ? 0.12 + (i / bands) * 0.42 : 0.04);
        const y = by + bh - ((i + 1) / bands) * bh;
        context.fillRect(bx + 3, y + 2, bw - 6, bh / bands - 3);
      }

      // The hand, entering from the right, trembling as the pain climbs. The
      // recent-spike flare from a mistimed breath jolts it further.
      const spikeAge = time - spikeAtRef.current;
      const spike = spikeAtRef.current > 0 && spikeAge < 400 ? 1 - spikeAge / 400 : 0;
      const tremble = reducedMotion ? 0 : level * 2.4 + spike * 3;
      context.save();
      context.translate(
        Math.sin(time * 0.05) * tremble,
        Math.cos(time * 0.063) * tremble
      );
      const midY = by + bh * 0.5;
      context.strokeStyle = accentAlpha(0.75);
      context.lineWidth = 1.2;
      // Forearm from outside the box to the wrist.
      context.beginPath();
      context.moveTo(width * 0.98, midY);
      context.lineTo(bx + bw * 0.72, midY);
      context.stroke();
      // Palm.
      context.beginPath();
      context.ellipse(bx + bw * 0.58, midY, bw * 0.14, bh * 0.16, 0, 0, Math.PI * 2);
      context.stroke();
      // Fingers reaching into the heat.
      for (let f = 0; f < 4; f += 1) {
        const fy = midY - bh * 0.12 + f * bh * 0.08;
        context.beginPath();
        context.moveTo(bx + bw * 0.46, fy);
        context.lineTo(bx + bw * 0.2 + (f % 2) * 6, fy);
        context.stroke();
      }
      // Thumb.
      context.beginPath();
      context.moveTo(bx + bw * 0.56, midY + bh * 0.14);
      context.lineTo(bx + bw * 0.4, midY + bh * 0.24);
      context.stroke();
      // Heat glow crawling up the fingers with the pain.
      if (level > 0.05) {
        context.fillStyle = accentAlpha(0.1 + level * 0.35);
        context.fillRect(bx + bw * 0.18, midY - bh * 0.16, bw * 0.3 * level, bh * 0.36);
      }
      context.restore();

      // The needle at the neck, left side: a profile, a throat, the point.
      const nx = width * 0.14;
      context.strokeStyle = accentAlpha(0.5);
      context.beginPath();
      context.arc(nx - 8, height * 0.3, 9, -0.4, Math.PI * 0.9);
      context.stroke();
      context.beginPath();
      context.moveTo(nx - 10, height * 0.38);
      context.lineTo(nx - 10, height * 0.62);
      context.stroke();
      const failAge = time - failAtRef.current;
      const striking = phaseRef.current === "failed" && failAge < 500;
      const drift = reducedMotion || !holdingRef.current ? 0 : Math.sin(time * 0.004) * 2;
      const needleX = striking ? nx - 6 : nx + 6 - level * 4;
      context.beginPath();
      context.moveTo(needleX + 26, height * 0.18);
      context.lineTo(needleX, height * 0.46 + drift);
      context.strokeStyle = accentAlpha(striking ? 1 : 0.45 + level * 0.5);
      context.lineWidth = striking ? 2.2 : 1.4;
      context.stroke();
      if (striking && !reducedMotion) {
        // The strike flash: radial burst at the point.
        for (let r = 0; r < 6; r += 1) {
          const angle = (r / 6) * Math.PI * 2;
          context.beginPath();
          context.moveTo(needleX, height * 0.46);
          context.lineTo(
            needleX + Math.cos(angle) * 14 * (1 - failAge / 500),
            height * 0.46 + Math.sin(angle) * 14 * (1 - failAge / 500)
          );
          context.strokeStyle = accentAlpha(0.7 * (1 - failAge / 500));
          context.lineWidth = 1;
          context.stroke();
        }
      }

      // The breath ring, bottom left: exhale as it contracts.
      const breathPhase = holdingRef.current
        ? ((elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS) * Math.PI * 2
        : 0;
      const ringR = reducedMotion ? 14 : 14 + Math.sin(breathPhase) * 6;
      const out = holdingRef.current && (elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS >= 0.5;
      context.beginPath();
      context.arc(width * 0.14, height * 0.8, Math.max(4, ringR), 0, Math.PI * 2);
      context.strokeStyle = accentAlpha(out ? 0.8 : 0.3);
      context.lineWidth = out ? 2 : 1;
      context.stroke();
      if (time < calmUntilRef.current) {
        context.beginPath();
        context.arc(width * 0.14, height * 0.8, Math.max(2, ringR - 6), 0, Math.PI * 2);
        context.strokeStyle = accentAlpha(0.35);
        context.stroke();
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
    // The still frame must repaint as the discrete pain state advances.
  }, [reducedMotion, phase, painBucket, trial, exhales]);

  const conf = TRIALS[trial];
  const status = useMemo(() => {
    if (phase === "failed") return "The hand came out. The gom jabbar found you.";
    if (phase === "done") return "You held through every trial. You are human.";
    if (phase === "between")
      return `Trial ${trial + 1} passed. The needle stays — deeper now.`;
    if (phase === "holding") {
      if (calm) return "The breath holds it back. Fear is the mind-killer.";
      if (surging) return "It surges. Hold. Fear is the mind-killer.";
      return "Hold. Fear is the mind-killer. Do not pull away.";
    }
    return `Trial ${trial + 1} of ${TRIALS.length} — ${conf.name}. Press and hold to put your hand in the box.`;
  }, [phase, trial, conf.name, calm, surging]);

  const holdLabel = phase === "failed" ? "Face it again" : "Hold your hand in the box";
  const finalScore = trialsPassedRef.current * TRIAL_SCORE + exhales * EXHALE_SCORE;

  return (
    <div
      data-sim-state={phase}
      data-trial={trial + 1}
      data-pain={Math.round(pain * 100)}
      data-exhales={exhales}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          Trial {trial + 1}/{TRIALS.length} · {conf.name} ·{" "}
          {(conf.endureMs / 1000).toFixed(1)}s
        </span>
        <span className="flex items-center gap-3">
          <span>Breaths {exhales}</span>
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
        {(phase === "between" || phase === "done") && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/85">
                {phase === "done"
                  ? "The hand withdraws. You are human."
                  : "The Reverend Mother watches. Deeper."}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                Score {finalScore}
              </p>
              {phase === "between" ? (
                <button
                  ref={continueButtonRef}
                  type="button"
                  onClick={nextTrial}
                  className="border border-accent/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Continue to trial {trial + 2}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={restartAll}
                  className="border border-accent/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Take the test again
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
        <span className="shrink-0">Pain</span>
        <div className="relative h-1.5 w-full bg-white/10" aria-hidden>
          <div className="h-full bg-accent/80" style={{ width: `${(pain * 100).toFixed(1)}%` }} />
          {[25, 50, 75].map((tick) => (
            <span
              key={tick}
              className="absolute top-0 h-full w-px bg-white/25"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
        <span>
          Breath ·{" "}
          {phase === "holding" ? (breathOut ? "exhale now" : "inhale…") : "steady"}
          {calm && " · held back"}
          {surging && " · it surges"}
        </span>
        <span className="text-white/35">E or a second finger to breathe</span>
      </div>

      <button
        ref={holdButtonRef}
        type="button"
        aria-label={holdLabel}
        onPointerDown={onPointerDown}
        onPointerUp={(event) => release(event.pointerId)}
        onPointerLeave={(event) => release(event.pointerId)}
        onPointerCancel={(event) => release(event.pointerId)}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        disabled={phase === "between" || phase === "done"}
        className="h-16 w-full touch-none select-none border border-accent/40 px-4 text-[12px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {phase === "holding" ? "Holding…" : holdLabel}
      </button>

      {phase === "failed" && trial > 0 && (
        <button
          type="button"
          onClick={restartAll}
          className="self-start border border-accent/30 px-3 py-1 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Restart from the first trial
        </button>
      )}

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function DuneGomJabbar({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="dune-gom-jabbar-title"
      gameId="dune-gom-jabbar"
      eyebrow="Human test"
      title="The gom jabbar"
      startLabel="Put your hand in the box"
      stage
      howToPlay={{
        objective:
          "Keep your hand in the box until the pain meter fills, three trials in a row.",
        controls: [
          { keys: "hold", does: "press and hold the box control to keep your hand in" },
          { keys: "Space / Enter", does: "hold the same control from the keyboard" },
          { keys: "E", does: "breathe out — only while the ring reads exhale now" },
          { keys: "2nd finger", does: "tap the pad while holding to breathe on touch" },
        ],
        tip: "A well-timed breath halves the pain rate for a moment; one taken on the in-breath adds pain instead. Releasing early — or letting the window lose focus — ends the run.",
      }}
      reference={{
        quote: "Fear is the mind-killer.",
        scene: "Dune (2021) · the box, the needle, the Reverend Mother's test",
      }}
      onClose={onClose}
    >
      <GomJabbar />
    </SimulationShell>
  );
}
