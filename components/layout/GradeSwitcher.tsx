"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGrade,
  commitGrade,
  GRADE_EVENT,
  type FilmGrade,
  type GradeChangeDetail,
} from "@/lib/grades";
import { HOUSE_FILM } from "@/lib/films";
import TheaterDialog from "./TheaterDialog";
import { THEATER_ENTRIES } from "./theaterEntries";
import { TheaterIcon } from "../ui/icons";

export default function GradeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [initialGradeId, setInitialGradeId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setActive(document.documentElement.dataset.grade ?? null);
    // Track grade changes from every dispatcher — the guest terminal, the
    // dialog's own previews — so the Now Showing label always names the
    // grade the visitor is looking at.
    const onGradeChange = (event: Event) => {
      const detail = (event as CustomEvent<GradeChangeDetail>).detail;
      setActive(detail?.gradeId ?? null);
    };
    window.addEventListener(GRADE_EVENT, onGradeChange);
    return () => window.removeEventListener(GRADE_EVENT, onGradeChange);
  }, []);

  const select = (grade: FilmGrade | null) => {
    // Grade-change protocol (see GradeChangeIntent in lib/grades.ts): a
    // selection commits — it persists and arms sound downstream.
    commitGrade(grade);
    setActive(grade?.id ?? null);
  };

  const nowPlaying = getGrade(active)?.film ?? HOUSE_FILM;
  const openTheater = () => {
    setInitialGradeId(active);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openTheater}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Open film theater. Now playing: ${nowPlaying}`}
        title="Film theater"
        data-now-showing={active ?? "house"}
        className="flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-white/10 text-white/60 transition-colors hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-9 md:w-9 md:border-transparent lg:w-auto lg:border-white/10 lg:px-3"
      >
        <TheaterIcon className="h-[18px] w-[18px] flex-none" />
        {/* The marquee: names the grade the visitor is looking at. */}
        <span
          className={`hidden max-w-40 truncate font-pixel text-[11px] lowercase tracking-wide lg:inline ${
            active ? "text-accent" : ""
          }`}
        >
          {active ? nowPlaying : "Theater"}
        </span>
      </button>

      <TheaterDialog
        open={open}
        entries={THEATER_ENTRIES}
        activeId={active}
        initialGradeId={initialGradeId}
        triggerRef={triggerRef}
        onClose={close}
        onSelect={select}
      />
    </>
  );
}
