import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { caseStudies, getCaseStudy, professionalCaseStudySlugs } from "@/lib/caseStudies";
import { nextForWork } from "@/lib/projectNav";
import { profile } from "@/lib/data";
import BackLink from "@/components/ui/BackLink";
import Glow from "@/components/ui/Glow";
import Img from "@/components/ui/Img";
import Pill from "@/components/ui/Pill";
import { ArrowRightIcon } from "@/components/ui/icons";
import { caseStudyJsonLd } from "@/lib/structuredData";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const cs = getCaseStudy(params.slug);
  if (!cs) return { title: "Case Study" };
  return {
    title: `${cs.company} · Case Study · ${profile.name}`,
    description: cs.summary,
  };
}

export default function CaseStudyPage({
  params,
}: {
  params: { slug: string };
}) {
  const cs = getCaseStudy(params.slug);
  if (!cs) notFound();

  const next = nextForWork(cs.slug);
  const isCaseStudy = professionalCaseStudySlugs.includes(cs.slug);

  return (
    <main className="relative overflow-hidden pb-28">
      <JsonLd data={caseStudyJsonLd(cs)} />
      <Glow className="top-0 h-[460px] w-[760px] blur-[150px]" />

      <div className="container-x py-12">
        <BackLink href="/#experience" label="Back to experience" />

        {/* Header */}
        <header className="mt-10 max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {cs.headline}
          </h1>
          <p className="mt-3 font-mono text-sm text-white/50">
            {cs.role} · {cs.company} · {cs.location} · {cs.period}
          </p>
          <p className="mt-6 text-lg leading-relaxed text-white/70">{cs.summary}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {cs.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-white/60"
              >
                {t}
              </span>
            ))}
          </div>
        </header>

        {cs.image && (
          <figure className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10">
            <Img
              src={cs.image.src}
              alt={cs.image.alt}
              width={cs.image.width}
              height={cs.image.height}
              className="block h-auto w-full"
            />
          </figure>
        )}

        {/* Outcomes: numeric metrics as tiles, everything else as plain wins */}
        {cs.outcomes && cs.outcomes.length > 0 && (
          <section
            className={`mt-14 grid grid-cols-2 gap-4 ${
              cs.outcomes.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            {cs.outcomes.map((o) => (
              <div key={o.label} className="glass rounded-2xl p-5">
                <div className="text-2xl font-bold leading-tight text-accent sm:text-3xl">
                  {o.metric}
                </div>
                <div className="mt-1.5 text-xs leading-snug text-white/55">
                  {o.label}
                </div>
              </div>
            ))}
          </section>
        )}
        {cs.highlights && cs.highlights.length > 0 && (
          <section className="mt-10">
            <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {cs.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm text-white/75">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rotate-45 bg-accent" />
                  {h}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-16 grid gap-14 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-12">
            {/* Problem */}
            <Block label="The problem">
              <div className="space-y-4">
                {cs.problem.map((p, i) => (
                  <p key={i} className="leading-relaxed text-white/70">
                    {p}
                  </p>
                ))}
              </div>
            </Block>

            {/* Approach */}
            <Block label="What I built">
              <ol className="space-y-7">
                {cs.approach.map((a, i) => (
                  <li key={i} className="relative pl-12">
                    <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-sm font-bold text-accent">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-white">{a.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-white/65">{a.body}</p>
                  </li>
                ))}
              </ol>
            </Block>
          </div>

          {/* Stack sidebar */}
          <aside className="lg:sticky lg:top-12 lg:self-start">
            <div className="glass rounded-2xl p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Tech stack
              </p>
              <dl className="mt-5 space-y-4">
                {cs.stack.map((s) => (
                  <div key={s.group}>
                    <dt className="text-xs uppercase tracking-wide text-white/60">
                      {s.group}
                    </dt>
                    <dd className="mt-1.5 flex flex-wrap gap-2">
                      {s.items.map((it) => (
                        <span
                          key={it}
                          className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-white/70"
                        >
                          {it}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>

        {/* Footer nav */}
        <div className="mt-20 flex flex-col items-start justify-between gap-6 border-t border-white/[0.07] pt-10 sm:flex-row sm:items-center">
          <Pill href="/#contact">Get in touch</Pill>
          {next && (
            <Link
              href={next.href}
              className="group inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-accent"
            >
              {isCaseStudy ? "Next case study" : "Next project"}: {next.label}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-white">{label}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
