"use client";

import { useEffect, useRef, useState } from "react";
import { BREATH_STEPS } from "./FightClubTouristData";

// The composure check: a regular asks a probing question and your breath
// drifts across a meter. Exhale while the needle sits inside the still band
// and the question moves on; exhale outside it and eyes linger. The needle
// oscillates on a per-night period (later nights swing faster, with a
// narrower band). Under reduced motion nothing oscillates: each "Breathe"
// press steps the needle through a fixed sequence instead, so the check stays
// deliberate and fully playable.

type Props = Readonly<{
  question: string;
  periodMs: number;
  zone: number;
  reducedMotion: boolean;
  onResult: (steadied: boolean) => void;
}>;

const BUTTON =
  "border border-accent/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-transform hover:bg-accent/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function FightClubTouristBreath({
  question,
  periodMs,
  zone,
  reducedMotion,
  onResult,
}: Props) {
  const needleRef = useRef<HTMLDivElement>(null);
  // Animated mode opens at the top of the swing (cos), never inside the band.
  const posRef = useRef(1);
  const [stepIndex, setStepIndex] = useState(0);
  const exhaleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => exhaleRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  // The one animated concern: the needle. Time only advances while visible.
  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!document.hidden) {
        elapsed += dt;
        const x = Math.cos((elapsed / periodMs) * Math.PI * 2);
        posRef.current = x;
        if (needleRef.current) needleRef.current.style.left = `${((x + 1) / 2) * 100}%`;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [periodMs, reducedMotion]);

  // Reduced motion: the needle sits at a fixed step until the next breath.
  useEffect(() => {
    if (!reducedMotion) return;
    const x = BREATH_STEPS[stepIndex % BREATH_STEPS.length];
    posRef.current = x;
    if (needleRef.current) needleRef.current.style.left = `${((x + 1) / 2) * 100}%`;
  }, [reducedMotion, stepIndex]);

  const steppedInside =
    Math.abs(BREATH_STEPS[stepIndex % BREATH_STEPS.length]) <= zone;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">A regular leans over</p>
      <p className="text-[11px] normal-case leading-snug text-white/85">&ldquo;{question}&rdquo;</p>
      <div
        aria-hidden
        className="relative h-8 select-none overflow-hidden border border-accent/30 bg-ink/60 [touch-action:none]"
      >
        <div
          className="absolute inset-y-0 border-x border-accent/50 bg-accent/15"
          style={{ left: `${((1 - zone) / 2) * 100}%`, width: `${zone * 100}%` }}
        />
        <div
          ref={needleRef}
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent-bright"
          style={{ left: reducedMotion ? "92.5%" : "100%" }}
        />
      </div>
      <p className="text-[10px] normal-case leading-snug text-white/55">
        {reducedMotion
          ? `Breath ${steppedInside ? "inside the still band — exhale now" : "drifting — keep breathing"}.`
          : "Wait for the needle to cross the still band, then exhale."}
      </p>
      <div className="flex gap-2">
        {reducedMotion && (
          <button
            type="button"
            onClick={() => setStepIndex((index) => index + 1)}
            className={BUTTON}
          >
            Breathe
          </button>
        )}
        <button
          ref={exhaleRef}
          type="button"
          onClick={() => onResult(Math.abs(posRef.current) <= zone)}
          className={BUTTON}
        >
          Exhale
        </button>
      </div>
    </div>
  );
}
