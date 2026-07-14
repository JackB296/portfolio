"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { navLinks, profile } from "@/lib/data";
import { GitHubIcon, LinkedInIcon } from "../ui/icons";
import GradeSwitcher from "./GradeSwitcher";
import Monogram from "../ui/Monogram";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between">
        <a href="#top" className="group flex items-center gap-3" aria-label="Home">
          <Monogram />
          <span className="hidden font-mono text-sm tracking-wide text-white/80 sm:inline">
            {profile.firstName}
            <span className="text-accent">.</span>
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="group relative px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
                <span className="absolute inset-x-4 -bottom-0.5 h-px origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
          <li className="ml-2 flex items-center gap-1 border-l border-white/10 pl-3">
            <GradeSwitcher />
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <GitHubIcon className="h-[18px] w-[18px]" />
            </a>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <LinkedInIcon className="h-[18px] w-[18px]" />
            </a>
            <a
              href={profile.resume}
              className="ml-1 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-ink"
            >
              Resume
            </a>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative z-[60] flex h-10 w-10 flex-col items-center justify-center gap-[5px] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <span
            className={`h-0.5 w-6 rounded-full bg-white transition-all duration-300 ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 rounded-full bg-white transition-all duration-300 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 rounded-full bg-white transition-all duration-300 ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </nav>
    </header>

      {/* Mobile menu. Rendered as a SIBLING of <header> (not a child): when the
          header has a backdrop-filter after scrolling, it becomes the containing
          block for fixed descendants, which would shrink this menu to the bar.
          z-40 keeps it under the header (z-50) so the close toggle stays on top.
          No AnimatePresence/exit animation: it unmounts immediately on close, so a
          faded-out overlay can never linger and keep blocking clicks. */}
      {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-40 flex flex-col bg-ink md:hidden"
          >
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />

            {/* spacer under the fixed top bar / toggle */}
            <div className="h-16 flex-none" />

            <nav className="relative flex flex-1 flex-col justify-center px-8">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.08, duration: 0.3 }}
                  className="flex items-center justify-between border-b border-white/[0.07] py-4 text-3xl font-light tracking-tight text-white/85 transition-colors hover:text-accent"
                >
                  {link.label}
                </motion.a>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * navLinks.length + 0.1, duration: 0.3 }}
              className="relative flex items-center justify-between gap-4 px-8 pb-10"
            >
              <div className="flex items-center gap-3">
                <GradeSwitcher />
                <a
                  href={profile.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <GitHubIcon className="h-6 w-6" />
                </a>
                <a
                  href={profile.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <LinkedInIcon className="h-6 w-6" />
                </a>
              </div>
              <a
                href={profile.resume}
                onClick={() => setOpen(false)}
                className="rounded-full border border-accent/40 bg-accent/10 px-7 py-3 text-base font-medium text-accent transition-colors hover:bg-accent hover:text-ink"
              >
                Resume
              </a>
            </motion.div>
          </motion.div>
        )}
    </>
  );
}
