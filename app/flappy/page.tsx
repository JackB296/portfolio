import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/lib/data";
import { nextForDemo } from "@/lib/projectNav";
import BackLink from "@/components/ui/BackLink";
import { GitHubIcon, ArrowRightIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: `Neuroevolution Flappy Bird · ${profile.name}`,
  description:
    "An AI-driven Flappy Bird that evolves a population of neural-network agents through neuroevolution. Here it is playable, embedded live in the portfolio.",
};

export default function FlappyPage() {
  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[700px] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />

      <div className="container-x py-12">
        <div className="flex items-center justify-between">
          <BackLink href="/#projects" label="Back to portfolio" />
          <Link
            href="/demos"
            className="font-mono text-sm text-white/55 transition-colors hover:text-accent"
          >
            All demos
          </Link>
        </div>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_auto]">
          <div className="max-w-xl lg:sticky lg:top-12">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              AI / ML · Live Demo
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Neuroevolution <span className="gradient-accent">Flappy Bird</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/65">
              This is the real project, running live. It evolves a population of 50
              neural-network birds through <b className="text-white/85">neuroevolution</b>:
              a genetic algorithm that breeds the fittest birds each generation until they
              learn, from just two inputs, to clear the pipes on their own.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-white/65">
              {[
                ["Mode: You / AI", "Play it yourself, or switch to AI and watch the population train."],
                ["Debug View", "Visualize each bird's input ray to the next pipe gap."],
                ["Space to flap", "In player mode, press Space to jump; tap on mobile."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rotate-45 bg-accent" />
                  <span>
                    <b className="text-white/85">{t}</b>: {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {["JavaScript", "p5.js", "Neuroevolution", "Genetic Algorithm", "Neural Networks"].map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
            <a
              href="https://github.com/JackB296/neuroevolution-flappy-bird"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/85 transition-colors hover:border-accent/50 hover:text-white"
            >
              <GitHubIcon />
              View source on GitHub
            </a>
          </div>

          {/* Embedded live p5.js game */}
          <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-2xl shadow-accent/10 lg:w-[480px]">
            <iframe
              src="/neat-flappy/index.html"
              title="Neuroevolution Flappy Bird live demo"
              sandbox="allow-scripts allow-same-origin"
              className="block h-[760px] w-full"
              loading="lazy"
            />
          </div>
        </div>

        {(() => {
          const next = nextForDemo("flappy");
          return next ? (
            <div className="mt-16 flex items-center justify-end border-t border-white/[0.07] pt-8">
              <Link
                href={next.href}
                className="group inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-accent"
              >
                Next project: {next.label}
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ) : null;
        })()}
      </div>
    </main>
  );
}
