"use client";

import useDemoCanvas from "./useDemoCanvas";
import { DemoButton, DemoCaption, DemoFrame } from "./chrome";

// Mandelbrot set by escape-time iteration (z = z*z + c, escape when |z| > 2),
// faithful to my Python/NumPy notebook. Click to zoom in, with a "hot" colormap.
type MandelbrotApi = {
  reset: () => void;
};

export default function Mandelbrot() {
  const demo = useDemoCanvas<MandelbrotApi, string>(
    (ctx, canvas, controls) => {
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
      };

      // View math runs per event (so zoom semantics are unchanged), but the
      // O(W*H*iter) render is coalesced through renderOnce: a wheel burst
      // costs one render per frame instead of one per wheel event.
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
        controls.renderOnce();
      };

      const onClick = (e: MouseEvent) => zoomAt(e.clientX, e.clientY, 0.5);
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 0.7 : 1 / 0.7);
      };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("wheel", onWheel, { passive: false });

      return {
        // 1x on purpose: the pixelated look is intentional and the render
        // cost scales with the pixel count, so no DPR scaling here.
        resize(cssWidth) {
          const cssW = Math.max(1, cssWidth);
          W = Math.min(560, Math.round(cssW));
          H = Math.round(W * 0.66);
          canvas.width = W;
          canvas.height = H;
        },
        draw: render,
        hud: () => `${(initial.span / view.span).toFixed(1)}x`,
        cleanup: () => {
          canvas.removeEventListener("click", onClick);
          canvas.removeEventListener("wheel", onWheel);
        },
        api: {
          reset: () => {
            view = { ...initial };
            controls.renderOnce();
          },
        },
      };
    },
    // Render-on-demand: there is no continuous loop, only renderOnce.
    { autoStart: false, initialHud: "1x" }
  );

  return (
    <div className="w-full">
      <DemoFrame>
        <canvas
          ref={demo.canvasRef}
          className="block w-full cursor-crosshair touch-none select-none"
          style={{ imageRendering: "pixelated" }}
        />
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 font-mono text-xs text-accent backdrop-blur">
          {demo.hud}
        </span>
      </DemoFrame>
      <div className="mt-4 flex items-center justify-center gap-3">
        <DemoButton onClick={() => demo.api.reset()}>Reset view</DemoButton>
      </div>
      <DemoCaption>
        Click to zoom in, or scroll to zoom in and out. Iteration depth rises as you go deeper.
      </DemoCaption>
    </div>
  );
}
