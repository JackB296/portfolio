"use client";

import { ReactNode } from "react";
import { skillGroups } from "@/lib/data";
import Reveal from "../ui/Reveal";
import PlaygroundLayer from "../playground/PlaygroundLayer";

const icons: Record<string, ReactNode> = {
  Languages: (
    <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" strokeLinecap="round" strokeLinejoin="round" />
  ),
  Frameworks: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  "Databases & Cloud": (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" strokeLinecap="round" />
    </>
  ),
  "Industrial Systems": (
    <>
      <path d="M3 21h18M5 21V10l5 3V10l5 3V7l4 2v12" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "Tools & Concepts": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" />
    </>
  ),
  Professional: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function Skills() {
  // Bottom padding is tighter than the other sections: the skill cards'
  // ragged pill rows already trail off into whitespace, so a full py-36
  // gap to Contact read as a dead zone once the marquee strip was removed.
  return (
    <section id="skills" className="relative scroll-mt-20 pt-28 pb-20 sm:pt-36 sm:pb-24">
      {/* Playground mode: a sliceable Verlet cloth behind the skill cards. */}
      <PlaygroundLayer kind="cloth" />
      <div className="container-x relative z-10">
        <Reveal>
          <h2 className="mb-14 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Skills.
          </h2>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {skillGroups.map((group, i) => (
            <Reveal key={group.title} delay={i * 0.06}>
              <div className="glass h-full rounded-2xl p-6 transition-colors duration-300 hover:border-accent/25">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      {icons[group.title]}
                    </svg>
                  </span>
                  <h3 className="text-base font-semibold text-white">{group.title}</h3>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {group.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-accent/40 hover:text-white"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
