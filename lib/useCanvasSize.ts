"use client";

import { useEffect, useRef, type RefObject } from "react";

export type CanvasSize = { width: number; height: number };

/**
 * Keeps a canvas's backing store matched to its CSS box AND the device pixel
 * ratio (capped at 2, so a retina phone never paints four times the pixels).
 * The 2D context transform is set to the DPR, so callers draw in CSS pixels.
 * Returns the CSS-pixel size in a ref, and re-fits on resize (the old games
 * sized once at mount and blurred on every rotation). `onResize` fires after a
 * re-fit — read the returned ref inside it.
 */
export function useCanvasSize(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onResize?: () => void
) {
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0 });
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext("2d");
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height };
      onResizeRef.current?.();
    };
    fit();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);

  return sizeRef;
}

/**
 * Keeps a canvas's backing store matched to its CSS box at 1:1 device pixels
 * (no DPR scaling), off the layout hot path via ResizeObserver. For games that
 * draw directly in the backing-store coordinate space. Optional `onResize`
 * fires after each observed change.
 */
export function useCanvasAutoSize(
  ref: RefObject<HTMLCanvasElement | null>,
  onResize?: () => void
) {
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const apply = () => {
      const width = Math.round(canvas.clientWidth);
      const height = Math.round(canvas.clientHeight);
      if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
      }
      onResizeRef.current?.();
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ref]);
}
