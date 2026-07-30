"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { applyGrade, getGrade, type FilmGrade } from "@/lib/grades";
import { HOUSE_ID } from "@/lib/films";
import { profile } from "@/lib/data";
import { useFocusTrap } from "@/lib/useFocusTrap";
import FilmScene from "./FilmScene";
import type { TheaterEntry } from "./theaterEntries";
import PosterArt from "./PosterArt";
import { SCROLL_LOCK_EVENT, SCROLL_UNLOCK_EVENT } from "./SmoothScroll";

type TheaterDialogProps = {
  open: boolean;
  entries: readonly TheaterEntry[];
  activeId: string | null;
  initialGradeId: string | null;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onSelect: (grade: FilmGrade | null) => void;
};

const toRgb = (triplet: string) => `rgb(${triplet.split(" ").join(", ")})`;
const matchesSearch = (entry: TheaterEntry, query: string) =>
  `${entry.film} ${entry.year} ${entry.vibe}`.toLocaleLowerCase().includes(query);
// The one place the search predicate lives — both the rendered list and the
// focus-after-typing logic filter through this so they can't diverge.
const filterEntries = (list: readonly TheaterEntry[], query: string) =>
  query ? list.filter((entry) => matchesSearch(entry, query)) : list;

export default function TheaterDialog({
  open,
  entries,
  activeId,
  initialGradeId,
  triggerRef,
  onClose,
  onSelect,
}: TheaterDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const committedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  // null = nothing previewed yet this visit, so focus follows the grade that
  // was active when the theater opened.
  const [focusId, setFocusId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredEntries = useMemo(
    () => filterEntries(entries, normalizedQuery),
    [entries, normalizedQuery]
  );
  const requestedId = focusId ?? initialGradeId ?? HOUSE_ID;
  const focusedEntry =
    filteredEntries.find((entry) => entry.id === requestedId) ??
    filteredEntries[0] ??
    entries.find((entry) => entry.id === requestedId) ??
    entries[0];
  const focusedReview = focusedEntry?.review;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    committedRef.current = false;
  }, [open]);

  // Closing ends the visit: clear the search and focus so reopening starts
  // with an empty query focused on the then-current grade.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setFocusId(null);
  }, [open]);

  useEffect(() => {
    if (!open || !focusedEntry) return;
    // Grade-change protocol (see GradeChangeIntent in lib/grades.ts):
    // browsing the wall previews; it never persists or arms sound.
    applyGrade(focusedEntry.grade, "preview");
  }, [focusedEntry, open]);

  useFocusTrap(dialogRef, open, onClose, closeRef);

  useEffect(() => {
    if (!open) return;

    const scrollPosition = window.scrollY;
    const trigger = triggerRef.current;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    window.dispatchEvent(new Event(SCROLL_LOCK_EVENT));
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      if (!committedRef.current) {
        // Grade-change protocol (see GradeChangeIntent in lib/grades.ts):
        // closing without a commit restores the committed grade.
        applyGrade(getGrade(initialGradeId) ?? null, "restore");
      }
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.scrollTo(0, scrollPosition);
      window.dispatchEvent(new Event(SCROLL_UNLOCK_EVENT));
      trigger?.focus();
    };
  }, [initialGradeId, open, triggerRef]);

  const previewEntry = (entry: TheaterEntry) => {
    setFocusId(entry.id);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    const nextQuery = value.trim().toLocaleLowerCase();
    const firstMatch = nextQuery
      ? filterEntries(entries, nextQuery)[0]
      : entries.find((entry) => entry.id === initialGradeId) ?? entries[0];
    if (firstMatch) setFocusId(firstMatch.id);
  };

  const selectEntry = (entry: TheaterEntry) => {
    committedRef.current = true;
    onSelect(entry.grade);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && focusedEntry && (
        <motion.div
          data-theater-backdrop
          initial={false}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[70] flex h-[100dvh] w-screen items-center justify-center bg-black/40 p-2 backdrop-blur-[3px] sm:p-4 lg:p-8"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Film theater"
            initial={reduceMotion ? false : { scale: 0.975, y: 10 }}
            animate={{
              scale: 1,
              y: 0,
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 6 }}
            transition={{
              duration: reduceMotion ? 0 : 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ backgroundColor: toRgb(focusedEntry.ink) }}
            className="relative flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-white/10 shadow-2xl shadow-black/60 sm:h-[86dvh] sm:w-[90vw] lg:h-[78dvh] lg:w-[84vw] lg:max-w-[1180px]"
          >
            <motion.div
              aria-hidden="true"
              animate={{ backgroundColor: toRgb(focusedEntry.accent) }}
              transition={{ duration: reduceMotion ? 0 : 0.55 }}
              className="pointer-events-none absolute -right-20 top-1/4 h-64 w-64 rounded-full opacity-[0.12] blur-[110px]"
            />

            <header className="relative z-20 flex-none border-b border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl sm:px-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(160px,0.65fr)_minmax(240px,1fr)_auto] sm:gap-x-5">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                    Film theater
                  </h2>
                  <p className="truncate font-mono text-[10px] text-white/45 sm:text-xs">
                    {filteredEntries.length} of {entries.length} covers
                  </p>
                </div>

                <label className="relative col-span-2 row-start-2 block sm:col-span-1 sm:row-auto">
                  <span className="sr-only">Search films</span>
                  <input
                    type="search"
                    role="searchbox"
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder="Search title, year, or atmosphere"
                    autoComplete="off"
                    className="h-10 w-full rounded-md border border-white/15 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>

                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close theater"
                  title="Close theater"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/15 text-xl leading-none text-white/70 transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </header>

            <main className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div
                data-theater-catalog
                data-lenis-prevent
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 ${
                  reduceMotion ? "scroll-auto" : "scroll-smooth"
                }`}
              >
                {filteredEntries.length > 0 ? (
                  <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 sm:grid-cols-6 sm:gap-x-3 lg:grid-cols-9 lg:gap-x-3.5">
                    {filteredEntries.map((entry) => (
                      <FilmScene
                        key={entry.id}
                        entry={entry}
                        previewed={entry.id === focusedEntry.id}
                        selected={(entry.grade?.id ?? null) === activeId}
                        reduceMotion={Boolean(reduceMotion)}
                        onPreview={previewEntry}
                        onSelect={selectEntry}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid h-full min-h-36 place-items-center text-center">
                    <div>
                      <p className="text-sm font-medium text-white/75">
                        No films match that search.
                      </p>
                      <button
                        type="button"
                        onClick={() => updateQuery("")}
                        className="mt-2 text-xs text-accent underline decoration-accent/50 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <section
                data-theater-detail
                aria-live="polite"
                className="flex min-h-[124px] flex-none items-start gap-3 border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl sm:min-h-[116px] sm:gap-4 sm:px-6"
              >
                <div className="relative hidden aspect-[2/3] w-[52px] flex-none overflow-hidden rounded-[3px] border border-white/15 sm:block sm:w-[60px]">
                  <PosterArt
                    id={focusedEntry.id}
                    film={focusedEntry.film}
                    ink={focusedEntry.ink}
                    accent={focusedEntry.accent}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                      {focusedEntry.year}
                      {(focusedEntry.grade?.id ?? null) === activeId ? " / current grade" : ""}
                      <span aria-hidden="true"> / </span>
                      <a
                        href="/film-credits"
                        className="text-white/55 underline decoration-white/20 underline-offset-2 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Media credits
                      </a>
                    </p>
                    {focusedReview && (
                      <span className="flex flex-none items-center gap-1.5">
                        <Stars rating={focusedReview.rating} />
                        <span className="font-mono text-[11px] text-white/55">
                          {focusedReview.rating.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                  <h3 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {focusedEntry.film}
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/70 sm:text-sm">
                    {focusedReview ? focusedReview.body : focusedEntry.vibe}
                  </p>
                  {/* The games are invisible until a visitor commits to a
                      grade and finds the control pill, so the catalog says
                      up front which covers have something to play. */}
                  {(focusedEntry.gameCount > 0 || focusedReview) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {focusedEntry.gameCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                          <span aria-hidden="true" className="text-[8px] leading-none">
                            ▶
                          </span>
                          {focusedEntry.gameCount}{" "}
                          {focusedEntry.gameCount === 1 ? "game" : "games"} inside
                        </span>
                      )}
                      {focusedReview && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                          Reviewed by {profile.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </main>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Five stars filled to `rating`/5 in the active accent, with a text fallback
 * for screen readers. Half and quarter ratings render as a partial fill. */
function Stars({ rating }: { rating: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className="relative inline-flex text-[13px] leading-none tracking-[0.1em]">
      <span aria-hidden="true" className="text-white/20">
        ★★★★★
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-accent"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
      <span className="sr-only">{`Rated ${rating} out of 5`}</span>
    </span>
  );
}
