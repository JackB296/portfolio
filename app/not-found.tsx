import Glow from "@/components/ui/Glow";
import Pill from "@/components/ui/Pill";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Glow className="top-1/2 h-[400px] w-[600px] -translate-y-1/2 blur-[130px]" />
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-accent">404</p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
        <span className="gradient-accent">Lost the thread.</span>
      </h1>
      <p className="mt-5 max-w-md text-white/60">
        This page drifted off-screen, like a bird that didn&apos;t clear the pipe.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <Pill href="/">Back home</Pill>
        <Pill href="/flappy" variant="outline">
          Play Flappy Bird
        </Pill>
      </div>
    </main>
  );
}
