"use client";

import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  FuryRoadHalf,
  useFuryRoadAudio,
} from "@/components/film-experience/simulations/FuryRoadShared";
import FuryRoadRigChase from "@/components/film-experience/simulations/FuryRoadRigChase";
import FuryRoadRigPlan from "@/components/film-experience/simulations/FuryRoadRigPlan";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Three thousand miles of road with the whole wasteland behind you.
 *
 * Two ways in, and both are the real game rather than a fallback. With motion,
 * the road is a live chase: free steering with weight, pursuit vehicles that
 * flank and ram, guzzoline that the boost eats, and waves that keep arriving.
 * With reduced motion, the same road becomes a convoy plan — the spotter calls
 * the stretch ahead, the driver picks the lane, no clock, same resources, same
 * score.
 */
function WarRig() {
  const reducedMotion = useReducedMotion();
  const { audio, muted, onToggleMute } = useFuryRoadAudio();

  return (
    <FuryRoadHalf
      reduced={reducedMotion}
      plan={<FuryRoadRigPlan audio={audio} muted={muted} onToggleMute={onToggleMute} />}
      live={<FuryRoadRigChase audio={audio} muted={muted} onToggleMute={onToggleMute} />}
    />
  );
}

type Props = { onClose: () => void };

export default function FuryRoadWarRig({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="fury-road-rig-title"
      gameId="fury-road-rig"
      eyebrow="Convoy run"
      title="The war rig"
      startLabel="Hit the road"
      stage
      reference={{
        quote: "We are not things.",
        scene: "Mad Max: Fury Road (2015) · the rig, the road, the pursuit",
      }}
      howToPlay={{
        objective: "Hold the road through as many pursuit waves as the guzzoline lasts.",
        controls: [
          { keys: "← →", does: "steer the rig across the road (A / D too)" },
          { keys: "hold ↑", does: "burn guzzoline for a boost (W or space too)" },
          { keys: "hold + slide", does: "steer by touch — holding also boosts" },
          { keys: "P", does: "pause the run" },
        ],
        tip: "Shaving past a pursuit car banks a squeak; boost eats the tank, and an empty tank ends the run. With reduced motion the road plays as a turn-based convoy plan — pick a lane each beat and arm the boost, no clock.",
      }}
      onClose={onClose}
    >
      <WarRig />
    </SimulationShell>
  );
}
