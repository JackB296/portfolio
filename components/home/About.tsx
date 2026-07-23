"use client";

import { profile, education } from "@/lib/data";
import Reveal from "../ui/Reveal";

const competencies = [
  "Full-Stack Web (React · Next.js · Angular · .NET)",
  "Data & Migrations (PostgreSQL · SQL)",
  "Industrial / SCADA Integration",
  "API Design & Third-Party Integration",
  "AI-Assisted Development (Claude Code · Codex · MCP)",
];

export default function About() {
  return (
    <section id="about" className="relative scroll-mt-20 py-28 sm:py-36">
      <div className="container-x">
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <Reveal>
              <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Engineer across the stack and across the{" "}
                <span className="text-accent">physical / digital</span> divide.
              </h2>
            </Reveal>
            <div className="mt-7 space-y-5">
              {profile.bio.map((para, i) => (
                <Reveal key={i} delay={0.1 + i * 0.1}>
                  <p className="max-w-2xl text-base leading-relaxed text-white/65">
                    {para}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2}>
              <ul className="mt-9 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {competencies.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-3 text-sm text-white/75"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rotate-45 bg-accent" />
                    {c}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Education / quick facts card */}
          <Reveal delay={0.15}>
            <div className="glass rounded-2xl p-7">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Education
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">
                {education.school}
              </h3>
              <p className="mt-1 text-sm text-white/60">{education.degree}</p>

              <dl className="mt-6 space-y-3 border-t border-white/[0.07] pt-6 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-white/65">Location</dt>
                  <dd className="text-white/80">{education.location}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/65">Graduation</dt>
                  <dd className="text-white/80">{education.period}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/65">GPA</dt>
                  <dd className="text-accent">{education.gpa}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-white/[0.07] pt-6">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Relevant Coursework
                </p>
                <div className="flex flex-wrap gap-2">
                  {education.coursework.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-white/65"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
