import type { Metadata } from "next";
import Link from "next/link";
import { demos } from "@/lib/demos";
import { profile } from "@/lib/data";
import BackLink from "@/components/ui/BackLink";

export const metadata: Metadata = {
  title: `Playground · ${profile.name}`,
  description:
    "A playground of interactive demos: neuroevolution, a raycasting engine, cloth physics, the Mandelbrot set, Conway's Game of Life, a perceptron, and more.",
};

export default function DemosPage() {
  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-[150px]" />

      <div className="container-x py-12">
        <BackLink href="/#projects" label="Back to portfolio" />

        <header className="mt-10 max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Playground
          </span>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Interactive <span className="gradient-accent">demos</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            A collection of things I built for fun and rebuilt to run live in your browser.
            Most started as Python projects and were ported to JavaScript and canvas. Click in
            and play.
          </p>
        </header>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-ink-card/60 p-6 transition-colors duration-300 hover:border-accent/30"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                {d.accentLabel}
              </span>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {d.title} {d.titleAccent}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/60">{d.blurb}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] text-white/55"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                Open demo
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
