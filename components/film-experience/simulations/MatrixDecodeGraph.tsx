"use client";

import { useEffect, useRef } from "react";
import { accentAlpha, getLiveThemePalette, withAlpha } from "@/lib/theme";

/** One second of the run: the two speeds as they stood at that moment. */
export type DecodeSample = Readonly<{
  /** Seconds since the run started, ignoring paused time. */
  t: number;
  /** Net speed — correct characters only. */
  wpm: number;
  /** Raw speed — every character typed, mistakes included. */
  raw: number;
}>;

type Props = {
  samples: readonly DecodeSample[];
  wpm: number;
  raw: number;
  /** 0-100. */
  accuracy: number;
  /** Dims the readouts when the run is over but the graph stays on screen. */
  finished?: boolean;
};

/** "rgb(r, g, b)" → "rgba(r, g, b, a)" for canvas fades. */
/**
 * The live speed chart: net WPM and raw WPM plotted against elapsed seconds,
 * redrawn whenever a new sample lands (once a second) rather than on a frame
 * loop — there is nothing to animate between samples, so this costs nothing
 * while the player types.
 *
 * It is drawn, not animated, which is why it renders identically under
 * reduced motion: the chart is information, and information is not motion.
 */
export default function MatrixDecodeGraph({
  samples,
  wpm,
  raw,
  accuracy,
  finished = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const palette = getLiveThemePalette();

    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.offsetWidth;
      const cssHeight = canvas.offsetHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const padLeft = 28;
      const padRight = 8;
      const padTop = 10;
      const padBottom = 16;
      const plotW = Math.max(1, cssWidth - padLeft - padRight);
      const plotH = Math.max(1, cssHeight - padTop - padBottom);

      context.clearRect(0, 0, cssWidth, cssHeight);
      context.fillStyle = withAlpha(palette.inkSoft, 0.55);
      context.fillRect(0, 0, cssWidth, cssHeight);

      const peak = Math.max(40, ...samples.map((s) => Math.max(s.wpm, s.raw)));
      // Round the ceiling up to a friendly 20 so the gridlines read cleanly.
      const ceiling = Math.ceil(peak / 20) * 20;
      const lastT = samples.length ? samples[samples.length - 1].t : 0;
      const span = Math.max(10, lastT);

      const x = (t: number) => padLeft + (t / span) * plotW;
      const y = (value: number) => padTop + plotH - (value / ceiling) * plotH;

      // Gridlines + speed axis.
      context.font = "9px monospace";
      context.textAlign = "right";
      context.textBaseline = "middle";
      for (let step = 0; step <= 4; step += 1) {
        const value = (ceiling / 4) * step;
        const gy = y(value);
        context.strokeStyle = accentAlpha(step === 0 ? 0.28 : 0.1);
        context.beginPath();
        context.moveTo(padLeft, gy);
        context.lineTo(padLeft + plotW, gy);
        context.stroke();
        context.fillStyle = accentAlpha(0.45);
        context.fillText(String(Math.round(value)), padLeft - 5, gy);
      }

      // Elapsed axis: a tick every 10s, labelled at the ends.
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = accentAlpha(0.4);
      context.fillText("0s", padLeft, padTop + plotH + 3);
      context.fillText(
        `${Math.round(span)}s`,
        padLeft + plotW - 6,
        padTop + plotH + 3
      );

      if (samples.length === 0) {
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = accentAlpha(0.35);
        context.fillText("awaiting keystrokes", padLeft + plotW / 2, padTop + plotH / 2);
        return;
      }

      const line = (key: "wpm" | "raw", stroke: string, width: number) => {
        context.strokeStyle = stroke;
        context.lineWidth = width;
        context.lineJoin = "round";
        context.beginPath();
        samples.forEach((sample, index) => {
          const px = x(sample.t);
          const py = y(sample[key]);
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.stroke();
      };

      // Raw sits behind, dimmer: it is the shadow the net line casts.
      line("raw", accentAlpha(0.35), 1);
      line("wpm", palette.bright, 2);

      // The head of the net line, so "you are here" is unmistakable.
      const last = samples[samples.length - 1];
      context.fillStyle = palette.bright;
      context.beginPath();
      context.arc(x(last.t), y(last.wpm), 2.5, 0, Math.PI * 2);
      context.fill();
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [samples]);

  return (
    <div data-decode-graph className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span
            className={`text-3xl leading-none tabular-nums sm:text-4xl ${
              finished ? "text-accent/70" : "text-accent-bright"
            }`}
            data-decode-readout="wpm"
          >
            {wpm}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">wpm</span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span
            className="text-xl leading-none tabular-nums text-accent sm:text-2xl"
            data-decode-readout="raw"
          >
            {raw}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">raw</span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span
            className="text-xl leading-none tabular-nums text-accent sm:text-2xl"
            data-decode-readout="accuracy"
          >
            {accuracy}%
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">acc</span>
        </p>
        <p className="ml-auto flex items-center gap-3 text-[9px] uppercase tracking-[0.16em] text-white/40">
          <span className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-0.5 w-4 bg-accent-bright" /> wpm
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-px w-4 bg-accent/40" /> raw
          </span>
        </p>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Typing speed graph: ${wpm} words per minute net, ${raw} raw, ${accuracy} percent accuracy`}
        className="h-24 w-full border border-accent/20 sm:h-28"
      />
    </div>
  );
}
