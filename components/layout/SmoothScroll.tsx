"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "@/lib/useReducedMotion";

export const SCROLL_LOCK_EVENT = "portfolio:scroll-lock";
export const SCROLL_UNLOCK_EVENT = "portfolio:scroll-unlock";

export default function SmoothScroll() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Respect reduced-motion preference — reactive, so flipping the OS
    // setting mid-visit tears Lenis down (or brings it up) on the spot.
    if (reducedMotion) return;

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
      const el = document.querySelector(id) as HTMLElement | null;
      if (el) {
        e.preventDefault();
        if (id === "#top") {
          lenis.scrollTo(0);
          return;
        }
        // Land the section's heading just below the navbar — not the section's
        // padded top edge. Lenis scrolls the border-box top to its
        // scroll-margin-top, which leaves the section's own ~144px top padding
        // as a dead band above the title. Offsetting by that padding (and
        // cancelling the scroll-margin Lenis subtracts internally) drops the
        // heading to a fixed CLEARANCE below the viewport top, whatever each
        // section's padding happens to be.
        const style = getComputedStyle(el);
        const padTop = parseFloat(style.paddingTop) || 0;
        const scrollMargin = parseFloat(style.scrollMarginTop) || 0;
        const CLEARANCE = 96; // navbar height + breathing room
        lenis.scrollTo(el, { offset: scrollMargin + padTop - CLEARANCE });
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
  }, [reducedMotion]);

  return null;
}
