"use client";

import { motion } from "framer-motion";
import type { TheaterEntry } from "./theaterEntries";
import PosterArt from "./PosterArt";

type FilmSceneProps = {
  entry: TheaterEntry;
  previewed: boolean;
  selected: boolean;
  reduceMotion: boolean;
  onPreview: (entry: TheaterEntry) => void;
  onSelect: (entry: TheaterEntry) => void;
};

export default function FilmScene({
  entry,
  previewed,
  selected,
  reduceMotion,
  onPreview,
  onSelect,
}: FilmSceneProps) {
  return (
    <article data-film-scene={entry.id} className="min-w-0">
      <motion.button
        type="button"
        aria-label={`Use ${entry.film} grade`}
        aria-pressed={selected}
        title={`${entry.film} (${entry.year})`}
        onPointerEnter={() => onPreview(entry)}
        onFocus={() => onPreview(entry)}
        onClick={() => onSelect(entry)}
        animate={
          reduceMotion
            ? false
            : {
                y: previewed ? -3 : 0,
                scale: previewed ? 1.018 : 1,
              }
        }
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="group block w-full text-left focus-visible:outline-none"
      >
        <span
          className={`relative block aspect-[2/3] overflow-hidden rounded-[3px] border bg-black/30 shadow-lg transition-[border-color,box-shadow,opacity] duration-200 ${
            previewed
              ? "border-accent shadow-[0_14px_34px_rgba(0,0,0,0.55)]"
              : "border-white/15 opacity-80 shadow-black/35 group-hover:opacity-100"
          } ${selected ? "ring-1 ring-inset ring-white/75" : ""}`}
        >
          <span className="absolute inset-0 block">
            <PosterArt
              id={entry.id}
              film={entry.film}
              ink={entry.ink}
              accent={entry.accent}
            />
          </span>
          <span
            className={`absolute inset-x-0 bottom-0 flex min-h-[48%] translate-y-2 flex-col justify-end bg-gradient-to-t from-black via-black/80 to-transparent px-2 pb-2 pt-8 text-white transition-[opacity,transform] duration-200 sm:px-1.5 lg:px-2 ${
              previewed
                ? "translate-y-0 opacity-100"
                : "opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            }`}
          >
            <span className="mb-1 flex items-center justify-between gap-1 font-mono text-[6px] uppercase tracking-[0.12em] text-white/60 sm:text-[5px] lg:text-[6px]">
              <span>{entry.year}</span>
              <span aria-hidden="true" className="h-px w-3 bg-accent" />
            </span>
            <span className="line-clamp-2 text-[9px] font-semibold uppercase leading-[1.02] tracking-[-0.025em] sm:text-[7px] lg:text-[9px]">
              {entry.film}
            </span>
            <span className="mt-1 line-clamp-2 text-[6px] leading-[1.15] text-white/65 sm:text-[5px] lg:text-[6px]">
              {entry.vibe}
            </span>
          </span>
          {selected && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[3px] bg-accent"
            />
          )}
        </span>
      </motion.button>
    </article>
  );
}
