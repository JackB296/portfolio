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
  DODGE_POINTS,
  HAZARD_LABEL,
  HULL_MAX,
  LANE_NAMES,
  PLAN_GRIT_MAX,
  PLAN_SECONDS_PER_BEAT,
  STORM_LANES,
  STORM_SCORE_ID,
  STORM_SCRIPT,
  stormRating,
  stormRunScore,
} from "@/components/film-experience/simulations/FuryRoadStormFront";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";

/**
 * The reduced-motion storm: the same front, driven as a plan.
 *
 * Nothing moves and nothing is on a clock. Each beat names the hazard and the
 * lanes it is about to take, and the driver picks a lane — or braces, which
 * eats the hit on the plates at the cost of grit, exactly as the live brace
 * does. Hull absorbs three unbraced hits, dodges pay the same bonus, and the
 * run banks through the same score formula.
 *
 * The front diagram beside it is a still, repainted on a beat change only.
 */

type Phase = "planning" | "struck" | "cleared";

export default function FuryRoadStormPlan({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [waveIndex, setWaveIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [lane, setLane] = useState(2);
  const [hull, setHull] = useState(HULL_MAX);
  const [grit, setGrit] = useState(PLAN_GRIT_MAX);
  const [dodges, setDodges] = useState(0);
  const [held, setHeld] = useState(0);
  const [banked, setBanked] = useState(0);
  const [phase, setPhase] = useState<Phase>("planning");
  const [outcome, setOutcome] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callRef = useRef<HTMLParagraphElement>(null);
  const { freshPress, rootProps } = useFreshPress(phase);

  const beats = STORM_SCRIPT[waveIndex];
  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  const strike = useMemo(() => new Set(beat.strike), [beat]);

  // The front ahead, as a still: five lanes, the threatened ones hatched, the
  // rig where it currently sits.
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

      const laneWidth = width / STORM_LANES;

      for (let index = 0; index < STORM_LANES; index += 1) {
        const x = index * laneWidth;
        const hit = strike.has(index);

        if (hit) {
          // Hatching, not just a tint: a threatened lane reads without color.
          context.fillStyle = accentAlpha(0.15);
          context.fillRect(x + 2, 4, laneWidth - 4, height - 8);
          context.strokeStyle = accentAlpha(0.6);
          context.lineWidth = 1;
          context.save();
          context.beginPath();
          context.rect(x + 2, 4, laneWidth - 4, height - 8);
          context.clip();
          context.beginPath();
          for (let offset = -height; offset < laneWidth; offset += 8) {
            context.moveTo(x + offset, height - 4);
            context.lineTo(x + offset + height, 4);
          }
          context.stroke();
          context.restore();
        }

        context.strokeStyle = accentAlpha(hit ? 0.7 : 0.28);
        context.lineWidth = hit ? 2 : 1;
        context.strokeRect(x + 2, 4, laneWidth - 4, height - 8);

        if (index === lane) {
          const cx = x + laneWidth / 2;
          const cy = height * 0.72;
          context.fillStyle = palette.bright;
          context.fillRect(cx - 11, cy - 12, 22, 24);
          context.fillStyle = palette.inkSoft;
          context.fillRect(cx - 8, cy - 9, 16, 6);
        }
      }
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [strike, lane]);

  const reset = useCallback(() => {
    setWaveIndex(0);
    setBeatIndex(0);
    setLane(2);
    setHull(HULL_MAX);
    setGrit(PLAN_GRIT_MAX);
    setDodges(0);
    setHeld(0);
    setBanked(0);
    setPhase("planning");
    setOutcome(null);
    window.requestAnimationFrame(() => callRef.current?.focus());
  }, []);

  const finish = useCallback(
    (won: boolean, seconds: number, nextDodges: number, wave: number) => {
      const total = stormRunScore(seconds, nextDodges, wave);
      setBanked(total);
      recordSimulationScore(STORM_SCORE_ID, total);
      setPhase(won ? "cleared" : "struck");
      if (won) audio.fanfare();
      else audio.fail();
    },
    [audio]
  );

  /** Resolve one beat: `choice` is a lane index, or -1 to brace where you are. */
  const call = useCallback(
    (choice: number) => {
      if (phase !== "planning") return;
      audio.unlock();

      const bracing = choice < 0;
      const nextLane = bracing ? lane : choice;
      const caught = strike.has(nextLane);
      const notes: string[] = [];
      let nextHull = hull;
      let nextGrit = grit;
      let nextDodges = dodges;

      if (bracing) {
        nextGrit -= 1;
        if (caught) {
          notes.push(`Braced in the ${LANE_NAMES[nextLane]} lane — ${HAZARD_LABEL[beat.kind]} lands on the plates.`);
          audio.impact();
        } else {
          notes.push(`Braced in the ${LANE_NAMES[nextLane]} lane, and it passed by anyway. Grit spent for nothing.`);
          audio.tick(beatIndex);
        }
      } else if (caught) {
        nextHull -= 1;
        notes.push(
          `The ${HAZARD_LABEL[beat.kind]} takes the ${LANE_NAMES[nextLane]} lane, and a plate of hull with it.`
        );
        audio.impact();
        audio.warn();
      } else {
        nextDodges += 1;
        notes.push(`Clear in the ${LANE_NAMES[nextLane]} lane — +${DODGE_POINTS}.`);
        audio.nearMiss();
      }

      const nextHeld = held + PLAN_SECONDS_PER_BEAT;
      setLane(nextLane);
      setHull(Math.max(0, nextHull));
      setGrit(Math.max(0, nextGrit));
      setDodges(nextDodges);
      setHeld(nextHeld);
      setOutcome(notes.join(" "));

      if (nextHull <= 0) {
        finish(false, nextHeld, nextDodges, waveIndex + 1);
        return;
      }
      if (beatIndex + 1 < beats.length) {
        setBeatIndex(beatIndex + 1);
        return;
      }
      if (waveIndex + 1 < STORM_SCRIPT.length) {
        setWaveIndex(waveIndex + 1);
        setBeatIndex(0);
        // A wave survived gets the arms back: one point of grit returned.
        setGrit((current) => Math.min(PLAN_GRIT_MAX, current + 1));
        audio.fanfare();
        return;
      }
      finish(true, nextHeld, nextDodges, STORM_SCRIPT.length);
    },
    [
      phase,
      audio,
      lane,
      strike,
      hull,
      grit,
      dodges,
      beat.kind,
      beatIndex,
      held,
      beats.length,
      waveIndex,
      finish,
    ]
  );

  const wave = waveIndex + 1;
  const rating = stormRating(held, wave);
  const status =
    phase === "cleared"
      ? `Out the other side. ${rating.grade} — ${rating.note} ${banked} points banked.`
      : phase === "struck"
        ? `The storm took the rig. ${rating.grade} — ${rating.note} ${banked} points banked.`
        : `Wave ${wave} of ${STORM_SCRIPT.length}, beat ${beatIndex + 1} of ${beats.length}. Read the warning, take a lane.`;

  return (
    <div
      data-sim-state={phase}
      data-storm-mode="plan"
      data-storm-wave={wave}
      data-storm-beat={beatIndex + 1}
      data-storm-lane={lane}
      data-storm-strike={beat.strike.join(",")}
      data-storm-hull={hull}
      data-storm-grit={grit}
      data-storm-dodges={dodges}
      data-storm-time={held.toFixed(1)}
      data-storm-score={banked}
      className="flex flex-col gap-3"
      {...rootProps}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="held" value={`${held.toFixed(1)}s`} width="w-12" />
        <FuryRoadStat label="wave" value={`${wave}/${STORM_SCRIPT.length}`} width="w-8" />
        <FuryRoadStat label="dodges" value={dodges} width="w-6" />
        <FuryRoadPips label="hull" value={hull} max={HULL_MAX} />
        <FuryRoadPips label="grit" value={grit} max={PLAN_GRIT_MAX} />
        <span className="ml-auto">
          <FuryRoadMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      <FuryRoadPlanBanner>
        Storm plan · no clock, no motion — the front is called before it lands
      </FuryRoadPlanBanner>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-24 w-full border border-accent/25 bg-ink/60 sm:h-32"
      />
      <p className="sr-only">
        The front will take the {beat.strike.map((index) => LANE_NAMES[index]).join(" and ")} lane
        {beat.strike.length === 1 ? "" : "s"}. The rig is in the {LANE_NAMES[lane]} lane.
      </p>

      {outcome && (
        <p className="border-l-2 border-accent/40 pl-2 text-[11px] leading-relaxed text-white/60">
          {outcome}
        </p>
      )}

      {phase === "planning" ? (
        <>
          <p
            ref={callRef}
            tabIndex={-1}
            className="text-sm normal-case leading-relaxed text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {beat.call}
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.1em]">
            {LANE_NAMES.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => call(index)}
                aria-label={`Take the ${name} lane${strike.has(index) ? " — the storm lands here" : " — clear"}`}
                className="flex-1 border border-accent/30 px-2 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {name}
                {strike.has(index) && <span className="ml-1 block text-accent-bright">hit</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => call(-1)}
            disabled={grit <= 0}
            aria-label={`Brace in the ${LANE_NAMES[lane]} lane and take the hit on the plates`}
            className="self-start border border-accent/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            brace and hold this lane
          </button>
        </>
      ) : (
        <div className="border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">{rating.grade}</p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Held — {held.toFixed(1)}s</li>
            <li>
              Dodges — {dodges} (+{dodges * DODGE_POINTS})
            </li>
            <li>Wave reached — {wave}</li>
            <li className="text-accent">Banked {banked} points</li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-[11px] normal-case tracking-normal text-white/60">
          {status}
        </p>
        {phase !== "planning" && (
          <button
            type="button"
            onClick={() => {
              if (freshPress()) reset();
            }}
            className="shrink-0 border border-accent/30 px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back into it
          </button>
        )}
      </div>
    </div>
  );
}
