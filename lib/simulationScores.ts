"use client";

// Personal bests for the film simulations, one number per game. Kept apart
// from playground-scores: those are additive tallies with a fixed two-field
// shape, while simulations record a per-game best under an open-ended key so
// each new film's game can bank without touching this module again.

export const SIMULATION_SCORES_KEY = "simulation-scores";
export const SIMULATION_SCORE_EVENT = "simulationscore";

export type SimulationScores = Readonly<Record<string, number>>;

export function readSimulationScores(): SimulationScores {
  try {
    const raw = localStorage.getItem(SIMULATION_SCORES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const [game, value] of Object.entries(parsed)) {
      const score = Number(value);
      if (Number.isFinite(score) && score > 0) scores[game] = score;
    }
    return scores;
  } catch {
    return {};
  }
}

/** Record a run; keeps the best score per game and tells listeners. */
export function recordSimulationScore(gameId: string, score: number) {
  if (!Number.isFinite(score) || score <= 0) return;
  const current = readSimulationScores();
  const best = Math.max(current[gameId] ?? 0, Math.round(score));
  const next: SimulationScores = { ...current, [gameId]: best };
  try {
    localStorage.setItem(SIMULATION_SCORES_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the run still counts for this visit's UI.
  }
  window.dispatchEvent(
    new CustomEvent<SimulationScores>(SIMULATION_SCORE_EVENT, { detail: next })
  );
}
