import type { Metadata } from "next";
import BackLink from "@/components/ui/BackLink";
import Glow from "@/components/ui/Glow";
import { films } from "@/lib/films";
import { profile } from "@/lib/data";

export const metadata: Metadata = {
  title: `Film mode media credits · ${profile.name}`,
  description: "Sources and licenses for the portfolio's optional film-mode media.",
  robots: { index: false, follow: true },
};

type CreditRow = {
  film: string;
  title: string;
  creator: string;
  href: string;
};

// Derived from each film's registry record, so a swapped track updates its
// attribution here in the same edit. Classical/public-domain recordings are
// credited as prose below instead.
const pixabayMusic: readonly CreditRow[] = films.flatMap(({ film, credits }) =>
  credits.pixabayMusic ? [{ film, ...credits.pixabayMusic }] : []
);

const pixabayEffects: readonly CreditRow[] = films.flatMap(({ film, credits }) =>
  (credits.pixabayEffects ?? []).map((credit) => ({ film, ...credit }))
);

export default function FilmCreditsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-10">
      <Glow className="top-0 h-[440px] w-[760px] blur-[150px]" />

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
            <CreditSection title="Classical & vintage recordings">
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
                <CreditItem label="Casablanca">
                  A Jelly Roll Morton side from{" "}
                  <em>Giants of Jazz — 3 LPs (1923–39)</em>, a collection of
                  historical recordings. The copy hosted here is edited for
                  level and web delivery.
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

            <CreditSection title="Synthesized voice">
              <p>
                The 2001: A Space Odyssey mode occasionally whispers HAL 9000&apos;s
                line &ldquo;I&apos;m sorry, Dave. I&apos;m afraid I can&apos;t do
                that.&rdquo; as an homage. The audio is generated locally with the
                macOS &ldquo;Whisper&rdquo; text-to-speech voice — it is not the
                film&apos;s recording and does not imitate the original actor. The
                quoted line is used for commentary and criticism.
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

function CompactCredits({ entries }: { entries: readonly CreditRow[] }) {
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
