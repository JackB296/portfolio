"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FilmExperienceView } from "@/lib/films";
import type { FilmSimulationComponent } from "@/lib/filmExperienceTypes";
import {
  SOUND_NUDGE_EVENT,
  SOUND_NUDGE_KEY,
} from "@/lib/featurePresentation";

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
  // The sound nudge: after the feature-presentation leader commits a film
  // silently, the sound toggle pulses until the visitor uses it (or sound
  // comes on some other way). Session-scoped — a reload mid-visit keeps it.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    try {
      setNudge(sessionStorage.getItem(SOUND_NUDGE_KEY) === "1");
    } catch {
      // Storage blocked: no nudge.
    }
    const onNudge = () => setNudge(true);
    window.addEventListener(SOUND_NUDGE_EVENT, onNudge);
    return () => window.removeEventListener(SOUND_NUDGE_EVENT, onNudge);
  }, []);
  const clearNudge = () => {
    setNudge(false);
    try {
      sessionStorage.removeItem(SOUND_NUDGE_KEY);
    } catch {
      // Storage blocked: state alone is fine.
    }
  };
  // Sound arriving by any path (theater commit, terminal) retires the nudge
  // for good — it must not reappear when sound is later toggled off.
  useEffect(() => {
    if (soundEnabled && nudge) clearNudge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, nudge]);
  const simulationButtonRef = useRef<HTMLButtonElement>(null);
  const simulation = experience.simulation;

  // Switching films closes and forgets any open simulation, so a WarGames
  // dialog can't survive into another mode.
  const liveIdRef = useRef(experience.id);
  useEffect(() => {
    liveIdRef.current = experience.id;
    setOpenSim(null);
  }, [experience.id]);

  const openSimulation = () => {
    // Tagging the load with the film it was requested for keeps a chunk that
    // resolves after a film switch from opening its dialog over the new mode —
    // and dropping stale resolutions keeps that state from resurrecting the
    // dialog unclicked if the user later returns to this film.
    const forId = experience.id;
    void simulation
      ?.load()
      .then((module) => {
        if (forId !== liveIdRef.current) return;
        setOpenSim({ forId, Component: module.default });
      })
      .catch(() => {
        // A failed chunk fetch leaves the button inert; retry is a re-click.
      });
  };
  const closeSimulation = useCallback(() => {
    setOpenSim(null);
    window.requestAnimationFrame(() => simulationButtonRef.current?.focus());
  }, []);

  const soundLabel = [
    experience.audio.music.label,
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
          data-sound-nudge={nudge && !soundEnabled ? "on" : "off"}
          onClick={() => {
            clearNudge();
            onToggleSound();
          }}
          className={`relative rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            nudge && !soundEnabled ? "text-accent" : ""
          }`}
        >
          {soundEnabled ? "sound on" : "sound off"}
          {nudge && !soundEnabled && (
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full border border-accent/60 [animation-duration:2s]"
            />
          )}
        </button>
        {simulation && (
          <button
            ref={simulationButtonRef}
            type="button"
            aria-label={simulation.label}
            aria-haspopup="dialog"
            onClick={openSimulation}
            className="rounded-full px-2.5 py-1.5 text-accent transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            simulate
          </button>
        )}
      </div>
      {openSim && openSim.forId === experience.id && (
        <openSim.Component onClose={closeSimulation} />
      )}
    </>
  );
}
