"use client";

import { usePathname } from "next/navigation";
import {
  setPlaygroundEnabled,
  useFilmModeActive,
  usePlaygroundEnabled,
} from "@/lib/playground";

/**
 * The playground pill: bottom-right utility cluster, sharing a row with the
 * commentary toggle (the row itself is laid out in app/layout.tsx). Announces
 * the deferral rule when a film mode owns the page.
 */
export default function PlaygroundToggle() {
  const pathname = usePathname();
  const enabled = usePlaygroundEnabled();
  const filmActive = useFilmModeActive();

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
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-ink/80 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-white/70 shadow-xl shadow-black/30 backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
    </button>
  );
}
