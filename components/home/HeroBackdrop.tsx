"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import LifeHero from "./LifeHero";
import { observeHtmlAttr, isHouse } from "@/lib/useHtmlAttr";

// The original three.js scene is heavy, so it only downloads when picked.
const HeroScene = dynamic(() => import("../three/HeroScene"), { ssr: false });

const KEY = "hero-bg";
type Backdrop = "life" | "orbit";

/**
 * The house has no film behind it, so it gets the automaton — the site's own
 * signature. A film mode gets the orbit, whose shader takes the active grade
 * and belongs to the world the film is painting.
 */
const defaultFor = (house: boolean): Backdrop => (house ? "life" : "orbit");

/**
 * The hero's animated background plus the corner pill that switches it:
 * "orbit" is the three.js wireframe sphere and particle field, "life" is the
 * Game of Life automaton.
 *
 * The default follows the active grade — Life under the house, orbit under a
 * film — and re-follows it as grades change. Picking one from the pill is an
 * explicit choice: it persists and stops the grade deciding for you.
 */
export default function HeroBackdrop() {
  // SSR has no grade and no storage, so it renders the house default; the
  // first client effect resolves the real answer before anything is visible.
  const [backdrop, setBackdrop] = useState<Backdrop>("life");
  // Once the visitor picks from the pill, the grade stops deciding. The grade
  // observer set up at mount stays registered but reads this and no-ops, so a
  // film preview can't flip the chosen backdrop out from under it (which would
  // remount the canvas mid-view).
  const explicitRef = useRef(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // Private browsing: the grade decides for the whole visit.
    }
    if (stored === "life" || stored === "orbit") {
      explicitRef.current = true;
      setBackdrop(stored);
      return;
    }

    // No explicit choice: track the grade for as long as none is made. The
    // grade system writes data-grade from an effect (and from the pre-paint
    // boot script), so watch the attribute rather than a one-shot read.
    const follow = () => {
      if (explicitRef.current) return;
      setBackdrop(defaultFor(isHouse()));
    };
    follow();
    return observeHtmlAttr("data-grade", follow);
  }, []);

  const select = (next: Backdrop) => {
    explicitRef.current = true;
    setBackdrop(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing: applies for this visit only.
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-0" data-hero-bg={backdrop}>
        {backdrop === "life" ? <LifeHero /> : <HeroScene />}
      </div>

      {/* Backdrop switch. Sits directly above the bottom-right pill row (the
          fixed playground + commentary pills at bottom-4/sm:bottom-5, ~2rem
          tall), sharing its right edge and vertical rhythm. */}
      <div
        role="group"
        aria-label="Hero background"
        className="absolute bottom-14 right-4 z-20 flex items-center gap-0.5 rounded-full border border-white/10 bg-ink/60 p-1 font-mono text-[11px] backdrop-blur-sm sm:bottom-[3.75rem] sm:right-5"
      >
        {(
          [
            ["life", "Game of Life"],
            ["orbit", "3D orbit"],
          ] as [Backdrop, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-pressed={backdrop === id}
            title={label}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              backdrop === id
                ? "bg-accent/20 text-accent"
                : "text-white/50 hover:text-white"
            }`}
          >
            {id}
          </button>
        ))}
      </div>
    </>
  );
}
