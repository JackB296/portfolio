"use client";

import { useEffect } from "react";
import Glow from "@/components/ui/Glow";
import Pill from "@/components/ui/Pill";

// Route-level error boundary. Without one, any uncaught render error swaps the
// whole page for Next's unstyled default screen; this keeps a crash inside the
// site's own frame and offers a way back.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Glow className="top-1/2 h-[400px] w-[600px] -translate-y-1/2 blur-[130px]" />
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-accent">error</p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
        <span className="gradient-accent">Kernel panic.</span>
      </h1>
      <p className="mt-5 max-w-md text-white/60">
        Something in this scene crashed. The rest of the site is fine — try the
        take again or head home.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Pill onClick={reset}>Try again</Pill>
        <Pill href="/" variant="outline">
          Back home
        </Pill>
      </div>
    </main>
  );
}
