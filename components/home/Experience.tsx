"use client";

import Link from "next/link";
import { experience } from "@/lib/data";
import { caseStudyByCompany } from "@/lib/caseStudies";
import Reveal from "../ui/Reveal";

export default function Experience() {
  return (
    <section id="experience" className="relative scroll-mt-20 py-28 sm:py-36">
      <div className="container-x">
        <Reveal>
          <h2 className="mb-16 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Where I&apos;ve shipped.
          </h2>
        </Reveal>

        <div className="relative">
          {/* timeline rail */}
          <div className="absolute left-0 top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-accent/60 via-white/10 to-transparent sm:left-2 sm:block" />

          <div className="space-y-12">
            {experience.map((job, i) => (
              <Reveal key={`${job.company}-${i}`} delay={i * 0.05}>
                <div className="group relative sm:pl-14">
                  {/* node */}
                  <span className="absolute left-[1px] top-2 hidden h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full border border-accent/50 bg-ink sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent transition-all duration-300 group-hover:scale-150" />
                  </span>

                  <div className="glass rounded-2xl p-6 transition-colors duration-300 hover:border-accent/25 sm:p-7">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-lg font-semibold text-white">
                        {job.role}
                        <span className="text-accent"> @ {job.company}</span>
                      </h3>
                      <span className="font-mono text-xs text-white/65">
                        {job.period}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-white/60">
                      {job.location}
                    </p>

                    <ul className="mt-4 space-y-2.5">
                      {job.points.map((p, j) => (
                        <li
                          key={j}
                          className="flex gap-3 text-sm leading-relaxed text-white/65"
                        >
                          <span className="mt-2 h-1 w-1 flex-none rounded-full bg-accent/70" />
                          {p}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {job.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-white/55"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {caseStudyByCompany[job.company] && (
                        <Link
                          href={`/work/${caseStudyByCompany[job.company]}`}
                          className="group/cs inline-flex flex-none items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-bright"
                        >
                          Read case study
                          <svg className="h-3.5 w-3.5 transition-transform group-hover/cs:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
