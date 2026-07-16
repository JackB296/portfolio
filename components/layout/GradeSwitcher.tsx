"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  grades,
  getGrade,
  applyGrade,
  GRADE_STORAGE_KEY,
  type FilmGrade,
} from "@/lib/grades";
import TheaterDialog from "./TheaterDialog";
import type { TheaterEntry } from "./FilmScene";
import { TheaterIcon } from "../ui/icons";

const HOUSE: TheaterEntry = {
  id: "house",
  film: "House Grade",
  year: "2026",
  vibe: "The portfolio's original emerald signal",
  ink: "5 6 10",
  accent: "52 211 153",
  grade: null,
};

const ENTRIES: TheaterEntry[] = [
  HOUSE,
  ...grades.map((grade) => ({
    id: grade.id,
    film: grade.film,
    year: String(grade.year),
    vibe: grade.vibe,
    ink: grade.ink,
    accent: grade.accent,
    grade,
  })),
];

export default function GradeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [initialGradeId, setInitialGradeId] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setActive(document.documentElement.dataset.grade ?? null);
  }, []);

  const select = (grade: FilmGrade | null) => {
    applyGrade(grade);
    setActive(grade?.id ?? null);
    try {
      if (grade) localStorage.setItem(GRADE_STORAGE_KEY, grade.id);
      else localStorage.removeItem(GRADE_STORAGE_KEY);
    } catch {
      // Private browsing can block storage; the grade still applies this visit.
    }
  };

  const nowPlaying = getGrade(active)?.film ?? "House Grade";
  const openTheater = () => {
    setInitialGradeId(active);
    setSession((value) => value + 1);
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
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-9 md:w-9 md:border-transparent"
      >
        <TheaterIcon className="h-[18px] w-[18px]" />
      </button>

      <TheaterDialog
        open={open}
        session={session}
        entries={ENTRIES}
        activeId={active}
        initialGradeId={initialGradeId}
        triggerRef={triggerRef}
        onClose={close}
        onSelect={select}
      />
    </>
  );
}
