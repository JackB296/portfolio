"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared canvas scaffold for the interactive demos. The hook owns the whole
// canvas lifecycle: context acquisition with real null guards, DPR-aware
// sizing through a debounced ResizeObserver, and a clamped-dt rAF loop that
// pauses while the tab is hidden or the canvas is off-screen. Under
// prefers-reduced-motion (tracked reactively) demos don't auto-run; the hook
// draws one still frame and the demo's own controls become the opt-in.
//
// A demo hands over a single `init` function that builds its sim state and
// returns its callbacks (resize / frame / draw), optional pointer handlers,
// an `api` object of sim-specific actions for its buttons, and an optional
// `hud` reader for the values its overlay shows. Sim state never calls into
// React directly: the hook samples `hud` after each painted frame — loop
// frames and renderOnce stills alike — and flushes changes into React state
// at most once per animation frame.

const MAX_DT = 0.1; // seconds; caps catch-up work after long rAF gaps
const RESIZE_DEBOUNCE = 150; // ms

/** Shape constraint for a demo's button API: named void actions. */
type DemoApi = Record<string, (...args: never[]) => void>;

type DemoCanvasControls = {
  /** Run the loop. Counts as explicit user intent, so it also wins over
      prefers-reduced-motion. */
  start: () => void;
  /** Draw one still frame on the next animation frame. Calls coalesce, and
      it's a no-op while the loop is running (a frame is coming anyway). */
  renderOnce: () => void;
};

type DemoCanvasSetup<Api, Hud> = {
  /** Size the canvas for a new CSS width and rebuild size-dependent state.
      Runs once on mount and (debounced) when the CSS width changes. `dpr`
      is the device pixel ratio, capped at 2; demos that render pixelated
      on purpose can ignore it. */
  resize: (cssWidth: number, dpr: number) => void;
  /** Advance and draw one animation frame. `dt` is in seconds, already
      clamped, and never spans time spent hidden. Omit for render-on-demand
      demos that only draw via `renderOnce`. */
  frame?: (dt: number) => void;
  /** Draw a single still frame. Defaults to `frame(0)`. */
  draw?: () => void;
  /** Read the values the demo's overlay shows (accuracy, collision count,
      zoom depth, ...). Sampled after every painted frame; the result lands
      in the hook's `hud` state only when it actually changed (primitives by
      Object.is, objects by one level of keys), so a stable HUD costs no
      re-renders and a busy sim costs at most one per frame. */
  hud?: () => Hud;
  /** Pointer handlers: `down` binds to the canvas, `move` and `up` to the
      window (so drags keep tracking outside the canvas). */
  pointer?: {
    down?: (e: PointerEvent) => void;
    move?: (e: PointerEvent) => void;
    up?: (e: PointerEvent) => void;
  };
  /** Extra teardown for listeners the demo wired up itself. */
  cleanup?: () => void;
  /** Sim-specific actions, exposed to the demo's buttons via `api`. */
  api?: Api;
};

type DemoCanvasInit<Api, Hud> = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  controls: DemoCanvasControls
) => DemoCanvasSetup<Api, Hud>;

// HUD values are flat by construction: Object.is on primitives, one level
// of keys on plain objects.
const hudEquals = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
};

export default function useDemoCanvas<Api extends DemoApi = Record<string, never>, Hud = undefined>(
  init: DemoCanvasInit<Api, Hud>,
  {
    autoStart = true,
    initialHud,
  }: {
    autoStart?: boolean;
    /** What `hud` holds until the first frame flushes; match the sim's
        starting values so the first paint doesn't flicker. */
    initialHud?: Hud;
  } = {}
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<Api | null>(null);
  // Whether the demo *wants* to run (button labels key off this); visibility
  // pauses don't change it. Reduced-motion is reconciled after mount.
  const [running, setRunning] = useState(autoStart);
  // `initialHud` is declared optional so no-HUD demos can omit it; demos
  // that declare a Hud type pass it, so the cast only papers over the
  // pre-first-flush window.
  const [hud, setHud] = useState<Hud>(initialHud as Hud);

  // Stable facade over the sim's api: property access yields a callback that
  // forwards to the mounted sim and no-ops before mount / after unmount, so
  // consumers write `demo.api.step()` with no optional chaining.
  //
  // Invariants of the Proxy:
  // - EVERY property access mints a fresh function, so `api.step` is never
  //   identity-stable: don't use it as an effect dep, don't pass it to
  //   removeEventListener, and don't compare it across renders. Bind inline
  //   (`onClick={() => api.step()}`) or via the `api` object itself, which
  //   IS stable.
  // - Calls before mount or after unmount silently no-op (apiRef is null).
  // - Only call it: don't await, spread, string-coerce, or enumerate it —
  //   any non-call access also yields one of these throwaway functions.
  const [api] = useState<Api>(
    () =>
      new Proxy({} as Api, {
        get:
          (_target, prop) =>
          (...args: unknown[]) => {
            const fn = apiRef.current?.[prop as keyof Api] as
              | ((...fnArgs: unknown[]) => void)
              | undefined;
            fn?.(...args);
          },
      })
  );

  // The init closure and options from the first render drive the whole
  // canvas lifetime; the mount effect below runs once.
  const initRef = useRef(init);
  const autoStartRef = useRef(autoStart);
  const initialHudRef = useRef(initialHud);
  const userToggledRef = useRef(false);
  const toggleRef = useRef<(() => void) | null>(null);

  const toggle = useCallback(() => toggleRef.current?.(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const wantsAutoStart = autoStartRef.current;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let intent = wantsAutoStart && !reducedQuery.matches;
    let inView = true;
    let rafId = 0;
    let onceId = 0;
    let lastTime = 0;
    let lastHud: unknown = initialHudRef.current;
    let setup: DemoCanvasSetup<Api, Hud>;

    const drawStill = () => {
      if (setup.draw) setup.draw();
      else setup.frame?.(0);
    };

    // The only path from sim state into React state: sample the HUD reader
    // after a painted frame and setState only on a real change.
    const flushHud = () => {
      if (!setup.hud) return;
      const next = setup.hud();
      if (hudEquals(lastHud, next)) return;
      lastHud = next;
      setHud(next);
    };

    const renderOnceInternal = () => {
      if (rafId || onceId) return; // the loop already draws every frame
      onceId = requestAnimationFrame(() => {
        onceId = 0;
        if (!rafId) {
          drawStill();
          flushHud();
        }
      });
    };

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(MAX_DT, (now - lastTime) / 1000);
      lastTime = now;
      setup.frame?.(dt);
      flushHud();
    };

    // The loop runs only while the demo wants to run AND the page can
    // actually be seen; `lastTime` resets on resume so dt never spans
    // the pause.
    const sync = () => {
      const shouldRun = intent && !!setup.frame && !document.hidden && inView;
      if (shouldRun && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      } else if (!shouldRun && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const startIntent = () => {
      userToggledRef.current = true;
      intent = true;
      setRunning(true);
      sync();
    };
    const stopIntent = () => {
      userToggledRef.current = true;
      intent = false;
      setRunning(false);
      sync();
    };

    const controls: DemoCanvasControls = {
      start: startIntent,
      renderOnce: renderOnceInternal,
    };

    setup = initRef.current(ctx, canvas, controls);
    apiRef.current = setup.api ?? null;
    toggleRef.current = () => (intent ? stopIntent() : startIntent());

    // Reflect reduced-motion in the Play/Pause label after mount (doing it
    // in useState would risk a hydration mismatch).
    if (wantsAutoStart && reducedQuery.matches) setRunning(false);

    // React to the media query changing, both directions. An explicit user
    // toggle wins until reduced-motion is turned on again.
    const onMotionChange = () => {
      if (reducedQuery.matches) {
        intent = false;
        setRunning(false);
        sync();
        renderOnceInternal(); // leave a coherent still frame behind
      } else if (!userToggledRef.current) {
        intent = wantsAutoStart;
        setRunning(wantsAutoStart);
        sync();
      }
    };
    reducedQuery.addEventListener("change", onMotionChange);

    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);

    // Size immediately, then debounce observed changes; a resize while
    // paused still leaves a fresh frame on screen.
    let lastWidth = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const applyResize = () => {
      const width = canvas.getBoundingClientRect().width;
      if (width === lastWidth) return;
      lastWidth = width;
      setup.resize(width, Math.min(window.devicePixelRatio || 1, 2));
      if (!rafId) renderOnceInternal();
    };
    applyResize();
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyResize, RESIZE_DEBOUNCE);
    });
    ro.observe(canvas);

    const pointer = setup.pointer;
    if (pointer?.down) canvas.addEventListener("pointerdown", pointer.down);
    if (pointer?.move) window.addEventListener("pointermove", pointer.move);
    if (pointer?.up) window.addEventListener("pointerup", pointer.up);

    sync();

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(onceId);
      clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onMotionChange);
      if (pointer?.down) canvas.removeEventListener("pointerdown", pointer.down);
      if (pointer?.move) window.removeEventListener("pointermove", pointer.move);
      if (pointer?.up) window.removeEventListener("pointerup", pointer.up);
      setup.cleanup?.();
      toggleRef.current = null;
      apiRef.current = null;
    };
  }, []);

  return { canvasRef, running, toggle, api, hud };
}
