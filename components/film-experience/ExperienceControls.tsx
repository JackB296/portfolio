"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FilmExperienceView } from "@/lib/films";
import type {
  FilmSimulationComponent,
  FilmSimulationDefinition,
} from "@/lib/filmExperienceTypes";
import SimulationMenu from "@/components/film-experience/SimulationMenu";

type ExperienceControlsProps = {
  film: string;
  experience: FilmExperienceView;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export default function ExperienceControls({
  film,
  experience,
  soundEnabled,
  onToggleSound,
}: ExperienceControlsProps) {
  const [openSim, setOpenSim] = useState<{
    forId: string;
    Component: FilmSimulationComponent;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const simulationButtonRef = useRef<HTMLButtonElement>(null);
  const simulations = experience.simulations ?? [];
  const hasSimulations = simulations.length > 0;
  const singleGame = simulations.length === 1;

  // Switching films closes and forgets any open simulation or menu, so a
  // dialog can't survive into another mode.
  const liveIdRef = useRef(experience.id);
  useEffect(() => {
    liveIdRef.current = experience.id;
    setOpenSim(null);
    setMenuOpen(false);
  }, [experience.id]);

  const launchGame = useCallback(
    (game: FilmSimulationDefinition) => {
      setMenuOpen(false);
      // Tagging the load with the film it was requested for keeps a chunk that
      // resolves after a film switch from opening its dialog over the new mode —
      // and dropping stale resolutions keeps that state from resurrecting the
      // dialog unclicked if the user later returns to this film.
      const forId = experience.id;
      void game
        .load()
        .then((module) => {
          if (forId !== liveIdRef.current) return;
          setOpenSim({ forId, Component: module.default });
        })
        .catch(() => {
          // A failed chunk fetch leaves the button inert; retry is a re-click.
        });
    },
    [experience.id]
  );

  // The pill opens the one game directly, or the launcher menu for several.
  const onSimulateClick = () => {
    if (singleGame) launchGame(simulations[0]);
    else setMenuOpen(true);
  };
  // Closing any simulation surface returns focus to the pill that opened it.
  const closeAndRefocus = useCallback((reset: () => void) => {
    reset();
    window.requestAnimationFrame(() => simulationButtonRef.current?.focus());
  }, []);
  const closeMenu = useCallback(
    () => closeAndRefocus(() => setMenuOpen(false)),
    [closeAndRefocus]
  );
  const closeSimulation = useCallback(
    () => closeAndRefocus(() => setOpenSim(null)),
    [closeAndRefocus]
  );

  const soundLabel = [
    ...(experience.audio.music ? [experience.audio.music.label] : []),
    ...experience.audio.effects.map(({ label }) => label),
  ].join(" · ");

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
          aria-pressed={soundEnabled}
          title={soundLabel}
          onClick={onToggleSound}
          className="rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {soundEnabled ? "sound on" : "sound off"}
        </button>
        {hasSimulations && (
          <button
            ref={simulationButtonRef}
            type="button"
            aria-label={
              singleGame
                ? `Open ${simulations[0].name}`
                : experience.simulationsMenuTitle ?? "Open simulations"
            }
            aria-haspopup="dialog"
            onClick={onSimulateClick}
            // The one filled control in the row: the games are the least
            // discoverable thing in the experience, so the pill states how
            // many there are rather than naming an action nobody is hunting for.
            className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1.5 text-ink transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            <span aria-hidden className="text-[8px] leading-none">▶</span>
            {simulations.length} {singleGame ? "game" : "games"}
          </button>
        )}
      </div>
      {menuOpen && !openSim && (
        <SimulationMenu
          title={experience.simulationsMenuTitle ?? "Select a simulation"}
          games={simulations}
          onPick={launchGame}
          onClose={closeMenu}
        />
      )}
      {openSim && openSim.forId === experience.id && (
        <openSim.Component onClose={closeSimulation} />
      )}
    </>
  );
}
