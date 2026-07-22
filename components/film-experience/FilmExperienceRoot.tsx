"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyExperienceTokens,
  GRADE_EVENT,
  type GradeChangeDetail,
  type GradeChangeIntent,
} from "@/lib/grades";
import { getFilm, getFilmExperience, HOUSE_ID } from "@/lib/films";
import ExperienceControls from "./ExperienceControls";
import AudioDirector, {
  OFF_AUDIO_STATUS,
  type AudioDirectorStatus,
} from "./AudioDirector";
import CinematicLayer, { type VisualStatus } from "./CinematicLayer";
import OsAmbience from "./OsAmbience";

type ExperienceState = Readonly<{
  activeId: string | null;
  committedId: string | null;
  lastIntent: GradeChangeIntent | "hydrate";
  /** True when the last commit asked not to auto-arm sound (the leader). */
  lastSilent: boolean;
}>;

export default function FilmExperienceRoot() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ExperienceState>({
    activeId: null,
    committedId: null,
    lastIntent: "hydrate",
    lastSilent: false,
  });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioDirectorStatus>(OFF_AUDIO_STATUS);
  const [visualStatus, setVisualStatus] = useState<VisualStatus>({
    state: "off",
    filmId: null,
  });

  useEffect(() => {
    const initialId = document.documentElement.dataset.grade ?? null;
    setState({
      activeId: initialId,
      committedId: initialId,
      lastIntent: "hydrate",
      lastSilent: false,
    });

    // Interpret side of the grade-change protocol — see GradeChangeIntent in
    // lib/grades.ts: previews re-theme, commits persist and arm sound,
    // restores return to the committed grade.
    const onGradeChange = (event: Event) => {
      const detail = (event as CustomEvent<GradeChangeDetail>).detail;
      const gradeId = detail?.gradeId ?? document.documentElement.dataset.grade ?? null;
      const intent = detail?.intent ?? "commit";

      setState((current) => {
        if (intent === "commit") {
          return {
            activeId: gradeId,
            committedId: gradeId,
            lastIntent: intent,
            lastSilent: detail?.silent === true,
          };
        }
        return { ...current, activeId: gradeId, lastIntent: intent };
      });
    };

    window.addEventListener(GRADE_EVENT, onGradeChange);
    setReady(true);
    return () => {
      window.removeEventListener(GRADE_EVENT, onGradeChange);
    };
  }, []);

  useEffect(() => {
    // The boot script already applied a persisted film's tokens pre-paint;
    // skipping the pre-hydration pass keeps this writer from clearing them
    // for a frame before state catches up. Re-applying the same values on
    // hydrate is idempotent.
    if (!ready) return;
    applyExperienceTokens(state.activeId);
    return () => applyExperienceTokens(null);
  }, [ready, state.activeId]);

  // Committing a film is a user gesture, so sound defaults on; hydration has
  // no gesture and would be blocked by autoplay policy. Silent commits (the
  // feature-presentation leader) opt out: the visitor hasn't asked for audio.
  useEffect(() => {
    if (state.lastIntent === "commit" && state.committedId && !state.lastSilent)
      setSoundEnabled(true);
  }, [state.committedId, state.lastIntent, state.lastSilent]);

  const committed = useMemo(() => getFilm(state.committedId), [state.committedId]);
  // Registry lookups are referentially stable per film, so the controls'
  // props (and their [experience.id] effects) only churn on real changes.
  const committedExperience = getFilmExperience(state.committedId);

  const handleAudioStatus = useCallback((status: AudioDirectorStatus) => {
    setAudioStatus(status);
    // Any teardown — House commit, an audio error, a blocked autoplay —
    // reports "off"; deriving the toggle from it means the button can never
    // claim sound is on while the director is silent.
    if (status.state === "off") setSoundEnabled(false);
  }, []);
  const handleVisualStatus = useCallback((status: VisualStatus) => {
    setVisualStatus(status);
  }, []);

  const toggleSound = () => setSoundEnabled((current) => !current);

  return (
    <div
      data-film-experience-root
      data-experience-ready={ready}
      data-active-film={state.activeId ?? HOUSE_ID}
      data-committed-film={state.committedId ?? HOUSE_ID}
      data-grade-intent={state.lastIntent}
      data-audio-state={audioStatus.state}
      data-audio-film={audioStatus.filmId ?? "none"}
      data-audio-music-source={audioStatus.musicSource ?? "none"}
      data-audio-effect-sources={audioStatus.effectSources.join("|") || "none"}
      data-audio-nodes={audioStatus.nodeCount}
      data-audio-tracks={audioStatus.trackCount}
      data-visual-film={visualStatus.filmId ?? "none"}
      data-frame-state={visualStatus.state}
    >
      <CinematicLayer filmId={state.activeId} onStatus={handleVisualStatus} />
      <AudioDirector
        filmId={state.committedId}
        enabled={soundEnabled}
        onStatus={handleAudioStatus}
      />
      {/* The boot chime and screening-room narration; null under the house. */}
      <OsAmbience
        committedFilmId={state.committedId}
        soundEnabled={soundEnabled}
        lastIntent={state.lastIntent}
      />
      {committed && committedExperience && (
        <ExperienceControls
          film={committed.film}
          experience={committedExperience}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}
    </div>
  );
}
