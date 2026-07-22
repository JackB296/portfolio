"use client";

import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  FuryRoadHalf,
  useFuryRoadAudio,
} from "@/components/film-experience/simulations/FuryRoadShared";
import FuryRoadPolecatSwing from "@/components/film-experience/simulations/FuryRoadPolecatSwing";
import FuryRoadPolecatPlan from "@/components/film-experience/simulations/FuryRoadPolecatPlan";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Men on whipping poles, arcing over a convoy at speed, taking what they can
 * reach. Both halves ask the same two things of a polecat — work the arc up to
 * the crate, then let it go where it will land.
 *
 * With motion, the pole is an integrated pendulum: gravity, wind damping, and a
 * pump that only adds energy when it goes with the swing. With reduced motion,
 * the same arc is a ladder of rungs called one turn at a time — same grip, same
 * whip-over at the top, same score.
 */
function Polecat() {
  const reducedMotion = useReducedMotion();
  const { audio, muted, onToggleMute } = useFuryRoadAudio();

  return (
    <FuryRoadHalf
      reduced={reducedMotion}
      plan={<FuryRoadPolecatPlan audio={audio} muted={muted} onToggleMute={onToggleMute} />}
      live={<FuryRoadPolecatSwing audio={audio} muted={muted} onToggleMute={onToggleMute} />}
    />
  );
}

type Props = { onClose: () => void };

export default function FuryRoadPolecat({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="fury-road-polecat-title"
      gameId="fury-road-polecat"
      eyebrow="Pole trial"
      title="Polecat swing"
      startLabel="Man the pole"
      stage
      reference={{
        scene: "Mad Max: Fury Road (2015) · men on whipping poles arcing over the convoy",
      }}
      howToPlay={{
        objective: "Work the pole high enough to grab the crate, then drop it on the rig deck.",
        controls: [
          { keys: "hold Space", does: "pump the swing higher (↑ or W too)" },
          { keys: "G", does: "reach for the crate, then press again to let it go" },
          { keys: "Enter", does: "stands in for G on both beats" },
          { keys: "P", does: "pause the run" },
        ],
        tip: "Pumping only adds energy when it goes with the swing, and it burns grip, so holding it down loses. With reduced motion the arc becomes a ladder of rungs called one turn at a time — pump, ride, reach, release.",
      }}
      onClose={onClose}
    >
      <Polecat />
    </SimulationShell>
  );
}
