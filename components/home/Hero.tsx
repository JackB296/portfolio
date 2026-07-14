"use client";

import { motion } from "framer-motion";
import { profile } from "@/lib/data";
import MagneticButton from "../ui/MagneticButton";
import HeroBackdrop from "./HeroBackdrop";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* Ambient color wash behind the automaton */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute right-[5%] top-[18%] h-[440px] w-[440px] rounded-full bg-accent/20 blur-[140px]" />
        <div className="absolute bottom-[8%] left-[12%] h-[320px] w-[360px] rounded-full bg-accent-dim/25 blur-[120px]" />
      </div>
      {/* Switchable backdrop: Game of Life automaton or the 3D orbit scene. */}
      <HeroBackdrop />
      {/* Vignette + gradient wash so text stays legible */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(var(--ink-rgb)/0.55)_70%,rgb(var(--ink-rgb)/0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-x relative z-10 py-20">
        <motion.div
          data-testid="hero-intro"
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-3xl"
        >
          <motion.h1
            variants={item}
            className="text-[2.7rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="text-white">{profile.name}</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-4 font-mono text-sm tracking-wide text-accent-bright sm:text-base"
          >
            {profile.title}
            <span className="text-white/60">{" // "}</span>
            {profile.specialties.join(" · ")}
          </motion.p>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            {profile.tagline}
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap items-center gap-4">
            <MagneticButton href="#projects">
              View Projects
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MagneticButton>
            <MagneticButton href={profile.resume} variant="ghost">
              Resume
            </MagneticButton>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
