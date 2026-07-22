"use client";

import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  FuryRoadHalf,
  useFuryRoadAudio,
} from "@/components/film-experience/simulations/FuryRoadShared";
import FuryRoadStormRun from "@/components/film-experience/simulations/FuryRoadStormRun";
import FuryRoadStormPlan from "@/components/film-experience/simulations/FuryRoadStormPlan";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Turning the convoy around and driving straight into the thing everyone else
 * is running from.
 *
 * With motion, the front is a live gauntlet: five lanes, lightning that takes a
 * whole one, debris that falls into one, and whirls that drift a lane sideways
 * while you are watching them, under a dust curtain that thickens as it goes.
 * With reduced motion, the same front is called out one beat at a time — same
 * hull, same brace, same dodges, same score.
 */
function Storm() {
  const reducedMotion = useReducedMotion();
  const { audio, muted, onToggleMute } = useFuryRoadAudio();

  return (
    <FuryRoadHalf
      reduced={reducedMotion}
      plan={<FuryRoadStormPlan audio={audio} muted={muted} onToggleMute={onToggleMute} />}
      live={<FuryRoadStormRun audio={audio} muted={muted} onToggleMute={onToggleMute} />}
    />
  );
}

type Props = { onClose: () => void };

export default function FuryRoadStorm({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="fury-road-storm-title"
      gameId="fury-road-storm"
      eyebrow="Reflex run"
      title="Into the storm"
      startLabel="Drive in"
      stage
      reference={{
        quote: "Oh, what a lovely day!",
        scene: "Mad Max: Fury Road (2015) · driving into the dust tornado",
      }}
      howToPlay={{
        objective: "Keep the hull intact as the dust front throws lightning, debris, and whirls at your lane.",
        controls: [
          { keys: "← →", does: "swerve to the next lane (A / D too)" },
          { keys: "hold ↓", does: "brace — the hit lands on the plates, but you cannot swerve" },
          { keys: "tap a lane", does: "swerve there on touch" },
          { keys: "P", does: "pause the run" },
        ],
        tip: "Warnings land a beat before the strike, and bracing burns grit, so keep it for when there is nowhere to go. With reduced motion the front is called one beat at a time — pick a lane or brace, no clock.",
      }}
      onClose={onClose}
    >
      <Storm />
    </SimulationShell>
  );
}
