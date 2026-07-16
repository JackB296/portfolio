"use client";

import { useCallback, useRef, useState } from "react";
import WarGamesSimulation from "./WarGamesSimulation";

type ExperienceControlsProps = {
  filmId: string;
  film: string;
  soundLabel: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export default function ExperienceControls({
  filmId,
  film,
  soundLabel,
  soundEnabled,
  onToggleSound,
}: ExperienceControlsProps) {
  const [simulationOpen, setSimulationOpen] = useState(false);
  const simulationButtonRef = useRef<HTMLButtonElement>(null);
  const closeSimulation = useCallback(() => {
    setSimulationOpen(false);
    window.requestAnimationFrame(() => simulationButtonRef.current?.focus());
  }, []);

  return (
    <>
      <div
        role="group"
        aria-label="Cinematic mode controls"
        className="fixed bottom-4 left-4 z-[55] flex items-center gap-1 rounded-full border border-white/10 bg-ink/80 p-1 font-mono text-[10px] text-white/70 shadow-xl shadow-black/30 backdrop-blur-xl sm:bottom-5 sm:left-5"
      >
        <span className="hidden max-w-32 truncate px-2 text-accent sm:inline" title={film}>
          {film}
        </span>
        <button
          type="button"
          aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
          aria-pressed={soundEnabled}
          title={soundLabel}
          onClick={onToggleSound}
          className="rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {soundEnabled ? "sound on" : "sound off"}
        </button>
        {filmId === "wargames" && (
          <button
            ref={simulationButtonRef}
            type="button"
            aria-label="Open tic-tac-toe simulation"
            aria-haspopup="dialog"
            onClick={() => setSimulationOpen(true)}
            className="rounded-full px-2.5 py-1.5 text-accent transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            simulate
          </button>
        )}
      </div>
      {simulationOpen && <WarGamesSimulation onClose={closeSimulation} />}
    </>
  );
}
