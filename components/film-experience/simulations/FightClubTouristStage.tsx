"use client";

import { useEffect, useRef } from "react";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";

// The room, drawn: a flickering fluorescent tube, a ring of occupied folding
// chairs (each night a different count), your chair marked at the front, and —
// once she arrives — Marla in the doorway with a pulsing cigarette ember. Low
// composure bleeds in as insomnia language: frame-skip jitter, a stray
// scanline, a pale wash. Reduced motion swaps all of it for a deliberate
// still: the same room, steady light, a fixed dim proportional to how frayed
// you are.

type Props = Readonly<{
  chairs: number;
  flicker: number;
  marla: boolean;
  composure: number;
  composureStart: number;
  reducedMotion: boolean;
}>;

/** Deterministic pseudo-noise so the flicker never needs Math.random. */
function noise(x: number) {
  const s = Math.sin(x * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export default function FightClubTouristStage({
  chairs,
  flicker,
  marla,
  composure,
  composureStart,
  reducedMotion,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ chairs, flicker, marla, composure, composureStart });
  propsRef.current = { chairs, flicker, marla, composure, composureStart };
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const palette = getLiveThemePalette();

    const draw = (t: number) => {
      const state = propsRef.current;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Insomnia intensity: only the last few pips of composure fray the frame.
      const fray = state.composure <= 3 ? (4 - state.composure) / 4 : 0;
      const skidding = !reducedMotion && fray > 0 && noise(Math.floor(t / 90)) < fray * 0.35;
      const jitter = skidding ? (noise(t) * 10 - 5) * (0.6 + fray) : 0;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(jitter, 0);

      // The fluorescent tube, misbehaving on a fixed schedule per room.
      const dip = noise(Math.floor(t / 110) + 3);
      const brightness = reducedMotion ? 0.8 : dip < state.flicker * 0.55 ? 0.3 : 0.9;
      context.fillStyle = accentAlpha(0.18 + 0.45 * brightness);
      context.fillRect(width * 0.28, 8, width * 0.44, 4);
      const cone = context.createLinearGradient(0, 12, 0, height * 0.72);
      cone.addColorStop(0, accentAlpha(0.02 + 0.1 * brightness));
      cone.addColorStop(1, accentAlpha(0));
      context.fillStyle = cone;
      context.fillRect(width * 0.18, 12, width * 0.64, height * 0.72);

      // The circle of chairs, everyone facing in. Front rows read brighter.
      const cx = width / 2;
      const cy = height * 0.62;
      const rx = Math.min(width * 0.34, 190);
      const ry = height * 0.24;
      for (let i = 0; i < state.chairs; i += 1) {
        const angle = (i / state.chairs) * Math.PI * 2 + Math.PI / 2;
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry;
        const depth = (Math.sin(angle) + 1) / 2; // 1 = front, 0 = back
        context.fillStyle = accentAlpha(0.25 + 0.3 * depth);
        context.fillRect(x - 3, y - 4, 6, 8);
        context.beginPath();
        context.arc(x, y - 7, 2.5, 0, Math.PI * 2);
        context.fillStyle = accentAlpha(0.4 + 0.35 * depth);
        context.fill();
      }

      // Your chair, marked, front and center.
      context.strokeStyle = palette.bright;
      context.lineWidth = 1;
      context.strokeRect(cx - 6, cy + ry - 7, 12, 14);

      // Marla in the doorway, smoking, not dying.
      if (state.marla) {
        const dx = width * 0.9;
        context.fillStyle = accentAlpha(0.3);
        context.fillRect(dx - 6, height * 0.3, 12, height * 0.36);
        context.beginPath();
        context.arc(dx, height * 0.27, 4, 0, Math.PI * 2);
        context.fill();
        const ember = reducedMotion ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(t / 450));
        context.globalAlpha = ember;
        context.fillStyle = palette.bright;
        context.beginPath();
        context.arc(dx + 9, height * 0.35, 1.6, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }

      // Insomnia: a stray scanline and a pale wash on skidding frames; a
      // steady dim instead when motion is reduced.
      if (fray > 0) {
        if (reducedMotion) {
          context.fillStyle = accentAlpha(0.05 * (1 + fray));
          context.fillRect(0, 0, width, height);
        } else if (skidding) {
          const y = noise(Math.floor(t / 70) + 13) * height;
          context.fillStyle = accentAlpha(0.16);
          context.fillRect(0, y, width, 2);
          context.fillStyle = accentAlpha(0.05);
          context.fillRect(0, 0, width, height);
        }
      }

      context.restore();
    };

    redrawRef.current = () => draw(0);

    if (reducedMotion) {
      draw(0);
      const onResize = () => draw(0);
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        redrawRef.current = null;
      };
    }

    let frame = 0;
    const tick = (now: number) => {
      if (!document.hidden) draw(now);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      redrawRef.current = null;
    };
  }, [reducedMotion]);

  // Reduced motion has no loop, so prop changes redraw the still by hand.
  useEffect(() => {
    if (reducedMotion) redrawRef.current?.();
  }, [reducedMotion, chairs, flicker, marla, composure, composureStart]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}
