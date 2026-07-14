"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { applyGrade, getGrade, type FilmGrade } from "@/lib/grades";
import FilmScene, { type TheaterEntry } from "./FilmScene";
import { SCROLL_LOCK_EVENT, SCROLL_UNLOCK_EVENT } from "./SmoothScroll";

type TheaterDialogProps = {
  open: boolean;
  session: number;
  entries: TheaterEntry[];
  activeId: string | null;
  initialGradeId: string | null;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onSelect: (grade: FilmGrade | null) => void;
};

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const toRgb = (triplet: string) => `rgb(${triplet.split(" ").join(", ")})`;

export default function TheaterDialog({
  open,
  session,
  entries,
  activeId,
  initialGradeId,
  triggerRef,
  onClose,
  onSelect,
}: TheaterDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sceneRefs = useRef(new Map<string, HTMLElement>());
  const committedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState({ session: 0, id: "house" });
  const focusedId = focus.session === session ? focus.id : initialGradeId ?? "house";
  const focusedEntry = entries.find((entry) => entry.id === focusedId) ?? entries[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    committedRef.current = false;
    const startingId = initialGradeId ?? "house";
    if (startingId !== "house") {
      sceneRefs.current.get(startingId)?.scrollIntoView({ block: "start" });
    }
  }, [initialGradeId, open, session]);

  useEffect(() => {
    if (!open) return;
    applyGrade(focusedEntry.grade);
  }, [focusedEntry, open]);

  useEffect(() => {
    if (!open || !scrollerRef.current) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const centered = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = (centered?.target as HTMLElement | undefined)?.dataset.filmScene;
        if (id) setFocus({ session, id });
      },
      {
        root: scrollerRef.current,
        rootMargin: "-35% 0px -35% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sceneRefs.current.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, [open, session]);

  useEffect(() => {
    if (!open) return;

    const scrollPosition = window.scrollY;
    const trigger = triggerRef.current;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    window.dispatchEvent(new Event(SCROLL_LOCK_EVENT));
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (!committedRef.current) applyGrade(getGrade(initialGradeId) ?? null);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollPosition);
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      window.dispatchEvent(new Event(SCROLL_UNLOCK_EVENT));
      trigger?.focus();
    };
  }, [initialGradeId, onClose, open, triggerRef]);

  const selectEntry = (entry: TheaterEntry) => {
    committedRef.current = true;
    onSelect(entry.grade);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-theater-backdrop
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[70] flex h-[100dvh] w-screen items-center justify-center bg-black/35 p-2 backdrop-blur-[2px] sm:p-4 lg:p-8"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Film theater"
            initial={reduceMotion ? false : { scale: 0.965, y: 12 }}
            animate={{
              scale: 1,
              y: 0,
              backgroundColor: toRgb(focusedEntry.ink),
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-white/10 shadow-2xl shadow-black/60 sm:h-[86dvh] sm:w-[90vw] lg:h-[82dvh] lg:w-[84vw] lg:max-w-[1180px]"
          >
            <motion.div
              aria-hidden="true"
              animate={{ backgroundColor: toRgb(focusedEntry.accent) }}
              transition={{ duration: reduceMotion ? 0 : 0.7 }}
              className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full opacity-15 blur-[120px]"
            />
            <header className="relative z-20 flex-none border-b border-white/10 bg-black/25 backdrop-blur-xl">
              <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    Film theater
                  </h2>
                  <p className="truncate font-mono text-xs text-white/50">
                    Previewing <span className="text-accent">{focusedEntry.film}</span>
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close theater"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/15 text-xl leading-none text-white/70 transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </header>

            <main
              ref={scrollerRef}
              data-lenis-prevent
              className={`relative z-10 min-h-0 flex-1 snap-y snap-proximity overflow-y-auto overscroll-contain ${
                reduceMotion ? "scroll-auto" : "scroll-smooth"
              }`}
            >
              {entries.map((entry) => (
                <FilmScene
                  key={entry.id}
                  ref={(scene) => {
                    if (scene) sceneRefs.current.set(entry.id, scene);
                    else sceneRefs.current.delete(entry.id);
                  }}
                  entry={entry}
                  active={entry.id === focusedEntry.id}
                  selected={(entry.grade?.id ?? null) === activeId}
                  reduceMotion={Boolean(reduceMotion)}
                  onSelect={selectEntry}
                />
              ))}
            </main>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
