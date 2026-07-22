"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FuryRoadMuteButton,
  FuryRoadPips,
  FuryRoadPlanBanner,
  FuryRoadStat,
  useFreshPress,
  type FuryRoadHalfProps,
} from "@/components/film-experience/simulations/FuryRoadShared";
import {
  GRIP_MAX,
  LEAP_BASE,
  VEHICLES,
  WITNESS_CALLS,
  WITNESS_SCORE_ID,
  leapScore,
  witnessRating,
  witnessRunScore,
  type CallOption,
} from "@/components/film-experience/simulations/FuryRoadWitnessConvoy";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";

/**
 * The reduced-motion leap: the same convoy, crossed as a called jump.
 *
 * Nothing moves and nothing is on a clock. Each vehicle is three beats — chrome
 * the face, then read the gap twice — and every option states what it buys
 * before it is taken. The chrome call multiplies the two leaps that follow,
 * exactly as the held can does in the live run; grip absorbs two bad calls
 * before the run ends; the streak and the score formula are the same.
 *
 * The convoy diagram beside it is a still, repainted on a beat change only.
 */

type Phase = "calling" | "fallen" | "witnessed";

/** Deterministic per-beat rotation so the best call is not always first. */
function rotate(options: readonly CallOption[], by: number) {
  const offset = ((by % options.length) + options.length) % options.length;
  return options.map((_, index) => options[(index + offset) % options.length]);
}

export default function FuryRoadWitnessCall({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [grip, setGrip] = useState(GRIP_MAX);
  const [chrome, setChrome] = useState(1);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [banked, setBanked] = useState(0);
  const [phase, setPhase] = useState<Phase>("calling");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [lastEarned, setLastEarned] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);
  const { freshPress, rootProps } = useFreshPress(phase);

  const beats = WITNESS_CALLS[vehicleIndex];
  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  const options = useMemo(
    () => rotate(beat.options, beatIndex + vehicleIndex),
    [beat, beatIndex, vehicleIndex]
  );

  // The convoy plan, as a still: one box per vehicle, the gap between the one
  // you are on and the one you are jumping to marked as the target.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const paint = () => {
      const width = (canvas.width = canvas.offsetWidth);
      const height = (canvas.height = canvas.offsetHeight);
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      const count = VEHICLES.length;
      const slot = width / count;
      const bodyH = height * 0.4;
      const roadY = height * 0.72;

      for (let index = 0; index < count; index += 1) {
        const from = index * slot + 8;
        const to = (index + 1) * slot - 8;
        const crossed = index < vehicleIndex;
        const current = index === vehicleIndex;
        context.fillStyle = accentAlpha(crossed ? 0.42 : current ? 0.24 : 0.1);
        context.fillRect(from, roadY - bodyH, to - from, bodyH);
        context.strokeStyle = current ? palette.bright : accentAlpha(crossed ? 0.7 : 0.3);
        context.lineWidth = current ? 2 : 1;
        context.strokeRect(from, roadY - bodyH, to - from, bodyH);
        context.fillStyle = accentAlpha(crossed ? 0.8 : 0.4);
        context.fillRect(from + 5, roadY, 9, 5);
        context.fillRect(to - 14, roadY, 9, 5);
      }

      // The road line, and the boy standing on the vehicle he is leaving.
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, roadY + 7);
      context.lineTo(width, roadY + 7);
      context.stroke();

      const standX = vehicleIndex * slot + slot / 2;
      const headY = roadY - bodyH - 14;
      context.strokeStyle = palette.bright;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(standX, headY, 4, 0, Math.PI * 2);
      context.moveTo(standX, headY + 4);
      context.lineTo(standX, headY + 14);
      context.moveTo(standX - 6, headY + 6);
      context.lineTo(standX, headY + 8);
      context.lineTo(standX + 6, headY + 6);
      context.stroke();

      // The gap being called, when there is one ahead.
      if (vehicleIndex + 1 < count) {
        const gapX = (vehicleIndex + 1) * slot;
        context.strokeStyle = palette.bright;
        context.lineWidth = 1.5;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(gapX, roadY - bodyH - 20);
        context.lineTo(gapX, roadY + 10);
        context.stroke();
        context.setLineDash([]);
      }
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [vehicleIndex, beatIndex]);

  const reset = useCallback(() => {
    setVehicleIndex(0);
    setBeatIndex(0);
    setGrip(GRIP_MAX);
    setChrome(1);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setBanked(0);
    setPhase("calling");
    setOutcome(null);
    setLastEarned(0);
    window.requestAnimationFrame(() => cueRef.current?.focus());
  }, []);

  const finish = useCallback(
    (won: boolean, total: number, crossed: number) => {
      const score = witnessRunScore(total, crossed);
      setBanked(score);
      recordSimulationScore(WITNESS_SCORE_ID, score);
      setPhase(won ? "witnessed" : "fallen");
      if (won) audio.fanfare();
      else audio.fail();
    },
    [audio]
  );

  const call = useCallback(
    (option: CallOption) => {
      if (phase !== "calling") return;
      audio.unlock();

      const nextGrip = grip - option.grip;
      setOutcome(option.outcome);

      if (beat.kind === "chrome") {
        // The coat multiplies the two leaps that follow, and nothing else.
        setChrome(option.factor);
        setLastEarned(0);
        if (option.grip > 0) audio.impact();
        else audio.spray();
        setGrip(Math.max(0, nextGrip));
        if (nextGrip < 0) {
          finish(false, points, vehicleIndex);
          return;
        }
        setBeatIndex(beatIndex + 1);
        return;
      }

      // A leap. `factor` is the accuracy of the call; grip pays for a bad one.
      const earned = leapScore(option.factor, chrome, streak);
      const nextPoints = points + earned;
      const nextStreak = option.grip > 0 ? 0 : streak + 1;
      setPoints(nextPoints);
      setLastEarned(earned);
      setStreak(nextStreak);
      setBestStreak((best) => Math.max(best, nextStreak));
      setGrip(Math.max(0, nextGrip));
      if (option.grip > 0) {
        audio.impact();
        audio.warn();
      } else {
        audio.catchCue();
      }

      if (nextGrip < 0) {
        finish(false, nextPoints, vehicleIndex);
        return;
      }
      if (beatIndex + 1 < beats.length) {
        setBeatIndex(beatIndex + 1);
        return;
      }
      // The vehicle is crossed.
      if (vehicleIndex + 1 < WITNESS_CALLS.length) {
        setVehicleIndex(vehicleIndex + 1);
        setBeatIndex(0);
        setChrome(1);
        audio.fanfare();
        return;
      }
      finish(true, nextPoints, WITNESS_CALLS.length);
    },
    [
      phase,
      audio,
      grip,
      beat.kind,
      points,
      vehicleIndex,
      beatIndex,
      beats.length,
      chrome,
      streak,
      finish,
    ]
  );

  const crossed = phase === "witnessed" ? VEHICLES.length : vehicleIndex;
  const rating = witnessRating(crossed, bestStreak);
  const status =
    phase === "witnessed"
      ? `The whole convoy, crossed. ${rating.grade} — ${rating.note} ${banked} points banked.`
      : phase === "fallen"
        ? `Under the wheels. ${rating.grade} — ${rating.note} ${banked} points banked.`
        : `${VEHICLES[vehicleIndex].label}, beat ${beatIndex + 1} of ${beats.length}. Read the conditions, make the call.`;

  return (
    <div
      data-sim-state={phase}
      data-witness-mode="call"
      data-witness-vehicle={vehicleIndex + 1}
      data-witness-beat={beatIndex + 1}
      data-witness-kind={beat.kind}
      data-witness-grip={grip}
      data-witness-streak={streak}
      data-witness-points={points}
      data-witness-score={banked}
      className="flex flex-col gap-3"
      {...rootProps}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="vehicle" value={`${vehicleIndex + 1}/${VEHICLES.length}`} width="w-8" />
        <FuryRoadStat label="streak" value={streak} width="w-6" />
        <FuryRoadStat label="points" value={points} width="w-12" />
        <FuryRoadPips label="grip" value={grip} max={GRIP_MAX} />
        <span className="ml-auto">
          <FuryRoadMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      <FuryRoadPlanBanner>
        Called jump · no clock, no motion — chrome, then read the gap
      </FuryRoadPlanBanner>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-24 w-full border border-accent/25 bg-ink/60 sm:h-32"
      />
      <p className="sr-only">
        Convoy plan: on {VEHICLES[Math.min(vehicleIndex, VEHICLES.length - 1)].label}, vehicle{" "}
        {vehicleIndex + 1} of {VEHICLES.length}.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
        <span>
          coat <span className="text-accent">×{chrome}</span>
        </span>
        <span>
          leap value{" "}
          <span className="text-accent">
            {Math.round(LEAP_BASE * chrome * (1 + streak * 0.15))}
          </span>
        </span>
        {lastEarned > 0 && <span className="text-accent-bright">last leap +{lastEarned}</span>}
      </div>

      {outcome && (
        <p className="border-l-2 border-accent/40 pl-2 text-[11px] leading-relaxed text-white/60">
          {outcome}
        </p>
      )}

      {phase === "calling" ? (
        <>
          <p
            ref={cueRef}
            tabIndex={-1}
            className="text-sm normal-case leading-relaxed text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {beat.cue}
          </p>
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => call(option)}
                className="border border-accent/30 px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            {phase === "witnessed" ? "Historic" : "Run over"} · {rating.grade}
          </p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Vehicles crossed — {crossed}</li>
            <li>Best streak — {bestStreak}</li>
            <li>Leap points — {points}</li>
            <li className="text-accent">Banked {banked} points</li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-[11px] normal-case tracking-normal text-white/60">
          {status}
        </p>
        {phase !== "calling" && (
          <button
            type="button"
            onClick={() => {
              if (freshPress()) reset();
            }}
            className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Chrome up again
          </button>
        )}
      </div>
    </div>
  );
}
