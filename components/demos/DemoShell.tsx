import Link from "next/link";
import { ReactNode } from "react";
import { getDemo } from "@/lib/demos";
import { nextForDemo } from "@/lib/projectNav";
import BackLink from "../ui/BackLink";
import Glow from "../ui/Glow";
import Pill from "../ui/Pill";
import { GitHubIcon, ArrowRightIcon } from "../ui/icons";

// Layout shared by every demo page. The heading, tags, accent label, and
// GitHub link resolve from the demo registry (lib/demos.ts) by slug so page
// copy can't drift from it; pages supply only the long-form description,
// the bullets, and the demo itself.
type Props = {
  slug: string;
  description: ReactNode;
  bullets: [string, string][];
  /** For fixed-width demos (e.g. the flappy iframe): the grid sizes the demo
      column to its content instead of the default fluid 560px track, and the
      column gets this class. */
  demoColumnClassName?: string;
  children: ReactNode;
};

export default function DemoShell({
  slug,
  description,
  bullets,
  demoColumnClassName,
  children,
}: Props) {
  const demo = getDemo(slug);
  if (!demo) throw new Error(`DemoShell: no demo registered for slug "${slug}"`);
  const next = nextForDemo(slug);

  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      <Glow className="top-0 h-[500px] w-[700px] blur-[140px]" />

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

        <div
          className={`mt-10 grid items-start gap-12 ${
            demoColumnClassName ? "lg:grid-cols-[1fr_auto]" : "lg:grid-cols-[1fr_minmax(0,560px)]"
          }`}
        >
          <div className="max-w-xl lg:sticky lg:top-12">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              {demo.accentLabel} · Live Demo
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {demo.title} <span className="gradient-accent">{demo.titleAccent}</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/65">
              {description}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-white/65">
              {bullets.map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rotate-45 bg-accent" />
                  <span>
                    <b className="text-white/85">{t}.</b> {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {demo.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
            {demo.github && (
              <Pill
                href={demo.github}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="sm"
                className="mt-7 inline-flex items-center gap-2"
              >
                <GitHubIcon />
                View source on GitHub
              </Pill>
            )}
          </div>

          <div className={demoColumnClassName ?? "w-full"}>{children}</div>
        </div>

        {next && (
          <div className="mt-16 flex items-center justify-end border-t border-white/[0.07] pt-8">
            <Link
              href={next.href}
              className="group inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-accent"
            >
              Next project: {next.label}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
