"use client";

import { useRef, type RefObject } from "react";
import { BOWEL_INDEX, collisionAt, NIGHTS } from "./FightClubTouristData";

// The scheduling board: seven rooms, two names. Every room starts pinned to
// you (the greedy tourist); tap a room — or drag it sideways — to cede it.
// Collisions highlight live: rooms you both want, and rooms she never asked
// for. Bowel cancer is her hill; keeping it is allowed, but it costs.

export type RoomOwner = "mine" | "hers";

type Props = Readonly<{
  assignment: readonly RoomOwner[];
  onToggle: (index: number) => void;
  onSettle: () => void;
  firstChipRef?: RefObject<HTMLButtonElement>;
}>;

export default function FightClubTouristBoard({
  assignment,
  onToggle,
  onSettle,
  firstChipRef,
}: Props) {
  // One pointer at a time; a horizontal drag past the threshold toggles the
  // chip and swallows the click that follows so it never double-fires.
  const dragRef = useRef<{ x: number; dragged: boolean } | null>(null);

  const collisions = NIGHTS.map((_, index) => collisionAt(assignment, index));
  const hardCount = collisions.filter((hit, index) => hit && index !== BOWEL_INDEX).length;
  const bowelKept = assignment[BOWEL_INDEX] === "mine";

  const footer =
    hardCount > 0
      ? `${hardCount} collision${hardCount > 1 ? "s" : ""}`
      : bowelKept
        ? "She wants bowel cancer — keeping it will cost"
        : "No collisions";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        Split the week &mdash; tap or drag a room across
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {NIGHTS.map((room, index) => {
          const mine = assignment[index] === "mine";
          const collide = collisions[index];
          const label = !collide
            ? null
            : room.marla
              ? index === BOWEL_INDEX
                ? "she wants this"
                : "both of you"
              : "she won't take it";
          return (
            <button
              key={room.group}
              ref={index === 0 ? firstChipRef : undefined}
              type="button"
              aria-pressed={!mine}
              onPointerDown={(event) => {
                dragRef.current = { x: event.clientX, dragged: false };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.dragged || event.buttons === 0) return;
                if (Math.abs(event.clientX - drag.x) > 36) {
                  drag.dragged = true;
                  onToggle(index);
                }
              }}
              onClick={() => {
                const dragged = dragRef.current?.dragged;
                dragRef.current = null;
                if (!dragged) onToggle(index);
              }}
              className={`flex select-none items-center justify-between gap-3 border px-3 py-1.5 text-[11px] transition-colors [touch-action:none] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                collide ? "border-dashed border-white/70" : "border-accent/30"
              }`}
            >
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="truncate normal-case text-white/85">{room.group}</span>
                <span className="text-[9px] uppercase tracking-[0.14em] text-white/40">
                  {room.marla ? "her claim" : "yours all week"}
                  {label && (
                    <span className={index === BOWEL_INDEX && collide ? "animate-pulse" : ""}>
                      {" "}&middot; &#10005; {label}
                    </span>
                  )}
                </span>
              </span>
              <span
                aria-hidden
                className="relative h-5 w-24 shrink-0 border border-accent/20 text-[9px] uppercase tracking-[0.1em]"
              >
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/30">you</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30">her</span>
                <span
                  className={`absolute top-0 flex h-full w-12 items-center justify-center border bg-accent/20 transition-transform duration-200 ${
                    mine
                      ? "translate-x-0 border-accent/60 text-accent"
                      : "translate-x-12 border-accent/40 text-white/80"
                  }`}
                >
                  {mine ? "you" : "her"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{footer}</p>
        <button
          type="button"
          onClick={onSettle}
          className="shrink-0 border border-accent/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-transform hover:bg-accent/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Settle the week
        </button>
      </div>
    </div>
  );
}
