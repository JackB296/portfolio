"use client";

import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  FuryRoadHalf,
  useFuryRoadAudio,
} from "@/components/film-experience/simulations/FuryRoadShared";
import FuryRoadWitnessLeap from "@/components/film-experience/simulations/FuryRoadWitnessLeap";
import FuryRoadWitnessCall from "@/components/film-experience/simulations/FuryRoadWitnessCall";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Chrome on the mouth, both hands off the pole, and a gap that will not hold
 * still. The ritual is half the moment, so both halves of this game ask for it
 * first and the jump second.
 *
 * With motion, the chrome is a held can and the leap is a tap into a window
 * that drifts on the wind and breathes with the vehicle's sway. With reduced
 * motion, the same crossing is called out — the coat, then the gap, twice per
 * vehicle — with the same grip, the same streak, and the same score.
 */
function Witness() {
  const reducedMotion = useReducedMotion();
  const { audio, muted, onToggleMute } = useFuryRoadAudio();

  return (
    <FuryRoadHalf
      reduced={reducedMotion}
      plan={<FuryRoadWitnessCall audio={audio} muted={muted} onToggleMute={onToggleMute} />}
      live={<FuryRoadWitnessLeap audio={audio} muted={muted} onToggleMute={onToggleMute} />}
    />
  );
}

type Props = { onClose: () => void };

export default function FuryRoadWitness({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="fury-road-witness-title"
      gameId="fury-road-witness"
      eyebrow="One shot"
      title="Witness me"
      startLabel="Chrome up"
      stage
      reference={{
        quote: "Witness me!",
        scene: "Mad Max: Fury Road (2015) · chrome sprayed, the leap between vehicles",
      }}
      howToPlay={{
        objective: "Cross from vehicle to vehicle down the convoy without missing a gap.",
        controls: [
          { keys: "hold Space", does: "spray the chrome, releasing on the mark" },
          { keys: "Space", does: "leap when the marker crosses the gap" },
          { keys: "Enter", does: "stands in for space on both beats" },
          { keys: "P", does: "pause the run" },
        ],
        tip: "A leap is worth more with more chrome coats and a longer streak. With reduced motion the crossing is called out instead — pick the coat, then the gap, from a list of options, no timing.",
      }}
      onClose={onClose}
    >
      <Witness />
    </SimulationShell>
  );
}
