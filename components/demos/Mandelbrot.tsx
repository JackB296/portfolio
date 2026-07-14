"use client";

import { useEffect, useRef, useState } from "react";

// Mandelbrot set by escape-time iteration (z = z*z + c, escape when |z| > 2),
// faithful to my Python/NumPy notebook. Click to zoom in, with a "hot" colormap.
export default function Mandelbrot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const [zoomLabel, setZoomLabel] = useState("1x");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // View: center in the complex plane + span (width) in real units.
    const initial = { cx: -0.6, cy: 0, span: 3.2 };
    let view = { ...initial };
    let W = 1, H = 1;

    const render = () => {
      const maxIter = Math.round(120 + Math.log2(initial.span / view.span) * 60);
      const img = ctx.createImageData(W, H);
      const data = img.data;
      const unit = view.span / W; // real units per pixel
      const reMin = view.cx - (W / 2) * unit;
      const imMin = view.cy - (H / 2) * unit;
      for (let py = 0; py < H; py++) {
        const ci = imMin + py * unit;
        for (let px = 0; px < W; px++) {
          const cr = reMin + px * unit;
          let zr = 0, zi = 0, n = 0;
          while (n < maxIter) {
            const zr2 = zr * zr;
            const zi2 = zi * zi;
            if (zr2 + zi2 > 4) break;
            zi = 2 * zr * zi + ci;
            zr = zr2 - zi2 + cr;
            n++;
          }
          const o = (py * W + px) * 4;
          if (n >= maxIter) {
            data[o] = data[o + 1] = data[o + 2] = 0;
          } else {
            // Smooth + "hot" colormap (black -> red -> orange -> yellow -> white).
            const t = Math.pow(n / maxIter, 0.5);
            data[o] = Math.min(255, t * 3 * 255);
            data[o + 1] = Math.min(255, Math.max(0, (t * 3 - 1) * 255));
            data[o + 2] = Math.min(255, Math.max(0, (t * 3 - 2) * 255));
          }
          data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      setZoomLabel(`${(initial.span / view.span).toFixed(1)}x`);
    };

    const resize = () => {
      const cssW = Math.max(1, canvas.getBoundingClientRect().width);
      W = Math.min(560, Math.round(cssW));
      H = Math.round(W * 0.66);
      canvas.width = W;
      canvas.height = H;
      render();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const r = canvas.getBoundingClientRect();
      const unit = view.span / W;
      const reMin = view.cx - (W / 2) * unit;
      const imMin = view.cy - (H / 2) * unit;
      const px = ((clientX - r.left) / r.width) * W;
      const py = ((clientY - r.top) / r.height) * H;
      view.cx = reMin + px * unit;
      view.cy = imMin + py * unit;
      view.span *= factor;
      render();
    };

    const onClick = (e: MouseEvent) => zoomAt(e.clientX, e.clientY, 0.5);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 0.7 : 1 / 0.7);
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const reset = () => { view = { ...initial }; render(); };
    resetRef.current = reset;

    return () => {
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none select-none"
          style={{ imageRendering: "pixelated" }}
        />
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 font-mono text-xs text-accent backdrop-blur">
          {zoomLabel}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => resetRef.current()}
          className="rounded-full border border-white/15 px-5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent/50 hover:text-white"
        >
          Reset view
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-white/60">
        Click to zoom in, or scroll to zoom in and out. Iteration depth rises as you go deeper.
      </p>
    </div>
  );
}
