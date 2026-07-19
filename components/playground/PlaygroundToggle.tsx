"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  PLAYGROUND_SCORE_EVENT,
  readScores,
  setPlaygroundEnabled,
  useFilmModeActive,
  usePlaygroundEnabled,
  type PlaygroundScores,
} from "@/lib/playground";

/**
 * The playground pill: bottom-right utility cluster, stacked above the
 * commentary toggle. Shows the running scoreboard while on, and announces
 * the deferral rule when a film mode owns the page.
 */
export default function PlaygroundToggle() {
  const pathname = usePathname();
  const enabled = usePlaygroundEnabled();
  const filmActive = useFilmModeActive();
  const [scores, setScores] = useState<PlaygroundScores | null>(null);

  useEffect(() => {
    setScores(readScores());
    const onScore = (event: Event) =>
      setScores((event as CustomEvent<PlaygroundScores>).detail);
    window.addEventListener(PLAYGROUND_SCORE_EVENT, onScore);
    return () => window.removeEventListener(PLAYGROUND_SCORE_EVENT, onScore);
  }, []);

  // The layers only exist on the home page; so does the pill (v1).
  if (pathname !== "/") return null;

  const state = !enabled ? "off" : filmActive ? "paused" : "on";
  const label =
    state === "paused"
      ? "PLAYGROUND · paused by film mode"
      : state === "on"
        ? "PLAYGROUND"
        : "PLAYGROUND OFF";

  return (
    <button
      type="button"
      onClick={() => setPlaygroundEnabled(!enabled)}
      aria-pressed={enabled}
      data-playground={state}
      title={
        enabled
          ? "Turn the playground off"
          : "Let the demos loose behind the sections"
      }
      className="fixed bottom-[3.75rem] right-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-ink/80 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-white/70 shadow-xl shadow-black/30 backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:bottom-[4.25rem] sm:right-5"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${
          state === "on"
            ? "bg-accent"
            : state === "paused"
              ? "bg-yellow-500/80"
              : "bg-white/25"
        }`}
      />
      {label}
      {state === "on" && scores && (scores.generations > 0 || scores.threadsCut > 0) && (
        <span className="border-l border-white/15 pl-2 text-white/50">
          life {scores.generations} · cuts {scores.threadsCut}
        </span>
      )}
    </button>
  );
}
