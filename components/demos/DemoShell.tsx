import Link from "next/link";
import { ReactNode } from "react";
import { nextForDemo } from "@/lib/projectNav";
import BackLink from "../ui/BackLink";
import { GitHubIcon, ArrowRightIcon } from "../ui/icons";

type Props = {
  slug: string;
  accentLabel: string;
  title: string;
  titleAccent: string;
  description: string;
  bullets: [string, string][];
  tags: string[];
  github?: string;
  children: ReactNode;
};

export default function DemoShell({
  slug,
  accentLabel,
  title,
  titleAccent,
  description,
  bullets,
  tags,
  github,
  children,
}: Props) {
  const next = nextForDemo(slug);

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

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,560px)]">
          <div className="max-w-xl lg:sticky lg:top-12">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              {accentLabel}
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {title} <span className="gradient-accent">{titleAccent}</span>
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
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/85 transition-colors hover:border-accent/50 hover:text-white"
              >
                <GitHubIcon />
                View source on GitHub
              </a>
            )}
          </div>

          <div className="w-full">{children}</div>
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
