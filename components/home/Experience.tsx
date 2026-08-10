"use client";

import Link from "next/link";
import { experience } from "@/lib/data";
import Reveal from "../ui/Reveal";
import { ArrowRightIcon } from "../ui/icons";
import PlaygroundLayer from "../playground/PlaygroundLayer";

export default function Experience() {
  return (
    <section id="experience" className="relative scroll-mt-20 py-28 sm:py-36">
      {/* Playground mode: the π-blocks drifting along the section floor. */}
      <PlaygroundLayer kind="pi-blocks" />
      <div className="container-x relative z-10">
        <Reveal>
          <h2 className="mb-16 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Experience.
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
                  <span className="absolute left-[1px] top-2 hidden h-3.5 w-3.5 -translate-x-1/2 items-center justify-center border border-accent/50 bg-ink sm:flex">
                    <span className="h-1.5 w-1.5 bg-accent transition-all duration-300 group-hover:scale-150" />
                  </span>

                  <div className="glass p-6 transition-colors duration-300 hover:border-accent/25 sm:p-7">
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
                          <span className="mt-2 h-1 w-1 flex-none bg-accent/70" />
                          {p}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {job.tags.map((t) => (
                          <span
                            key={t}
                            className="bg-white/[0.05] px-2.5 py-1 font-pixel text-[10px] text-white/60"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {job.caseStudy && (
                        <Link
                          href={`/work/${job.caseStudy}`}
                          className="group/cs inline-flex flex-none items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-bright"
                        >
                          Read case study
                          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover/cs:translate-x-0.5" />
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
