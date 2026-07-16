import type { Metadata } from "next";
import BackLink from "@/components/ui/BackLink";
import { profile } from "@/lib/data";

export const metadata: Metadata = {
  title: `Film mode media credits · ${profile.name}`,
  description: "Sources and licenses for the portfolio's optional film-mode media.",
  robots: { index: false, follow: true },
};

type MediaCredit = {
  film: string;
  title: string;
  creator: string;
  href: string;
};

const pixabayMusic: readonly MediaCredit[] = [
  { film: "Casablanca", title: "Vintage Jazz — Coffee Shop Music", creator: "alex-morgan", href: "https://pixabay.com/music/modern-jazz-vintage-jazz-coffee-shop-music-564249/" },
  { film: "The Matrix", title: "matrix redux", creator: "freesound_community", href: "https://pixabay.com/sound-effects/musical-matrix-redux-78819/" },
  { film: "Blade Runner 2049", title: "Police Interrogation (ASMR Noir Jazz)", creator: "KonstantinPazuzuStudio", href: "https://pixabay.com/music/crime-scene-police-interrogation-asmr-noir-jazz-520244/" },
  { film: "Dune", title: "Church choir", creator: "poshpony", href: "https://pixabay.com/music/choir-church-choir-297898/" },
  { film: "The Batman", title: "Siniestro", creator: "anrocomposer", href: "https://pixabay.com/music/modern-classical-siniestro-119656/" },
  { film: "Parasite", title: "Minimal Piano Strings", creator: "TheoJT", href: "https://pixabay.com/music/solo-piano-minimal-piano-strings-195554/" },
  { film: "Arrival", title: "The Futuristic Ambience (Everything Is One)", creator: "AlexGrohl", href: "https://pixabay.com/music/ambient-the-futuristic-ambience-everything-is-one-179395/" },
  { film: "Mad Max: Fury Road", title: "Dystopian Ambient", creator: "Leberch", href: "https://pixabay.com/music/ambient-dystopian-ambient-520165/" },
  { film: "Her", title: "Sad Piano", creator: "SoundGalleryByDmitryTaras", href: "https://pixabay.com/music/solo-piano-sad-piano-496878/" },
  { film: "WALL-E", title: "Space Sleep Drift Atmosphere", creator: "Low_Atmos", href: "https://pixabay.com/music/ambient-space-sleep-drift-atmosphere-514685/" },
  { film: "Fight Club", title: "Take Shape", creator: "Rockot", href: "https://pixabay.com/music/upbeat-take-shape-breakbeat-action-cinematic-techno-315475/" },
  { film: "Goodfellas", title: "Bebop Coffee Shop", creator: "alex-morgan", href: "https://pixabay.com/music/traditional-jazz-bebop-coffee-shop-517090/" },
  { film: "WarGames", title: "Retro Game", creator: "Bransboynd", href: "https://pixabay.com/music/electronic-retro-game-402454/" },
];

const pixabayEffects: readonly MediaCredit[] = [
  { film: "The Matrix", title: "Text Digital Interface", creator: "EstudioCoati", href: "https://pixabay.com/sound-effects/film-special-effects-interface-digital-de-texto-text-digital-interface-218128/" },
  { film: "Mad Max: Fury Road", title: "Car Engine Roaring", creator: "DRAGON-STUDIO", href: "https://pixabay.com/sound-effects/film-special-effects-car-engine-roaring-376881/" },
  { film: "Fight Club", title: "Punch", creator: "Universfield", href: "https://pixabay.com/sound-effects/punch-140236/" },
  { film: "Goodfellas", title: "Car Passing Sound", creator: "Soundque", href: "https://pixabay.com/sound-effects/city-car-passing-sound-soundque-field-recording-442774/" },
];

export default function FilmCreditsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[440px] w-[760px] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-[150px]" />

      <div className="container-x">
        <div className="mb-8 flex items-center justify-between">
          <BackLink href="/" label="Back" />
          <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-accent">
            Film modes
          </h1>
        </div>

        <article className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Media <span className="gradient-accent">credits</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/65">
            The film modes are an optional coding experiment. Sound starts only
            after a visitor selects a film and can be switched off from the
            on-screen control. The site hosts edited copies of the reusable
            recordings below; it does not use movie clips, soundtrack masters,
            or actor voice recordings.
          </p>

          <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-white/70">
            <CreditSection title="Licensed classical recordings">
              <CreditList>
                <CreditItem label="Amadeus">
                  Mozart&apos;s <em>Requiem: Lacrimosa</em>. The composition is
                  public domain; this copyright-free recording was supplied for
                  the project and is normalized and transcoded for web delivery.
                </CreditItem>
                <CreditItem label="2001: A Space Odyssey">
                  Richard Strauss&apos;s <em>Also sprach Zarathustra</em>, performed
                  by Kevin MacLeod. The{" "}
                  <CreditLink href="https://commons.wikimedia.org/wiki/File:Richard_Strauss_-_Also_Sprach_Zarathustra.ogg">
                    source recording
                  </CreditLink>{" "}
                  is licensed under{" "}
                  <CreditLink href="https://creativecommons.org/licenses/by/3.0/">
                    CC BY 3.0
                  </CreditLink>
                  ; this site normalizes and transcodes it.
                </CreditItem>
                <CreditItem label="The Royal Tenenbaums">
                  Erik Satie&apos;s <em>Gymnopédie No. 1</em>, performed by
                  Teknopazzo. The{" "}
                  <CreditLink href="https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg">
                    source recording
                  </CreditLink>{" "}
                  is dedicated to the public domain under CC0 1.0.
                </CreditItem>
              </CreditList>
            </CreditSection>

            <CreditSection title="Pixabay music">
              <p className="mb-4 text-sm text-white/55">
                These recordings are used under the{" "}
                <CreditLink href="https://pixabay.com/service/license-summary/">
                  Pixabay Content License
                </CreditLink>
                . Each is edited for level and web delivery.
              </p>
              <CompactCredits entries={pixabayMusic} />
            </CreditSection>

            <CreditSection title="Pixabay effects">
              <CompactCredits entries={pixabayEffects} />
            </CreditSection>

            <CreditSection title="Background images">
              <p className="text-sm text-white/50">
                The decorative background images layered behind a few grades are
                CC0, public-domain, or U.S. government works. Their exact source
                pages and local edits are retained in the project&apos;s asset
                ledger.
              </p>
            </CreditSection>

            <CreditSection title="Film posters">
              <p>
                Each film is identified by a low-resolution copy of its
                theatrical poster, shown beside an original written review of
                that film. The posters remain the property of their respective
                studios and are used here for criticism and commentary. No
                poster is offered at full resolution or as a download.
              </p>
            </CreditSection>
          </div>
        </article>
      </div>
    </main>
  );
}

function CreditSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-white/65">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CreditList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-4">{children}</ul>;
}

function CreditItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-1 border-l border-white/10 pl-4 sm:grid-cols-[170px_1fr] sm:gap-5">
      <strong className="text-white/85">{label}</strong>
      <span>{children}</span>
    </li>
  );
}

function CompactCredits({ entries }: { entries: readonly MediaCredit[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {entries.map(({ film, title, creator, href }) => (
        <li key={`${film}-${title}`} className="border-l border-white/10 pl-3">
          <span className="block text-xs text-white/45">{film}</span>
          <CreditLink href={href}>{title}</CreditLink>
          <span className="text-white/45"> · {creator}</span>
        </li>
      ))}
    </ul>
  );
}

function CreditLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent transition-colors hover:text-accent-bright"
    >
      {children}
    </a>
  );
}
