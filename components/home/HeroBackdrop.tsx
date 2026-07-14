"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LifeHero from "./LifeHero";

// The original three.js scene is heavy, so it only downloads when picked.
const HeroScene = dynamic(() => import("../three/HeroScene"), { ssr: false });

const KEY = "hero-bg";
type Backdrop = "life" | "orbit";

/**
 * The hero's animated background plus the corner pill that switches it:
 * "orbit" (default) is the original three.js wireframe sphere and particle
 * field, "life" is the Game of Life automaton. The choice persists.
 */
export default function HeroBackdrop() {
  const [backdrop, setBackdrop] = useState<Backdrop>("orbit");

  // Read the stored preference after hydration (server always renders orbit).
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "life") setBackdrop("life");
    } catch {
      // Private browsing: default stands.
    }
  }, []);

  const select = (next: Backdrop) => {
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

      {/* Backdrop switch */}
      <div
        role="group"
        aria-label="Hero background"
        className="absolute bottom-6 right-6 z-20 flex items-center gap-0.5 rounded-full border border-white/10 bg-ink/60 p-1 font-mono text-[11px] backdrop-blur-sm"
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
