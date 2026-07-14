"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { profile } from "@/lib/data";
import MagneticButton from "../ui/MagneticButton";

const HeroScene = dynamic(() => import("../three/HeroScene"), { ssr: false });

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
      {/* 3D backdrop */}
      <div className="absolute inset-0 z-0">
        <HeroScene />
      </div>
      {/* Vignette + gradient wash so text stays legible */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,6,10,0.55)_70%,rgba(5,6,10,0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-x relative z-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-3xl"
        >
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 font-mono text-xs tracking-wide text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {profile.status}
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-7 text-[2.7rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
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

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
          Scroll
          <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/20 p-1">
            <motion.span
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
          </span>
        </div>
      </motion.div>
    </section>
  );
}
