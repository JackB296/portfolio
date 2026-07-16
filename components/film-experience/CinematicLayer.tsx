"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Img from "@/components/ui/Img";
import { filmExperienceById } from "@/lib/filmExperiences";
import type { FilmVisualModule } from "@/lib/filmExperienceTypes";
import { cssRgb } from "./shared";

export type VisualStatus = Readonly<{
  state: "off" | "loading" | "running" | "static" | "error";
  filmId: string | null;
}>;

type CinematicLayerProps = {
  filmId: string | null;
  onStatus: (status: VisualStatus) => void;
};

type LoadedVisual = {
  filmId: string;
  module: FilmVisualModule;
};

export default function CinematicLayer({ filmId, onStatus }: CinematicLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<LoadedVisual | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  const report = useCallback(
    (status: VisualStatus) => statusRef.current(status),
    []
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!filmId) {
      setLoaded(null);
      report({ state: "off", filmId: null });
      return;
    }

    const definition = filmExperienceById.get(filmId);
    if (!definition) {
      setLoaded(null);
      report({ state: "error", filmId });
      return;
    }

    report({ state: "loading", filmId });
    void definition
      .loadVisuals()
      .then((module) => {
        if (!cancelled) setLoaded({ filmId, module: module.default });
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(null);
          report({ state: "error", filmId });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filmId, report]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded || loaded.filmId !== filmId) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      report({ state: "error", filmId });
      return;
    }
    const palette = {
      accent: cssRgb("--accent-rgb", "52 211 153"),
      accentBright: cssRgb("--accent-bright-rgb", "110 231 183"),
      accentDim: cssRgb("--accent-dim-rgb", "5 150 105"),
    };

    let animationFrame = 0;
    let previousFrame = performance.now();
    let previousScroll = window.scrollY;
    let scrollVelocity = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let documentVisible = document.visibilityState === "visible";
    let minimumFrameTime = window.innerWidth < 768 ? 1000 / 30 : 1000 / 60;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      minimumFrameTime = width < 768 ? 1000 / 30 : 1000 / 60;
      const qualityCap = width < 768 ? 1 : 1.5;
      const dpr = Math.min(window.devicePixelRatio || 1, qualityCap);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    };
    const draw = (now: number, staticFrame: boolean) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nextScroll = window.scrollY;
      const scrollDelta = nextScroll - previousScroll;
      scrollVelocity =
        scrollDelta === 0
          ? scrollVelocity * 0.86
          : scrollVelocity * 0.34 + scrollDelta * 0.66;
      previousScroll = nextScroll;
      const dpr = canvas.width / Math.max(width, 1);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      loaded.module.draw({
        context,
        width,
        height,
        dpr,
        time: staticFrame ? 0 : now / 1000,
        pointerX,
        pointerY,
        scroll: window.scrollY,
        scrollVelocity,
        staticFrame,
        ...palette,
      });
      canvas.dataset.staticFrame = String(staticFrame);
    };

    const staticFrame = reduceMotion;
    const onResize = () => {
      resize();
      if (staticFrame) draw(performance.now(), true);
    };
    const tick = (now: number) => {
      if (!documentVisible || staticFrame) return;
      if (now - previousFrame >= minimumFrameTime) {
        previousFrame = now;
        draw(now, false);
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      documentVisible = document.visibilityState === "visible";
      window.cancelAnimationFrame(animationFrame);
      if (documentVisible) {
        if (staticFrame) draw(performance.now(), true);
        else animationFrame = window.requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (staticFrame) {
      draw(performance.now(), true);
      report({ state: "static", filmId });
    } else {
      draw(performance.now(), false);
      report({ state: "running", filmId });
      animationFrame = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [filmId, loaded, reduceMotion, report]);

  if (!filmId) return null;
  const definition = filmExperienceById.get(filmId);

  return (
    <>
      <canvas
        ref={canvasRef}
        data-cinematic-layer
        data-renderer={loaded?.filmId ?? "loading"}
        data-authored={String(Boolean(loaded?.module.authored))}
        data-visual-references={loaded?.module.markers?.join("|") ?? ""}
        data-static-frame="false"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30 h-screen w-screen opacity-55 mix-blend-screen"
      />
      {definition?.visualAssets.map((asset) => {
        const style: CSSProperties = {
          left: asset.left,
          top: asset.top,
          width: asset.width,
          height: asset.height,
          objectFit: asset.objectFit,
          objectPosition: asset.objectPosition,
          opacity: asset.opacity,
          mixBlendMode: asset.blendMode,
        };
        return (
          <Img
            key={asset.id}
            src={asset.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="eager"
            data-film-asset={asset.id}
            data-film-id={filmId}
            data-asset-motion={asset.motion}
            data-static-asset={String(reduceMotion)}
            className={`film-asset film-asset--${asset.motion} pointer-events-none fixed z-30 select-none`}
            style={style}
          />
        );
      })}
    </>
  );
}
