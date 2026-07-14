"use client";

import Link from "next/link";
import { projects, profile, type Project } from "@/lib/data";
import { caseStudies, professionalCaseStudySlugs } from "@/lib/caseStudies";
import Reveal from "../ui/Reveal";
import ProjectCard from "./ProjectCard";

// Adapt the professional case studies into the card shape ProjectCard renders.
const caseStudyCards: Project[] = professionalCaseStudySlugs
  .map((slug) => caseStudies.find((c) => c.slug === slug))
  .filter((c): c is NonNullable<typeof c> => Boolean(c))
  .map((c) => ({
    name: c.cardName,
    blurb: c.cardBlurb,
    tools: c.tags.slice(0, 4),
    caseStudy: c.slug,
    accentLabel: c.accentLabel,
    featured: c.featured,
  }));

function Grid({ items }: { items: Project[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {items.map((project) => (
        <Reveal key={project.name} className={project.featured ? "lg:col-span-2" : ""}>
          <ProjectCard project={project} />
        </Reveal>
      ))}
    </div>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="relative scroll-mt-20 py-28 sm:py-36">
      <div className="container-x">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Reveal>
              <p className="section-label">
                <span className="h-px w-8 bg-accent" /> Work
              </p>
            </Reveal>
            <Reveal>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Projects &amp; case studies.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href="/demos"
                className="group inline-flex items-center gap-2 font-mono text-sm text-accent transition-colors hover:text-accent-bright"
              >
                Open the playground
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 font-mono text-sm text-white/60 transition-colors hover:text-accent"
              >
                All repos on GitHub
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </Reveal>
        </div>

        {/* Group 1: personal / class projects */}
        <Reveal>
          <h3 className="mb-6 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            Projects
            <span className="h-px flex-1 bg-white/[0.08]" />
          </h3>
        </Reveal>
        <Grid items={projects} />

        {/* Group 2: professional case studies */}
        <Reveal>
          <h3 className="mb-6 mt-16 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            Case Studies
            <span className="h-px flex-1 bg-white/[0.08]" />
          </h3>
        </Reveal>
        <Grid items={caseStudyCards} />
      </div>
    </section>
  );
}
