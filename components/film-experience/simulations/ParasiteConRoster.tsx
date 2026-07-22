"use client";

import { CON_STEPS } from "@/components/film-experience/simulations/ParasiteConData";

/**
 * The persistent dossier board. It is on screen for the whole con, not shown
 * once and dismissed, because the ordering puzzle is meant to be solved by
 * reading it: who each person is, what the house will believe, what they carry,
 * what has to be true before they can walk in, and what having them inside
 * makes possible for whoever comes next.
 */

type Props = {
  /** How many posts are filled — everything below this index is inside. */
  placed: number;
  /** Index currently mid-placement (cover story / cross-question). */
  pending: number | null;
  /** Index of the last person who could not go yet, highlighted with the reason. */
  flagged: number | null;
  reducedMotion: boolean;
};

const FIELD_LABELS = {
  passesAs: "passes as",
  carries: "carries",
  wayIn: "way in",
  unlocks: "once inside",
} as const;

export default function ParasiteConRoster({
  placed,
  pending,
  flagged,
  reducedMotion,
}: Props) {
  return (
    <section
      aria-label="Dossiers on the four people waiting to get in"
      className="flex flex-col gap-2"
    >
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/45">
        Who is waiting outside
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CON_STEPS.map((entry, index) => {
          const inside = index < placed;
          const isPending = pending === index;
          const isFlagged = flagged === index;
          const state = inside
            ? `inside · post ${index + 1}`
            : isPending
              ? "at the door"
              : "outside";
          return (
            <li
              key={entry.name}
              data-con-person={entry.name}
              data-con-inside={inside ? "yes" : "no"}
              className={`flex flex-col gap-1 border p-2 text-[11px] normal-case leading-relaxed transition-colors ${
                inside
                  ? "border-accent/50 bg-accent/5 text-white/75"
                  : isFlagged
                    ? "border-accent-bright/60 bg-accent/5 text-white/70"
                    : "border-white/12 text-white/55"
              } ${isFlagged && !reducedMotion ? "para-shake" : ""}`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="uppercase tracking-[0.1em] text-accent">{entry.name}</span>
                <span className="text-white/45">{entry.family}</span>
                <span
                  className={`ml-auto text-[9px] uppercase tracking-[0.14em] ${
                    inside ? "text-accent-bright" : "text-white/35"
                  }`}
                >
                  {inside ? "✓ " : "○ "}
                  {state}
                </span>
              </p>
              <p>
                <span className="text-white/35">{FIELD_LABELS.passesAs}: </span>
                {entry.passesAs}
              </p>
              <p>
                <span className="text-white/35">{FIELD_LABELS.carries}: </span>
                {entry.carries}
              </p>
              <p>
                <span className="text-white/35">{FIELD_LABELS.wayIn}: </span>
                {entry.wayIn}
              </p>
              <p>
                <span className="text-white/35">{FIELD_LABELS.unlocks}: </span>
                {entry.unlocks}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
