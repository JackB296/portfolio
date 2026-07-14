"use client";

import Image from "next/image";
import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { FilmGrade } from "@/lib/grades";
import PosterArt from "./PosterArt";

export type TheaterEntry = {
  id: string;
  film: string;
  year: string;
  vibe: string;
  ink: string;
  accent: string;
  poster?: string;
  grade: FilmGrade | null;
};

type FilmSceneProps = {
  entry: TheaterEntry;
  active: boolean;
  selected: boolean;
  reduceMotion: boolean;
  onSelect: (entry: TheaterEntry) => void;
};

const FilmScene = forwardRef<HTMLElement, FilmSceneProps>(function FilmScene(
  { entry, active, selected, reduceMotion, onSelect },
  ref
) {
  return (
    <section
      ref={ref}
      data-film-scene={entry.id}
      aria-labelledby={`film-${entry.id}`}
      aria-current={active ? "true" : undefined}
      className="flex min-h-full snap-start items-center py-6 sm:py-8 lg:py-10"
    >
      <motion.div
        animate={
          reduceMotion
            ? { opacity: 1 }
            : { opacity: active ? 1 : 0.42, y: active ? 0 : 18, scale: active ? 1 : 0.97 }
        }
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="container-x grid w-full items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
      >
        <div className="mx-auto w-full max-w-[190px] sm:max-w-[260px] lg:max-w-[320px]">
          <div
            className={`aspect-[2/3] overflow-hidden rounded-md border bg-black/20 shadow-2xl transition-colors duration-500 ${
              active ? "border-accent/80 shadow-black/50" : "border-white/15 shadow-black/30"
            }`}
          >
            {entry.poster ? (
              <Image
                src={entry.poster}
                alt={`${entry.film} poster`}
                width={640}
                height={960}
                sizes="(max-width: 1024px) 260px, 320px"
                className="h-full w-full object-cover"
              />
            ) : (
              <PosterArt
                id={entry.id}
                film={entry.film}
                year={entry.year}
                ink={entry.ink}
                accent={entry.accent}
              />
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-white/45 lg:justify-start">
            <span>{entry.year}</span>
            {selected && <span className="text-accent">Selected grade</span>}
          </div>
          <h3
            id={`film-${entry.id}`}
            className="mt-2 text-3xl font-semibold leading-[0.98] tracking-tight text-white sm:mt-3 sm:text-5xl lg:text-6xl"
          >
            {entry.film}
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/65 sm:mt-5 sm:text-lg lg:mx-0">
            {entry.vibe}
          </p>
          <button
            type="button"
            aria-label={`Use ${entry.film} grade`}
            aria-pressed={selected}
            title={`${entry.film} (${entry.year})`}
            onClick={() => onSelect(entry)}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:mt-7"
          >
            {selected ? "Keep this grade" : "Use this grade"}
          </button>
        </div>
      </motion.div>
    </section>
  );
});

export default FilmScene;
