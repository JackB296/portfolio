"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/** ↑↑↓↓←→←→BA anywhere on the site launches the Flappy Bird demo. */
export default function KonamiCode() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let progress = 0;
    let redirectTimer = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      progress = key === SEQUENCE[progress] ? progress + 1 : key === SEQUENCE[0] ? 1 : 0;
      if (progress === SEQUENCE.length) {
        progress = 0;
        setUnlocked(true);
        redirectTimer = window.setTimeout(() => router.push("/flappy"), 900);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(redirectTimer);
    };
  }, [router]);

  if (!unlocked) return null;
  return (
    <div
      role="status"
      className="fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-accent/40 bg-ink-card/95 px-6 py-3 font-mono text-sm text-accent shadow-2xl shadow-black/50 backdrop-blur"
    >
      Cheat code accepted. Loading Flappy Bird...
    </div>
  );
}
