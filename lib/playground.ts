"use client";

// Playground-takeover state: the toggle, the film-mode deferral rule, and the
// scoreboard. Layers and the pill live in components/playground/; this module
// is the shared behavior, mirroring how lib/grades.ts backs the film system.

import { useEffect, useState } from "react";

export const PLAYGROUND_STORAGE_KEY = "playground-enabled";
export const PLAYGROUND_EVENT = "playgroundchange";
export const PLAYGROUND_SCORE_EVENT = "playgroundscore";
export const PLAYGROUND_SCORES_KEY = "playground-scores";

export type PlaygroundScores = Readonly<{
  /** Game of Life generations simulated behind the Projects section. */
  generations: number;
  /** Cloth threads sliced behind the Skills section. */
  threadsCut: number;
}>;

const ZERO_SCORES: PlaygroundScores = { generations: 0, threadsCut: 0 };

export function readScores(): PlaygroundScores {
  try {
    const raw = localStorage.getItem(PLAYGROUND_SCORES_KEY);
    if (!raw) return ZERO_SCORES;
    const parsed = JSON.parse(raw) as Partial<PlaygroundScores>;
    return {
      generations: Number(parsed.generations) || 0,
      threadsCut: Number(parsed.threadsCut) || 0,
    };
  } catch {
    return ZERO_SCORES;
  }
}

/** Add to the persisted scores and tell the pill. */
export function addScores(delta: Partial<PlaygroundScores>) {
  const next: PlaygroundScores = {
    generations: readScores().generations + (delta.generations ?? 0),
    threadsCut: readScores().threadsCut + (delta.threadsCut ?? 0),
  };
  try {
    localStorage.setItem(PLAYGROUND_SCORES_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: scores are session-only.
  }
  window.dispatchEvent(
    new CustomEvent<PlaygroundScores>(PLAYGROUND_SCORE_EVENT, { detail: next })
  );
}

// The playground is ON by default; the key stores an explicit opt-out ("0").
export function setPlaygroundEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(PLAYGROUND_STORAGE_KEY);
    else localStorage.setItem(PLAYGROUND_STORAGE_KEY, "0");
  } catch {
    // Storage blocked: the toggle still works for this visit.
  }
  window.dispatchEvent(
    new CustomEvent<boolean>(PLAYGROUND_EVENT, { detail: on })
  );
}

/** Subscribe to the playground toggle (pill and every layer share this).
 * Starts false pre-hydration (SSR has no storage), then reads the opt-out. */
export function usePlaygroundEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(PLAYGROUND_STORAGE_KEY) !== "0");
    } catch {
      // Storage blocked: default on for this visit.
      setEnabled(true);
    }
    const onChange = (event: Event) =>
      setEnabled((event as CustomEvent<boolean>).detail);
    window.addEventListener(PLAYGROUND_EVENT, onChange);
    return () => window.removeEventListener(PLAYGROUND_EVENT, onChange);
  }, []);
  return enabled;
}

/**
 * True while a film grade is active. Only one ambient canvas system runs at
 * a time: when the film experience owns the page, playground layers pause.
 */
export function useFilmModeActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const read = () =>
      setActive(document.documentElement.dataset.filmMode != null);
    read();
    // data-film-mode is written by a React effect (applyExperienceTokens),
    // not synchronously with GRADE_EVENT — watch the attribute itself.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-film-mode"],
    });
    return () => observer.disconnect();
  }, []);
  return active;
}
