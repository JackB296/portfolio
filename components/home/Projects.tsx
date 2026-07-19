"use client";

import Link from "next/link";
import { projects, profile, type Project } from "@/lib/data";
import { professionalCaseStudies } from "@/lib/caseStudies";
import Reveal from "../ui/Reveal";
import ProjectCard from "./ProjectCard";
import { ArrowRightIcon, ArrowUpRightIcon } from "../ui/icons";
import PlaygroundLayer from "../playground/PlaygroundLayer";

// Adapt the professional case studies into the card shape ProjectCard renders.
const caseStudyCards: Project[] = professionalCaseStudies.map((c) => ({
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
      {/* Playground mode: a paintable Game of Life behind the cards. */}
      <PlaygroundLayer kind="life" />
      <div className="container-x relative z-10">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
          <div>
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
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 font-mono text-sm text-white/60 transition-colors hover:text-accent"
              >
                All repos on GitHub
                <ArrowUpRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
