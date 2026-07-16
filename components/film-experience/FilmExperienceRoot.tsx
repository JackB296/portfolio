"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GRADE_EVENT,
  getGrade,
  type GradeChangeDetail,
  type GradeChangeIntent,
} from "@/lib/grades";
import { filmExperienceById } from "@/lib/filmExperiences";
import ExperienceControls from "./ExperienceControls";
import AudioDirector, {
  type AudioDirectorHandle,
  type AudioDirectorStatus,
} from "./AudioDirector";
import CinematicLayer, { type VisualStatus } from "./CinematicLayer";

type ExperienceState = Readonly<{
  activeId: string | null;
  committedId: string | null;
  lastIntent: GradeChangeIntent | "hydrate";
}>;

const FILM_STYLE_VARS = [
  "--film-radius",
  "--film-letter-spacing",
  "--film-line-opacity",
  "--film-material",
] as const;

function applyExperienceTokens(id: string | null) {
  const html = document.documentElement;
  const experience = id ? filmExperienceById.get(id) : undefined;

  if (!experience) {
    delete html.dataset.filmMode;
    delete html.dataset.filmMotion;
    FILM_STYLE_VARS.forEach((name) => html.style.removeProperty(name));
    return;
  }

  html.dataset.filmMode = experience.id;
  html.dataset.filmMotion = experience.tokens.motion;
  html.style.setProperty("--film-radius", experience.tokens.radius);
  html.style.setProperty("--film-letter-spacing", experience.tokens.letterSpacing);
  html.style.setProperty("--film-line-opacity", String(experience.tokens.lineOpacity));
  html.style.setProperty("--film-material", `"${experience.tokens.material}"`);
}

export default function FilmExperienceRoot() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ExperienceState>({
    activeId: null,
    committedId: null,
    lastIntent: "hydrate",
  });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  soundEnabledRef.current = soundEnabled;
  const [audioStatus, setAudioStatus] = useState<AudioDirectorStatus>({
    state: "off",
    filmId: null,
    source: null,
    musicSource: null,
    effectSources: [],
    nodeCount: 0,
    trackCount: 0,
  });
  const audioRef = useRef<AudioDirectorHandle>(null);
  const enableRequestRef = useRef(0);
  const [visualStatus, setVisualStatus] = useState<VisualStatus>({
    state: "off",
    filmId: null,
  });

  const requestSound = useCallback((filmId: string | null) => {
    const director = audioRef.current;
    if (!director || !filmId) return;
    const requestId = ++enableRequestRef.current;
    void director
      .enable(filmId)
      .then((started) => {
        if (enableRequestRef.current === requestId) setSoundEnabled(started);
      })
      .catch(() => {
        if (enableRequestRef.current === requestId) {
          director.disable();
          setSoundEnabled(false);
        }
      });
  }, []);

  useEffect(() => {
    const initialId = document.documentElement.dataset.grade ?? null;
    setState({ activeId: initialId, committedId: initialId, lastIntent: "hydrate" });

    const onGradeChange = (event: Event) => {
      const detail = (event as CustomEvent<GradeChangeDetail>).detail;
      const gradeId = detail?.gradeId ?? document.documentElement.dataset.grade ?? null;
      const intent = detail?.intent ?? "commit";

      setState((current) => {
        if (intent === "commit") {
          return { activeId: gradeId, committedId: gradeId, lastIntent: intent };
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
    applyExperienceTokens(state.activeId);
    return () => applyExperienceTokens(null);
  }, [state.activeId]);

  useEffect(() => {
    if (!state.committedId) {
      enableRequestRef.current += 1;
      audioRef.current?.disable();
      setSoundEnabled(false);
      return;
    }
    // Committing a film is a user gesture, so sound defaults on; hydration
    // has no gesture and would be blocked by autoplay policy.
    if (state.lastIntent !== "commit" || soundEnabledRef.current) return;
    requestSound(state.committedId);
  }, [state.committedId, state.lastIntent, requestSound]);

  const committed = useMemo(
    () => (state.committedId ? filmExperienceById.get(state.committedId) : undefined),
    [state.committedId]
  );

  const handleAudioStatus = useCallback((status: AudioDirectorStatus) => {
    setAudioStatus(status);
  }, []);
  const handleVisualStatus = useCallback((status: VisualStatus) => {
    setVisualStatus(status);
  }, []);

  const toggleSound = () => {
    if (soundEnabled) {
      enableRequestRef.current += 1;
      audioRef.current?.disable();
      setSoundEnabled(false);
      return;
    }
    requestSound(state.committedId);
  };

  return (
    <div
      data-film-experience-root
      data-experience-ready={ready}
      data-active-film={state.activeId ?? "house"}
      data-committed-film={state.committedId ?? "house"}
      data-grade-intent={state.lastIntent}
      data-audio-state={audioStatus.state}
      data-audio-film={audioStatus.filmId ?? "none"}
      data-audio-source={audioStatus.source ?? "none"}
      data-audio-music-source={audioStatus.musicSource ?? "none"}
      data-audio-effect-sources={audioStatus.effectSources.join("|") || "none"}
      data-audio-nodes={audioStatus.nodeCount}
      data-audio-tracks={audioStatus.trackCount}
      data-visual-film={visualStatus.filmId ?? "none"}
      data-frame-state={visualStatus.state}
    >
      <CinematicLayer filmId={state.activeId} onStatus={handleVisualStatus} />
      <AudioDirector
        ref={audioRef}
        filmId={state.committedId}
        enabled={soundEnabled}
        onStatus={handleAudioStatus}
      />
      {committed && (
        <ExperienceControls
          filmId={committed.id}
          film={getGrade(committed.id)?.film ?? committed.label}
          soundLabel={[
            committed.audio.music.label,
            ...committed.audio.effects.map(({ label }) => label),
          ].join(" · ")}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}
    </div>
  );
}
