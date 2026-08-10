"use client";

import { useEffect, useState } from "react";
import { profile } from "@/lib/data";
import HeroBackdrop from "./HeroBackdrop";
import { LIFE_STATS_EVENT } from "./LifeHero";
import { ArrowUpRightIcon } from "../ui/icons";

type LifeStats = { gen: number; pop: number; preset: string };

/**
 * The instrument strip under the navbar: live generation/population numbers
 * straight from the automaton. When the visitor switches to the orbit
 * backdrop the stats stop flowing, and the strip names that scene instead.
 */
function Readout() {
  const [stats, setStats] = useState<LifeStats | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let lastAt = 0;
    const onStats = (e: Event) => {
      lastAt = Date.now();
      setStats((e as CustomEvent<LifeStats>).detail);
      setStale(false);
    };
    window.addEventListener(LIFE_STATS_EVENT, onStats);
    const timer = window.setInterval(() => {
      if (Date.now() - lastAt > 1600) setStale(true);
    }, 800);
    return () => {
      window.removeEventListener(LIFE_STATS_EVENT, onStats);
      window.clearInterval(timer);
    };
  }, []);

  const lifeLive = stats !== null && !stale;

  return (
    <div className="container-x flex items-baseline justify-between gap-4 font-pixel text-[11px] tracking-wide">
      <span className="text-accent/60">
        {lifeLive ? "conway/life · torus · b3/s23" : "three.js/orbit · webgl"}
      </span>
      {lifeLive && (
        <span className="text-accent-bright/90">
          <span className="hidden sm:inline">{stats.preset} · </span>
          gen {String(stats.gen).padStart(4, "0")} · pop {String(stats.pop).padStart(3, "0")}
        </span>
      )}
    </div>
  );
}

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* Switchable backdrop: Game of Life automaton or the 3D orbit scene. */}
      <HeroBackdrop />
      {/* Vignette + gradient wash so text stays legible */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(var(--ink-rgb)/0.55)_70%,rgb(var(--ink-rgb)/0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-t from-ink to-transparent" />

      {/* Simulation readout, seated just below the fixed navbar */}
      <div className="absolute inset-x-0 top-20 z-10">
        <Readout />
      </div>

      <div className="container-x relative z-10 py-24">
        <div data-testid="hero-intro" className="max-w-4xl">
          <p className="mb-5 font-pixel text-xs lowercase leading-[1.9] tracking-wide text-accent sm:text-[13px]">
            {profile.title} — {profile.location}
            <br />
            {profile.status}
          </p>

          {/* Below sm the size derives from the viewport (name+cursor ≈ 11.15em
              in Departure Mono), so the single line can never wrap or clip. */}
          <h1 className="whitespace-nowrap font-name text-[calc((100vw-48px)/11.5)] uppercase leading-none text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            {profile.name}
            <span className="cursor-blink text-accent" aria-hidden>
              &#9646;
            </span>
          </h1>

          <p className="mt-6 max-w-xl font-pixel text-sm leading-relaxed text-white/70 sm:text-base">
            {profile.tagline}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-4 font-pixel text-sm lowercase">
            <a
              href="#projects"
              className="group inline-flex items-center gap-2 text-accent-bright transition-colors hover:text-white"
            >
              view projects
              <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href={profile.resume}
              className="group inline-flex items-center gap-2 text-accent-bright transition-colors hover:text-white"
            >
              resume
              <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
