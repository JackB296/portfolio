"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

/** Keys that scroll a page, which a game is entitled to own instead. */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/** True when the event is going somewhere that legitimately wants these keys. */
function isTextEntry(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

type SimulationDialogProps = {
  /** Id for the dialog heading (aria-labelledby wiring). */
  titleId: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  /** Focused when the dialog opens. */
  initialFocusRef: RefObject<HTMLButtonElement>;
  /** Tailwind max-width class for the panel — e.g. "max-w-sm", "max-w-4xl". */
  widthClassName: string;
  /** aria-label for the esc/close button. */
  closeLabel: string;
  /** Games own arrow/space/page keys so the site behind can't scroll; menus don't. */
  ownsKeyboard?: boolean;
  /** Rendered to the left of the title (e.g. a "← back" button). */
  headerLead?: ReactNode;
  /** Extra classes for the panel (e.g. responsive padding). */
  panelClassName?: string;
  children: ReactNode;
};

/**
 * The shared modal chrome every simulation surface wears: the backdrop (with
 * click-out close), the focus-trapped graded panel, the body scroll-lock, and
 * the eyebrow/title/esc header. Both the per-game reference card
 * (SimulationShell) and the multi-game launcher (SimulationMenu) compose this;
 * the body below the header is theirs.
 */
export default function SimulationDialog({
  titleId,
  eyebrow,
  title,
  onClose,
  initialFocusRef,
  widthClassName,
  closeLabel,
  ownsKeyboard = false,
  headerLead,
  panelClassName = "",
  children,
}: SimulationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, true, onClose, initialFocusRef);

  // The surface owns the page while open: the site behind must not scroll, and
  // (for games) arrow/space must drive the game rather than the document.
  // Without this, holding a key to steer also scrolls the portfolio out from
  // under the game.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    let onKeyDown: ((event: KeyboardEvent) => void) | undefined;
    if (ownsKeyboard) {
      onKeyDown = (event: KeyboardEvent) => {
        if (!SCROLL_KEYS.has(event.key)) return;
        if (isTextEntry(event.target)) return;
        // The game's own handlers still run — this only stops the document.
        event.preventDefault();
      };
      window.addEventListener("keydown", onKeyDown, { passive: false });
    }

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
    };
  }, [ownsKeyboard]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // data-lenis-prevent keeps the smooth-scroll engine off this subtree, so
        // a wheel over the dialog scrolls the dialog and nothing behind it.
        data-lenis-prevent
        className={`w-full ${widthClassName} max-h-[92dvh] overflow-y-auto overscroll-contain border border-accent/40 bg-ink/95 p-4 font-mono text-accent shadow-2xl shadow-black/60 ${panelClassName}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {headerLead}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{eyebrow}</p>
              <h2 id={titleId} className="mt-1 text-sm uppercase tracking-[0.12em]">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="px-2 py-1 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            esc
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
