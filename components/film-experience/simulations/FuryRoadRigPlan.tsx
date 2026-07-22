"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FuryRoadMeter,
  FuryRoadMuteButton,
  FuryRoadPips,
  FuryRoadPlanBanner,
  FuryRoadStat,
  useFreshPress,
  type FuryRoadHalfProps,
} from "@/components/film-experience/simulations/FuryRoadShared";
import {
  LANES,
  NEAR_MISS_POINTS,
  PLAN_BOOST_BONUS,
  PLAN_FUEL_BOOST,
  PLAN_FUEL_CANISTER,
  PLAN_FUEL_MAX,
  PLAN_FUEL_PER_BEAT,
  PLAN_HULL_MAX,
  RIG_SCORE_ID,
  RIG_SCRIPT,
  rigRunScore,
  type Lane,
} from "@/components/film-experience/simulations/FuryRoadRigRoad";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";

/**
 * The reduced-motion chase: the same road, run as a convoy plan.
 *
 * Nothing moves and nothing is on a clock. The spotter calls the road one beat
 * ahead, and the driver picks the lane to be in when it arrives — with the same
 * boost trade (more road for more guzzoline), the same hull that absorbs three
 * rams before the rig goes down, the same canisters, the same squeak bonus for
 * running the lane next to a blocked one, and the same score formula. It is the
 * chase with the clock taken out, not a diagram of one.
 *
 * The road diagram beside it is a still: repainted when the beat changes or the
 * viewport resizes, never on an animation frame.
 */

const LANE_LABEL: Record<Lane, string> = { left: "left", center: "centre", right: "right" };

type Phase = "planning" | "wrecked" | "cleared";

export default function FuryRoadRigPlan({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [waveIndex, setWaveIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [lane, setLane] = useState<Lane>("center");
  const [fuel, setFuel] = useState(PLAN_FUEL_MAX);
  const [hull, setHull] = useState(PLAN_HULL_MAX);
  const [meters, setMeters] = useState(0);
  const [squeaks, setSqueaks] = useState(0);
  const [boostArmed, setBoostArmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("planning");
  const [banked, setBanked] = useState(0);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<"rammed" | "dry" | "home">("rammed");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callRef = useRef<HTMLParagraphElement>(null);
  const { freshPress, rootProps } = useFreshPress(phase);

  const beats = RIG_SCRIPT[waveIndex];
  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  // Memoized so the still-canvas effect repaints on a beat change, not on every
  // unrelated re-render.
  const blocked = useMemo(() => new Set(beat.blocked), [beat]);

  // The road ahead, as a still. There is no animation loop in this mode at all.
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

      const laneWidth = width / LANES.length;

      LANES.forEach((name, index) => {
        const x = index * laneWidth;
        const isBlocked = blocked.has(name);
        const hasCan = beat.canister === name;

        if (isBlocked) {
          // Hatching, not just a tint: the blocked lane reads without color.
          context.fillStyle = accentAlpha(0.14);
          context.fillRect(x + 2, 4, laneWidth - 4, height - 8);
          context.strokeStyle = accentAlpha(0.6);
          context.lineWidth = 1;
          context.beginPath();
          for (let offset = -height; offset < laneWidth; offset += 9) {
            context.moveTo(x + offset, height - 4);
            context.lineTo(x + offset + height, 4);
          }
          context.save();
          context.beginPath();
          context.rect(x + 2, 4, laneWidth - 4, height - 8);
          context.clip();
          context.stroke();
          context.restore();
        }

        context.strokeStyle = accentAlpha(isBlocked ? 0.7 : 0.3);
        context.lineWidth = isBlocked ? 2 : 1;
        context.strokeRect(x + 2, 4, laneWidth - 4, height - 8);

        if (hasCan) {
          // A canister: a bright outline with a fill bar, matching the chase.
          const cx = x + laneWidth / 2;
          const cy = height * 0.3;
          context.strokeStyle = palette.bright;
          context.lineWidth = 2;
          context.strokeRect(cx - 7, cy - 9, 14, 18);
          context.fillStyle = accentAlpha(0.6);
          context.fillRect(cx - 4, cy + 3, 8, 3);
        }

        if (name === lane) {
          // The rig, drawn where it currently sits.
          const cx = x + laneWidth / 2;
          const cy = height * 0.74;
          context.fillStyle = palette.bright;
          context.fillRect(cx - 9, cy - 16, 18, 32);
          context.fillStyle = palette.inkSoft;
          context.fillRect(cx - 6, cy - 12, 12, 7);
          context.fillStyle = accentAlpha(0.9);
          for (const wy of [-11, -1, 9]) {
            context.fillRect(cx - 12, cy + wy, 3, 7);
            context.fillRect(cx + 9, cy + wy, 3, 7);
          }
        }
      });
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [beat, lane, blocked]);

  const reset = useCallback(() => {
    setWaveIndex(0);
    setBeatIndex(0);
    setLane("center");
    setFuel(PLAN_FUEL_MAX);
    setHull(PLAN_HULL_MAX);
    setMeters(0);
    setSqueaks(0);
    setBoostArmed(false);
    setPhase("planning");
    setBanked(0);
    setOutcome(null);
    window.requestAnimationFrame(() => callRef.current?.focus());
  }, []);

  const finish = useCallback(
    (reason: "rammed" | "dry" | "home", nextMeters: number, nextSqueaks: number, wave: number) => {
      const total = rigRunScore(nextMeters, nextSqueaks, wave);
      setBanked(total);
      recordSimulationScore(RIG_SCORE_ID, total);
      setEndReason(reason);
      setPhase(reason === "home" ? "cleared" : "wrecked");
      if (reason === "home") audio.fanfare();
      else audio.fail();
    },
    [audio]
  );

  /** Resolve one beat: take `choice` as the lane the rig runs this stretch. */
  const run = useCallback(
    (choice: Lane) => {
      if (phase !== "planning") return;
      audio.unlock();

      const boosting = boostArmed;
      let nextFuel = fuel - PLAN_FUEL_PER_BEAT - (boosting ? PLAN_FUEL_BOOST : 0);
      let nextHull = hull;
      let nextSqueaks = squeaks;
      let gained = beat.meters * (boosting ? 1 + PLAN_BOOST_BONUS : 1);
      const notes: string[] = [];

      if (blocked.has(choice)) {
        nextHull -= 1;
        gained *= 0.5;
        notes.push(`Rammed in the ${LANE_LABEL[choice]} lane — one plate of hull gone.`);
        audio.impact();
      } else {
        // The squeak: running clean in a lane that touches a blocked one.
        const index = LANES.indexOf(choice);
        const brushing = [index - 1, index + 1].some(
          (side) => side >= 0 && side < LANES.length && blocked.has(LANES[side])
        );
        if (brushing) {
          nextSqueaks += 1;
          notes.push(`Squeaked past on the ${LANE_LABEL[choice]} shoulder — +${NEAR_MISS_POINTS}.`);
          audio.nearMiss();
        } else {
          notes.push(`Clean through on the ${LANE_LABEL[choice]}.`);
          audio.tick(beatIndex);
        }
      }

      if (beat.canister === choice) {
        nextFuel = Math.min(PLAN_FUEL_MAX, nextFuel + PLAN_FUEL_CANISTER);
        notes.push(`Canister grabbed — +${PLAN_FUEL_CANISTER} guzzoline.`);
        audio.catchCue();
      }
      if (boosting) notes.push("Boost burned for the extra road.");

      const nextMeters = meters + gained;
      setLane(choice);
      setBoostArmed(false);
      setFuel(Math.max(0, nextFuel));
      setHull(Math.max(0, nextHull));
      setMeters(nextMeters);
      setSqueaks(nextSqueaks);
      setOutcome(notes.join(" "));

      if (nextHull <= 0) {
        finish("rammed", nextMeters, nextSqueaks, waveIndex + 1);
        return;
      }
      if (nextFuel <= 0) {
        finish("dry", nextMeters, nextSqueaks, waveIndex + 1);
        return;
      }
      if (beatIndex + 1 < beats.length) {
        setBeatIndex(beatIndex + 1);
        return;
      }
      if (waveIndex + 1 < RIG_SCRIPT.length) {
        setWaveIndex(waveIndex + 1);
        setBeatIndex(0);
        audio.fanfare();
        return;
      }
      finish("home", nextMeters, nextSqueaks, RIG_SCRIPT.length);
    },
    [
      phase,
      audio,
      boostArmed,
      fuel,
      hull,
      squeaks,
      beat,
      blocked,
      meters,
      beatIndex,
      beats.length,
      waveIndex,
      finish,
    ]
  );

  const wave = waveIndex + 1;
  const roundedMeters = Math.round(meters);
  const status =
    phase === "cleared"
      ? `The convoy is home. ${roundedMeters} m, ${squeaks} squeaks, ${banked} points banked.`
      : phase === "wrecked"
        ? endReason === "dry"
          ? `Out of guzzoline at ${roundedMeters} m. ${banked} points banked.`
          : `The rig went down at ${roundedMeters} m. ${banked} points banked.`
        : `Wave ${wave} of ${RIG_SCRIPT.length}, beat ${beatIndex + 1} of ${beats.length}. Read the call, pick the lane.`;

  return (
    <div
      data-sim-state={phase}
      data-rig-mode="plan"
      data-rig-wave={wave}
      data-rig-beat={beatIndex + 1}
      data-rig-lane={lane}
      data-rig-blocked={beat.blocked.join(",")}
      data-rig-hull={hull}
      data-rig-fuel={Math.round(fuel)}
      data-rig-distance={roundedMeters}
      data-rig-squeaks={squeaks}
      data-rig-score={banked}
      className="flex flex-col gap-3"
      {...rootProps}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="road" value={`${roundedMeters} m`} width="w-14" />
        <FuryRoadStat label="wave" value={`${wave}/${RIG_SCRIPT.length}`} width="w-8" />
        <FuryRoadStat label="squeaks" value={squeaks} width="w-6" />
        <FuryRoadPips label="hull" value={hull} max={PLAN_HULL_MAX} />
        <span className="ml-auto">
          <FuryRoadMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      <FuryRoadPlanBanner>
        Convoy plan · no clock, no motion — call the lane one beat at a time
      </FuryRoadPlanBanner>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-28 w-full border border-accent/25 bg-ink/60 sm:h-40"
      />
      <p className="sr-only">
        Road ahead: {beat.blocked.length === 0 ? "all three lanes open" : `${beat.blocked.map((name) => LANE_LABEL[name]).join(" and ")} blocked`}
        {beat.canister ? `, canister in the ${LANE_LABEL[beat.canister]} lane` : ""}. The rig is in the{" "}
        {LANE_LABEL[lane]} lane.
      </p>

      <div className="flex items-center gap-3">
        <FuryRoadMeter
          label="Guzzoline"
          value={fuel / PLAN_FUEL_MAX}
          note={fuel <= 25 ? "running dry" : "steady"}
          danger={fuel <= 25}
          reducedMotion
        />
        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-accent">
          {Math.round(fuel)}
        </span>
      </div>

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
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
            {LANES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => run(name)}
                aria-label={`Take the ${LANE_LABEL[name]} lane${blocked.has(name) ? " — blocked" : ""}${
                  beat.canister === name ? " — canister here" : ""
                }`}
                className="flex-1 border border-accent/30 px-3 py-2 text-left hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {LANE_LABEL[name]}
                {blocked.has(name) && <span className="ml-2 text-accent-bright">blocked</span>}
                {beat.canister === name && <span className="ml-2 text-accent">fuel</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              audio.unlock();
              setBoostArmed((armed) => !armed);
            }}
            aria-pressed={boostArmed}
            disabled={fuel <= PLAN_FUEL_PER_BEAT + PLAN_FUEL_BOOST}
            className="self-start border border-accent/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            {boostArmed ? "boost armed · more road, more burn" : "burn boost this beat"}
          </button>
        </>
      ) : (
        <div className="border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            {phase === "cleared" ? "Home" : endReason === "dry" ? "Dry tank" : "Rig down"}
          </p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Road held — {roundedMeters} m</li>
            <li>
              Squeaks — {squeaks} (+{squeaks * NEAR_MISS_POINTS})
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
            Roll out again
          </button>
        )}
      </div>
    </div>
  );
}
