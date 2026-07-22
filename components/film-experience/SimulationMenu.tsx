"use client";

import { useRef } from "react";
import type { FilmSimulationDefinition } from "@/lib/filmExperienceTypes";
import SimulationDialog from "@/components/film-experience/SimulationDialog";

type SimulationMenuProps = {
  title: string;
  games: readonly FilmSimulationDefinition[];
  onPick: (game: FilmSimulationDefinition) => void;
  onClose: () => void;
};

/**
 * The launcher a film shows when it has more than one game: a small graded
 * dialog listing each one. Picking a game hands control to the shell; this is
 * the front door the slate calls "Shall we play a game?" — generalized so
 * every multi-game film gets the same affordance.
 */
export default function SimulationMenu({
  title,
  games,
  onPick,
  onClose,
}: SimulationMenuProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null);

  return (
    <SimulationDialog
      titleId="simulation-menu-title"
      eyebrow="Select a game"
      title={title}
      onClose={onClose}
      initialFocusRef={firstItemRef}
      widthClassName="max-w-sm"
      closeLabel="Close simulation menu"
    >
      <ul className="flex flex-col gap-2">
        {games.map((game, index) => (
          <li key={game.id}>
            <button
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              onClick={() => onPick(game)}
              className="flex w-full items-center justify-between gap-3 border border-accent/25 px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>{game.name}</span>
              <span aria-hidden className="text-white/40">▸</span>
            </button>
          </li>
        ))}
      </ul>
    </SimulationDialog>
  );
}
