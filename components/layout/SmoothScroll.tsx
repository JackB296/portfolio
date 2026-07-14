"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export const SCROLL_LOCK_EVENT = "portfolio:scroll-lock";
export const SCROLL_UNLOCK_EVENT = "portfolio:scroll-unlock";

export default function SmoothScroll() {
  useEffect(() => {
    // Respect reduced-motion preference
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    const stop = () => lenis.stop();
    const start = () => lenis.start();
    window.addEventListener(SCROLL_LOCK_EVENT, stop);
    window.addEventListener(SCROLL_UNLOCK_EVENT, start);

    // Intercept in-page anchor clicks for smooth scroll
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest(
        'a[href^="#"]'
      ) as HTMLAnchorElement | null;
      if (!target) return;
      const id = target.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el as HTMLElement, { offset: -80 });
      }
    };
    document.addEventListener("click", onClick);

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(SCROLL_LOCK_EVENT, stop);
      window.removeEventListener(SCROLL_UNLOCK_EVENT, start);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
