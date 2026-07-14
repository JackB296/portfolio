"use client";

import Link from "next/link";
import { profile } from "@/lib/data";
import { GitHubIcon, LinkedInIcon } from "../ui/icons";

const socials = [
  { label: "GitHub", href: profile.github, Icon: GitHubIcon },
  { label: "LinkedIn", href: profile.linkedin, Icon: LinkedInIcon },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="container-x flex flex-col items-center justify-between gap-8 sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 font-mono text-sm font-bold text-accent">
              JB
            </span>
            <span className="font-mono text-sm text-white/70">{profile.name}</span>
          </a>
          <p className="mt-2 text-xs text-white/55">
            Designed & built by {profile.firstName}. Next.js · React Three Fiber · GLSL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
            >
              <s.Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
      </div>

      <div className="container-x mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/[0.05] pt-6 sm:flex-row">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] text-white/65">
          <Link href="/#projects" className="transition-colors hover:text-accent">Work</Link>
          <Link href="/demos" className="transition-colors hover:text-accent">Playground</Link>
          <Link href="/resume" className="transition-colors hover:text-accent">Resume</Link>
          <Link href="/privacy" className="transition-colors hover:text-accent">Privacy</Link>
        </nav>
        <p className="font-mono text-[11px] text-white/55">
          © {new Date().getFullYear()} {profile.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
