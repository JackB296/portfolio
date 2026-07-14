import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[600px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[130px]" />
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-accent">404</p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
        <span className="gradient-accent">Lost the thread.</span>
      </h1>
      <p className="mt-5 max-w-md text-white/60">
        This page drifted off-screen, like a bird that didn&apos;t clear the pipe.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-accent-bright"
        >
          Back home
        </Link>
        <Link
          href="/flappy"
          className="rounded-full border border-white/15 px-7 py-3.5 text-sm font-medium text-white/85 transition-colors hover:border-accent/50 hover:text-white"
        >
          Play Flappy Bird
        </Link>
      </div>
    </main>
  );
}
