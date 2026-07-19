"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  commentary,
  COMMENTARY_STORAGE_KEY,
  SOURCE_BASE,
  type CommentaryEntry,
} from "@/lib/commentary";

/**
 * Director's-commentary mode: a REC-style toggle (bottom right, mirroring the
 * film controls bottom left) that pins a numbered commentary track onto the
 * home sections. Each pin opens one card explaining how that section is
 * engineered, with a link to the real source on GitHub.
 *
 * Pins are portaled into their `section[id]` anchors — the same anchors the
 * navbar and the film system's section tracker already rely on — so the
 * registry stays a pure data file. v1 is home-page only.
 */
export default function CommentaryRoot() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  // Section anchors resolved after mount (portals need real DOM nodes).
  const [targets, setTargets] = useState<ReadonlyMap<string, HTMLElement>>(
    new Map()
  );
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());
  const cardRef = useRef<HTMLDivElement>(null);

  const onHome = pathname === "/";

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(COMMENTARY_STORAGE_KEY) === "1");
    } catch {
      // Private browsing: commentary just starts off.
    }
  }, []);

  // Re-resolve the section anchors whenever the route (re)renders the home
  // page; client-side navigation remounts the sections.
  useEffect(() => {
    if (!onHome || !enabled) {
      setTargets(new Map());
      return;
    }
    const found = new Map<string, HTMLElement>();
    for (const entry of commentary) {
      const el = document.getElementById(entry.section);
      if (el) found.set(entry.section, el);
    }
    setTargets(found);
  }, [onHome, enabled]);

  // One open card at a time: Escape or an outside press closes it and hands
  // focus back to its pin.
  useEffect(() => {
    if (!openSection) return;
    const close = () => {
      setOpenSection(null);
      pinRefs.current.get(openSection)?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPress = (event: PointerEvent) => {
      const card = cardRef.current;
      const pin = pinRefs.current.get(openSection);
      const target = event.target as Node;
      if (card?.contains(target) || pin?.contains(target)) return;
      setOpenSection(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [openSection]);

  useEffect(() => {
    // Focus the card when it opens so keyboard users land inside it.
    if (openSection) cardRef.current?.focus();
  }, [openSection]);

  const toggle = () => {
    setOpenSection(null);
    setEnabled((current) => {
      const next = !current;
      try {
        if (next) localStorage.setItem(COMMENTARY_STORAGE_KEY, "1");
        else localStorage.removeItem(COMMENTARY_STORAGE_KEY);
      } catch {
        // Storage blocked: the toggle still works for this visit.
      }
      return next;
    });
  };

  if (!onHome) return null;

  return (
    <div data-commentary={enabled ? "on" : "off"}>
      {/* The REC toggle — same pill dialect as the film controls, other corner. */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        title={enabled ? "Turn commentary off" : "How this site is built"}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-ink/80 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-white/70 shadow-xl shadow-black/30 backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:bottom-5 sm:right-5"
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            enabled ? "cursor-blink bg-red-500" : "bg-white/25"
          }`}
        />
        COMMENTARY{enabled ? "" : " OFF"}
      </button>

      {enabled &&
        commentary.map((entry) => {
          const target = targets.get(entry.section);
          if (!target) return null;
          return createPortal(
            <CommentaryPin
              key={entry.section}
              entry={entry}
              open={openSection === entry.section}
              onToggle={() =>
                setOpenSection((current) =>
                  current === entry.section ? null : entry.section
                )
              }
              pinRef={(el) => {
                if (el) pinRefs.current.set(entry.section, el);
                else pinRefs.current.delete(entry.section);
              }}
              cardRef={cardRef}
            />,
            target
          );
        })}
    </div>
  );
}

function CommentaryPin({
  entry,
  open,
  onToggle,
  pinRef,
  cardRef,
}: {
  entry: CommentaryEntry;
  open: boolean;
  onToggle: () => void;
  pinRef: (el: HTMLButtonElement | null) => void;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  // The hero fills the viewport from y=0; its pin drops below the navbar.
  const topClass = entry.section === "top" ? "top-24" : "top-10";
  const reel = String(entry.reel).padStart(2, "0");

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        ref={pinRef}
        aria-expanded={open}
        aria-label={`Commentary reel ${reel}: ${entry.title}`}
        data-commentary-pin={entry.section}
        className={`absolute left-4 z-40 flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] transition-colors sm:left-8 ${topClass} ${
          open
            ? "border-accent bg-accent text-ink"
            : "border-accent/60 bg-accent/10 text-accent hover:bg-accent/25"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      >
        {entry.reel}
        {/* Radar ring — a quiet "this is clickable" beacon. */}
        {!open && (
          <span
            aria-hidden
            className="absolute inset-[-5px] animate-ping rounded-full border border-accent/40 [animation-duration:2.4s]"
          />
        )}
      </button>

      {open && (
        <div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-label={`Commentary: ${entry.title}`}
          data-commentary-card={entry.section}
          className={`absolute left-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-white/10 border-l-2 border-l-accent bg-[rgb(var(--ink-rgb))] p-5 shadow-2xl shadow-black/60 outline-none sm:left-8 ${
            entry.section === "top" ? "top-36" : "top-[5.5rem]"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Reel {reel} · {entry.title}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            {entry.body}
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <a
              href={`${SOURCE_BASE}${entry.source}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-xs text-accent transition-colors hover:text-accent-bright"
            >
              {entry.source} →
            </a>
            <button
              type="button"
              onClick={onToggle}
              className="flex-none rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] text-white/60 transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
