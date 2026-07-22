"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  PLAN_CARGOS,
  PLAN_GRIP_MAX,
  PLAN_MAX_ARC,
  PLAN_WHIP_ARC,
  POLECAT_SCORE_ID,
  cargoScore,
  planAccuracy,
  polecatRating,
  polecatRunScore,
} from "@/components/film-experience/simulations/FuryRoadPolecatRig";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";

/**
 * The reduced-motion pole: the same arc, climbed a rung at a time.
 *
 * Nothing moves and nothing is on a clock. The arc is a ladder of nine rungs
 * instead of a continuous angle, and each turn is one call — pump a rung up,
 * ride one down, reach for the crate, or let it go over the deck. The pressure
 * is identical to the live swing's: pumping costs grip, an arc pushed to the
 * ninth rung whips the pole over the pivot, and every crate hangs higher than
 * the last. The score formula is shared with the live half.
 *
 * The arc diagram beside it is a still, repainted on a change of state only.
 */

type Phase = "planning" | "fell" | "delivered";
type Move = "pump" | "ride" | "reach" | "release";

export default function FuryRoadPolecatPlan({ audio, muted, onToggleMute }: FuryRoadHalfProps) {
  const [cargoIndex, setCargoIndex] = useState(0);
  const [arc, setArc] = useState(2);
  const [grip, setGrip] = useState(PLAN_GRIP_MAX);
  const [carrying, setCarrying] = useState(false);
  const [delivered, setDelivered] = useState(0);
  const [chain, setChain] = useState(0);
  const [points, setPoints] = useState(0);
  const [banked, setBanked] = useState(0);
  const [phase, setPhase] = useState<Phase>("planning");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<"whipped" | "spent">("spent");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);
  const { freshPress, rootProps } = useFreshPress(phase);

  const cargo = PLAN_CARGOS[Math.min(cargoIndex, PLAN_CARGOS.length - 1)];
  const band = carrying ? cargo.dropAt : cargo.reachAt;

  // The arc, as a still ladder: every rung drawn, the band that matters lit,
  // and the pole sitting on the rung it is currently at.
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

      const pivotX = width / 2;
      const pivotY = height * 0.12;
      const length = height * 0.72;
      /** Rung n sits at n/PLAN_MAX_ARC of the maximum swing angle. */
      const angleFor = (rung: number) => (rung / PLAN_MAX_ARC) * 1.35;

      // Every rung as a tick on the arc, the needed band drawn heavy.
      for (let rung = 0; rung <= PLAN_MAX_ARC; rung += 1) {
        const angle = angleFor(rung);
        const lit = band.includes(rung);
        const x = pivotX + Math.sin(angle) * length;
        const y = pivotY + Math.cos(angle) * length;
        context.strokeStyle = lit ? palette.bright : accentAlpha(0.28);
        context.lineWidth = lit ? 3 : 1;
        context.beginPath();
        context.moveTo(pivotX + Math.sin(angle) * (length - 9), pivotY + Math.cos(angle) * (length - 9));
        context.lineTo(x, y);
        context.stroke();
        if (lit) {
          context.fillStyle = palette.bright;
          context.font = "9px monospace";
          context.fillText(String(rung), x + 5, y);
        }
      }

      // The pole at its current rung.
      const angle = angleFor(arc);
      const bobX = pivotX + Math.sin(angle) * length;
      const bobY = pivotY + Math.cos(angle) * length;
      context.strokeStyle = accentAlpha(0.8);
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(pivotX, pivotY);
      context.lineTo(bobX, bobY);
      context.stroke();
      context.fillStyle = palette.bright;
      context.beginPath();
      context.arc(bobX, bobY, 6, 0, Math.PI * 2);
      context.fill();
      if (carrying) {
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.strokeRect(bobX - 8, bobY + 8, 16, 16);
      }

      // The truck the pole is bolted to, and the deck on the far side.
      context.fillStyle = accentAlpha(0.55);
      context.fillRect(pivotX - 28, pivotY - 13, 56, 13);
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      context.strokeRect(pivotX - 28, pivotY - 13, 56, 13);
      const deckAngle = -angleFor(cargo.dropAt[0]);
      const deckX = pivotX + Math.sin(deckAngle) * length;
      const deckY = pivotY + Math.cos(deckAngle) * length;
      context.strokeStyle = accentAlpha(0.5);
      context.lineWidth = 2;
      context.strokeRect(deckX - 22, deckY - 4, 44, 14);
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [arc, carrying, band, cargo.dropAt]);

  const reset = useCallback(() => {
    setCargoIndex(0);
    setArc(2);
    setGrip(PLAN_GRIP_MAX);
    setCarrying(false);
    setDelivered(0);
    setChain(0);
    setPoints(0);
    setBanked(0);
    setPhase("planning");
    setOutcome(null);
    window.requestAnimationFrame(() => cueRef.current?.focus());
  }, []);

  const finish = useCallback(
    (won: boolean, total: number, crates: number, reason: "whipped" | "spent") => {
      const score = polecatRunScore(total, crates);
      setBanked(score);
      recordSimulationScore(POLECAT_SCORE_ID, score);
      setEndReason(reason);
      setPhase(won ? "delivered" : "fell");
      if (won) audio.fanfare();
      else audio.fail();
    },
    [audio]
  );

  const move = useCallback(
    (choice: Move) => {
      if (phase !== "planning") return;
      audio.unlock();

      if (choice === "pump") {
        const next = arc + 1;
        if (next >= PLAN_WHIP_ARC) {
          setArc(next);
          setOutcome("One rung too far — the pole whips over the pivot.");
          finish(false, points, delivered, "whipped");
          return;
        }
        const nextGrip = grip - 1;
        setArc(next);
        setGrip(Math.max(0, nextGrip));
        setOutcome(`Pumped up to rung ${next}. One more turn of grip spent.`);
        audio.tick(next);
        if (nextGrip <= 0) {
          setOutcome(`Pumped up to rung ${next}, and the arms gave out doing it.`);
          finish(false, points, delivered, "spent");
        }
        return;
      }

      if (choice === "ride") {
        // Riding the arc down costs nothing and lets the arms recover.
        const next = Math.max(0, arc - 1);
        setArc(next);
        setGrip(Math.min(PLAN_GRIP_MAX, grip + 1));
        setOutcome(`Rode it down to rung ${next} and shook the arms out.`);
        audio.tick(next);
        return;
      }

      const accuracy = planAccuracy(arc, band);
      if (accuracy <= 0) {
        const nextGrip = grip - 1;
        setGrip(Math.max(0, nextGrip));
        setChain(0);
        setOutcome(
          carrying
            ? `Let go at rung ${arc} — the crate falls short of the deck, and it costs a hand.`
            : `Reached at rung ${arc} and caught nothing but air. It costs a hand.`
        );
        audio.impact();
        if (nextGrip <= 0) finish(false, points, delivered, "spent");
        return;
      }

      const earned = cargoScore(accuracy, chain);
      const nextPoints = points + earned;
      setPoints(nextPoints);
      setChain(chain + 1);
      audio.catchCue();

      if (!carrying) {
        setCarrying(true);
        setOutcome(`Hooked ${cargo.label} at rung ${arc}. +${earned}. Now bring it down over the deck.`);
        return;
      }

      const nextDelivered = delivered + 1;
      setCarrying(false);
      setDelivered(nextDelivered);
      setGrip(Math.min(PLAN_GRIP_MAX, grip + 1));
      setOutcome(`${cargo.label} lands square on the deck. +${earned}.`);
      if (cargoIndex + 1 >= PLAN_CARGOS.length) {
        finish(true, nextPoints, nextDelivered, "spent");
        return;
      }
      setCargoIndex(cargoIndex + 1);
      audio.fanfare();
    },
    [
      phase,
      audio,
      arc,
      grip,
      points,
      delivered,
      band,
      carrying,
      chain,
      cargo.label,
      cargoIndex,
      finish,
    ]
  );

  const rating = polecatRating(delivered);
  const status =
    phase === "delivered"
      ? `The whole load is on the deck. ${rating.grade} — ${rating.note} ${banked} points banked.`
      : phase === "fell"
        ? endReason === "whipped"
          ? `The pole whipped over the top. ${rating.grade} — ${banked} points banked.`
          : `The arms gave out. ${rating.grade} — ${banked} points banked.`
        : carrying
          ? `Carrying ${cargo.label}. Let it go on rung ${cargo.dropAt.join(" or ")}.`
          : `${cargo.label}, crate ${cargoIndex + 1} of ${PLAN_CARGOS.length}. Build the arc, then reach.`;

  return (
    <div
      data-sim-state={phase}
      data-polecat-mode="plan"
      data-polecat-cargo={cargoIndex + 1}
      data-polecat-arc={arc}
      data-polecat-band={band.join(",")}
      data-polecat-carrying={carrying ? "yes" : "no"}
      data-polecat-delivered={delivered}
      data-polecat-grip={grip}
      data-polecat-points={points}
      data-polecat-score={banked}
      className="flex flex-col gap-3"
      {...rootProps}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <FuryRoadStat label="crate" value={`${cargoIndex + 1}/${PLAN_CARGOS.length}`} width="w-8" />
        <FuryRoadStat label="delivered" value={delivered} width="w-6" />
        <FuryRoadStat label="points" value={points} width="w-12" />
        <FuryRoadPips label="grip" value={grip} max={PLAN_GRIP_MAX} />
        <span className="ml-auto">
          <FuryRoadMuteButton muted={muted} onToggle={onToggleMute} />
        </span>
      </div>

      <FuryRoadPlanBanner>
        Swing plan · no clock, no motion — work the arc one rung at a time
      </FuryRoadPlanBanner>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-32 w-full border border-accent/25 bg-ink/60 sm:h-44"
      />

      <div className="flex items-center gap-3">
        <FuryRoadMeter
          label="Arc"
          value={arc / PLAN_MAX_ARC}
          note={band.includes(arc) ? "in reach" : arc >= PLAN_MAX_ARC ? "whipping" : "building"}
          danger={arc >= PLAN_MAX_ARC}
          reducedMotion
        />
        <span className="shrink-0 text-[11px] tabular-nums text-accent">
          rung {arc} / need {band.join(" or ")}
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
            ref={cueRef}
            tabIndex={-1}
            className="text-sm normal-case leading-relaxed text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {carrying
              ? `${cargo.label} is on the pole. The deck comes level at rung ${cargo.dropAt.join(" or ")} on the way back.`
              : cargo.cue}
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
            <button
              type="button"
              onClick={() => move("pump")}
              aria-label={`Pump one rung higher, to rung ${arc + 1}`}
              className="flex-1 border border-accent/30 px-3 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              pump higher
            </button>
            <button
              type="button"
              onClick={() => move("ride")}
              aria-label={`Ride the arc down to rung ${Math.max(0, arc - 1)} and recover grip`}
              className="flex-1 border border-accent/30 px-3 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ride it down
            </button>
            {/* One element for both beats: nothing is swapped in under a gesture. */}
            <button
              type="button"
              onClick={() => move(carrying ? "release" : "reach")}
              aria-label={carrying ? "Let the cargo go over the deck" : "Reach for the cargo"}
              className="flex-1 border border-accent/40 px-3 py-2 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {carrying ? "let go" : "reach"}
            </button>
          </div>
        </>
      ) : (
        <div className="border border-accent/30 bg-ink/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">{rating.grade}</p>
          <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/70">{rating.note}</p>
          <ul className="mt-2 space-y-0.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
            <li>Crates delivered — {delivered}</li>
            <li>Cargo points — {points}</li>
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
            Man the pole again
          </button>
        )}
      </div>
    </div>
  );
}
