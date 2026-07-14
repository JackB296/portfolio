"use client";

import { profile } from "@/lib/data";
import Reveal from "../ui/Reveal";
import ContactForm from "./ContactForm";

export default function Contact() {
  return (
    <section id="contact" className="relative scroll-mt-20 py-28 sm:py-36">
      {/* glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[600px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]" />

      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Left: pitch + direct links */}
          <div>
            <Reveal>
              <h2 className="max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">
                Hire me for Spring 2027.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
                I&apos;m looking for a co-op, and I&apos;m always up for a
                conversation about web, ML, or industrial systems work. Drop me a
                message and I&apos;ll reply soon.
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-8 space-y-3">
                <ContactLink
                  href={`mailto:${profile.email}`}
                  label={profile.email}
                  icon={
                    <>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  }
                />
                <ContactLink
                  href={profile.github}
                  external
                  label={`github.com/${profile.githubHandle}`}
                  icon={
                    <path
                      d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  }
                />
                <ContactLink
                  href={profile.linkedin}
                  external
                  label={`linkedin.com/in/${profile.linkedinHandle}`}
                  icon={
                    <>
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="2" y="9" width="4" height="12" />
                      <circle cx="4" cy="4" r="2" />
                    </>
                  }
                />
              </div>
            </Reveal>
          </div>

          {/* Right: form */}
          <Reveal delay={0.12}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ContactLink({
  href,
  label,
  icon,
  external,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group flex items-center gap-3.5 text-sm text-white/70 transition-colors hover:text-white"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-white/60 transition-colors group-hover:border-accent/40 group-hover:text-accent">
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {icon}
        </svg>
      </span>
      <span className="font-mono">{label}</span>
    </a>
  );
}
