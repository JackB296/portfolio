"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

// whoami home mark: a shell prompt `$ whoami` idling with a block cursor.
// Hovering runs the command — the output types itself in — and leaving
// clears it back to the waiting prompt. Accent-driven, so film grades
// recolor it; under reduced motion the output appears without the typing
// animation and the cursor blink collapses (global CSS).
const OUTPUT = "jackbialecki";
const STEP_MS = 70;

export default function Whoami({ className = "" }: { className?: string }) {
  const [typed, setTyped] = useState("");
  const timers = useRef<number[]>([]);
  const reduced = useReducedMotion();

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const run = useCallback(() => {
    clearTimers();
    if (reduced) {
      setTyped(OUTPUT);
      return;
    }
    setTyped("");
    for (let i = 1; i <= OUTPUT.length; i++) {
      timers.current.push(
        window.setTimeout(() => setTyped(OUTPUT.slice(0, i)), i * STEP_MS),
      );
    }
  }, [clearTimers, reduced]);

  const hide = useCallback(() => {
    clearTimers();
    setTyped("");
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <span
      onMouseEnter={run}
      onMouseLeave={hide}
      className={`inline-flex items-center font-mono text-sm leading-none tracking-tight ${className}`}
    >
      <span className="text-white/40 transition-colors duration-300 group-hover:text-white/60">$</span>
      <span className="ml-1.5 text-white/80 transition-colors duration-300 group-hover:text-white">
        whoami
      </span>
      <span className="ml-2 text-accent">{typed}</span>
      <span
        className="cursor-blink ml-0.5 inline-block h-[0.9em] w-[0.5em] translate-y-[0.03em] bg-accent"
        aria-hidden
      />
    </span>
  );
}
