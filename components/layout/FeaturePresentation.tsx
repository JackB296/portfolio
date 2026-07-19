"use client";

import { useEffect, useRef, useState } from "react";
import type { FilmId } from "@/lib/films/ids";
import {
  LEADER_FORCE_KEY,
  LEADER_SEEN_KEY,
  SOUND_NUDGE_EVENT,
  SOUND_NUDGE_KEY,
  tonightsFeatureId,
} from "@/lib/featurePresentation";
import { applyGrade, getGrade, GRADE_STORAGE_KEY } from "@/lib/grades";
import { SCROLL_LOCK_EVENT, SCROLL_UNLOCK_EVENT } from "./SmoothScroll";

const COUNT_START = 3;
const TICK_MS = 800;
const FADE_MS = 500;

type LeaderState = "counting" | "fading" | "done";

/**
 * The "feature presentation" front door: on a visitor's first ever visit an
 * academy-leader countdown plays while the site re-themes to tonight's
 * date-picked film grade. The grade applies with the PREVIEW intent — it is
 * transient for this visit; committing a film stays a theater-wall gesture
 * (there has been no user gesture yet, so audio must not arm).
 *
 * Never shows when: a grade is already committed, the leader has been seen,
 * the visitor prefers reduced motion, or the page is driven by automation
 * (navigator.webdriver) without the force key — the overlay would otherwise
 * race every Playwright click on a fresh profile.
 */
export default function FeaturePresentation() {
  const [state, setState] = useState<LeaderState | "idle">("idle");
  const [count, setCount] = useState(COUNT_START);
  const [featureId, setFeatureId] = useState<FilmId | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    let committed: string | null = null;
    let seen: string | null = null;
    let forced = false;
    try {
      committed = localStorage.getItem(GRADE_STORAGE_KEY);
      seen = localStorage.getItem(LEADER_SEEN_KEY);
      forced = localStorage.getItem(LEADER_FORCE_KEY) != null;
    } catch {
      return; // storage blocked: we could never record "seen", so never show
    }
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const automated = navigator.webdriver && !forced;
    if (committed || seen || reducedMotion || automated) return;

    setFeatureId(tonightsFeatureId());
    setState("counting");
  }, []);

  // The countdown ticks 3 → 2 → 1, then hands off to the fade.
  useEffect(() => {
    if (state !== "counting") return;
    if (count <= 1) {
      const t = window.setTimeout(() => setState("fading"), TICK_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), TICK_MS);
    return () => window.clearTimeout(t);
  }, [state, count]);

  // Reveal: apply tonight's grade behind the overlay, then fade out. A
  // SILENT commit: the full experience runs for this visit (canvas, controls),
  // nothing persists, and sound stays off — the visitor hasn't asked for
  // audio, so the controls pulse their sound toggle instead (the nudge).
  useEffect(() => {
    if (state !== "fading" || finishedRef.current) return;
    finishedRef.current = true;
    try {
      localStorage.setItem(LEADER_SEEN_KEY, "1");
      sessionStorage.setItem(SOUND_NUDGE_KEY, "1");
    } catch {
      // Private browsing: the leader may replay next visit; harmless.
    }
    applyGrade(getGrade(featureId) ?? null, "commit", { silent: true });
    window.dispatchEvent(new Event(SOUND_NUDGE_EVENT));
    const t = window.setTimeout(() => setState("done"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [state, featureId]);

  // Freeze scroll while the leader is up (same pairing as the dialogs).
  useEffect(() => {
    if (state !== "counting" && state !== "fading") return;
    window.dispatchEvent(new Event(SCROLL_LOCK_EVENT));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event(SCROLL_UNLOCK_EVENT));
    };
  }, [state]);

  // Skip: click anywhere or Escape. Skipping still applies tonight's grade —
  // the visitor lands on the feature either way, just sooner.
  useEffect(() => {
    if (state !== "counting") return;
    const skip = () => setState("fading");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (state === "idle" || state === "done" || !featureId) return null;

  const film = getGrade(featureId);

  return (
    <div
      data-feature-leader={state}
      onClick={() => setState("fading")}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink transition-opacity duration-500 ${
        state === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Academy-leader ring: crosshairs, circle, sweep hand. */}
      <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-2 border-white/30">
        <div className="absolute left-1/2 top-[-50%] h-[200%] w-px bg-white/15" />
        <div className="absolute top-1/2 left-[-50%] h-px w-[200%] bg-white/15" />
        <div
          className="absolute inset-1.5 animate-[leader-sweep_0.8s_linear_infinite] rounded-full"
          style={{
            background:
              "conic-gradient(rgb(255 255 255 / 0.12) 0 40deg, transparent 40deg)",
          }}
        />
        <span
          key={count}
          className="font-mono text-6xl font-semibold text-white"
          aria-hidden
        >
          {count}
        </span>
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-white/60">
        Feature presentation
      </p>
      {film && (
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Now showing · {film.film} ({film.year})
        </p>
      )}

      <button
        type="button"
        onClick={() => setState("fading")}
        className="absolute bottom-8 right-8 rounded-full border border-white/15 px-4 py-2 font-mono text-xs text-white/60 transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        skip ↵
      </button>

      <span className="sr-only" role="status">
        Intro playing: tonight this site is themed after {film?.film}. Press
        Escape to skip.
      </span>
    </div>
  );
}
