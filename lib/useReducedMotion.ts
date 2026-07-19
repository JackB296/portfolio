"use client";

import { useEffect, useState } from "react";

/**
 * Reactive prefers-reduced-motion: re-renders when the OS setting flips, so
 * long-lived pages honor a mid-session change. The one shared implementation
 * for canvas and scroll components; Framer Motion consumers keep framer's own
 * useReducedMotion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}
