"use client";

import { useRef, MouseEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { Project } from "@/lib/data";
import { GitHubIcon, ArrowRightIcon } from "../ui/icons";
import Img from "../ui/Img";
import { accentAlpha } from "@/lib/theme";

export default function ProjectCard({ project }: { project: Project }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(420px circle at ${glowX}% ${glowY}%, ${accentAlpha(0.12)}, transparent 60%)`;

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 10);
    rx.set((0.5 - py) * 10);
    glowX.set(px * 100);
    glowY.set(py * 100);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  // The whole card links to its primary destination (live demo > case study > GitHub).
  // The top-right icon buttons override this via their own pointer-events.
  const primaryHref =
    project.live ?? (project.caseStudy ? `/work/${project.caseStudy}` : project.github);
  const primaryExternal = !project.live && !project.caseStudy && !!project.github;
  const primaryLabel = `${project.name} — ${
    project.live ? "open live demo" : project.caseStudy ? "read case study" : "view on GitHub"
  }`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-card/60 p-7 transition-colors duration-300 hover:border-accent/30 ${
        project.featured ? "lg:col-span-2" : ""
      }`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />

      {/* Stretched link — makes the entire card clickable to its primary destination. */}
      {primaryHref && (
        <a
          href={primaryHref}
          {...(primaryExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          aria-label={primaryLabel}
          tabIndex={-1}
          className="absolute inset-0 z-10"
        />
      )}

      {project.image && (
        <div className="pointer-events-none relative z-10 -mx-7 -mt-7 mb-6 h-48 overflow-hidden sm:h-60">
          <Img
            src={project.image}
            alt={project.name}
            width={2000}
            height={1500}
            className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/40 to-transparent" />
        </div>
      )}

      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            {project.accentLabel}
          </span>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {project.name}
          </h3>
        </div>
        <div className="pointer-events-auto relative z-20 flex gap-2">
          {project.live && (
            <a
              href={project.live}
              aria-label={`Open ${project.name} live demo`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent transition-colors hover:bg-accent hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          {project.caseStudy && (
            <a
              href={`/work/${project.caseStudy}`}
              aria-label={`Read the ${project.name} case study`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent transition-colors hover:bg-accent hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2v6h6M8 13h8M8 17h8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${project.name} on GitHub`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:border-accent/40 hover:text-white"
            >
              <GitHubIcon />
            </a>
          )}
        </div>
      </div>

      <p className="pointer-events-none relative z-10 mt-4 text-sm leading-relaxed text-white/60">
        {project.blurb}
      </p>

      <div className="pointer-events-none relative z-10 mt-auto pt-6">
        <div className="flex flex-wrap gap-2">
          {project.tools.map((t) => (
            <span
              key={t}
              className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-white/55"
            >
              {t}
            </span>
          ))}
        </div>
        {(project.live || project.caseStudy) && (
          <a
            href={project.live ?? `/work/${project.caseStudy}`}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-bright"
          >
            {project.live ? project.liveLabel ?? "Launch live demo" : "Read case study"}
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
