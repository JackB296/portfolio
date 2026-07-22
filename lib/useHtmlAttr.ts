"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Observe a single attribute on <html>, invoking `onChange` when it changes.
 * Returns a disconnect function. The grade/film-mode systems write these
 * attributes (data-grade, data-film-mode) from React effects and a pre-paint
 * boot script, so a one-shot read misses later changes — watch the attribute.
 *
 * Effects that need bespoke handling (see HeroBackdrop) use this directly; most
 * components want {@link useHtmlAttr} instead.
 */
export function observeHtmlAttr(attr: string, onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [attr],
  });
  return () => observer.disconnect();
}

/** Re-renders when the given <html> attribute changes. SSR renders `null`. */
export function useHtmlAttr(attr: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => observeHtmlAttr(attr, onChange),
    [attr]
  );
  const getSnapshot = useCallback(
    () =>
      typeof document === "undefined"
        ? null
        : document.documentElement.getAttribute(attr),
    [attr]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** The committed film grade id, or null under the house. */
export function useCommittedGrade(): string | null {
  return useHtmlAttr("data-grade");
}

/**
 * True while no film grade is committed. lib/grades deletes data-grade for the
 * house and writes the film id for everything else. SSR-safe (assumes house).
 */
export function isHouse(): boolean {
  if (typeof document === "undefined") return true;
  return !document.documentElement.dataset.grade;
}
