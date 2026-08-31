import { profile } from "@/lib/data";
import HeroBackdrop from "./HeroBackdrop";
import { ArrowUpRightIcon } from "../ui/icons";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* Switchable backdrop: Game of Life automaton or the 3D orbit scene. */}
      <HeroBackdrop />
      {/* Vignette + gradient wash so text stays legible */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(var(--ink-rgb)/0.55)_70%,rgb(var(--ink-rgb)/0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-x relative z-10 py-24">
        <div data-testid="hero-intro" className="max-w-4xl">
          <p className="mb-5 font-pixel text-xs lowercase leading-[1.9] tracking-wide text-accent sm:text-[13px]">
            {profile.title} — {profile.location}
            <br />
            {profile.status}
          </p>

          {/* Below sm the size derives from the viewport (name+cursor ≈ 11.15em
              in Departure Mono), so the single line can never wrap or clip. */}
          <h1 className="whitespace-nowrap font-name text-[calc((100vw-48px)/11.5)] uppercase leading-none text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            {profile.name}
            <span className="cursor-blink text-accent" aria-hidden>
              &#9646;
            </span>
          </h1>

          <p className="mt-6 max-w-xl font-pixel text-sm leading-relaxed text-white/70 sm:text-base">
            {profile.tagline}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-4 font-pixel text-sm lowercase">
            <a
              href="#projects"
              className="group inline-flex items-center gap-2 text-accent-bright transition-colors hover:text-white"
            >
              view projects
              <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href={profile.resume}
              className="group inline-flex items-center gap-2 text-accent-bright transition-colors hover:text-white"
            >
              resume
              <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
