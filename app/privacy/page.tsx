import type { Metadata } from "next";
import { profile } from "@/lib/data";
import BackLink from "@/components/ui/BackLink";
import Glow from "@/components/ui/Glow";

export const metadata: Metadata = {
  title: `Privacy Policy · ${profile.name}`,
  description: `How ${profile.name}'s portfolio handles the limited personal data it collects.`,
  // No reason to index a boilerplate policy page.
  robots: { index: false, follow: true },
};

// Plain-language privacy notice. The site collects very little: contact-form
// submissions (emailed via Resend), the IP used to rate-limit that form, and
// cookieless Vercel analytics. Update "Last updated" when the substance changes.
const LAST_UPDATED = "June 19, 2026";

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-10">
      <Glow className="top-0 h-[400px] w-[700px] blur-[140px]" />

      <div className="container-x">
        <div className="mb-8 flex items-center justify-between">
          <BackLink href="/" label="Back" />
          <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-accent">
            Privacy
          </h1>
        </div>

        <article className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy <span className="gradient-accent">Policy</span>
          </h2>
          <p className="mt-3 font-mono text-xs text-white/60">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/70">
            <p>
              This is the personal portfolio of {profile.name}. It is a simple
              site and collects as little personal data as possible. This page
              explains what is collected, why, and who processes it.
            </p>

            <Section title="What I collect">
              <ul className="space-y-3">
                <Item label="Contact form">
                  When you use the contact form, I receive the{" "}
                  <strong className="text-white/85">name</strong>,{" "}
                  <strong className="text-white/85">email address</strong>, and{" "}
                  <strong className="text-white/85">message</strong> you submit.
                </Item>
                <Item label="IP address">
                  When you submit the contact form, your IP address is read
                  briefly to rate-limit submissions and deter spam. It is not
                  stored in any database.
                </Item>
                <Item label="Usage analytics">
                  I use Vercel Web Analytics to see aggregate, anonymized traffic
                  (page views, country, device type). It is{" "}
                  <strong className="text-white/85">cookieless</strong> and does
                  not track you across other sites or identify you personally.
                </Item>
              </ul>
            </Section>

            <Section title="Why I collect it">
              <p>
                The contact details are used solely to read and reply to the
                message you send me. Analytics are used only to understand which
                pages are visited so I can improve the site. I do not sell,
                rent, or share your information for advertising, and I do not use
                it for any automated decision-making.
              </p>
            </Section>

            <Section title="Who processes it">
              <p>The site relies on two third-party services:</p>
              <ul className="mt-3 space-y-3">
                <Item label="Resend">
                  Contact-form messages are delivered to my inbox through{" "}
                  <a
                    href="https://resend.com/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright"
                  >
                    Resend
                  </a>
                  , an email-delivery provider, which processes your submission
                  in transit.
                </Item>
                <Item label="Vercel">
                  The site is hosted on{" "}
                  <a
                    href="https://vercel.com/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright"
                  >
                    Vercel
                  </a>
                  , which provides hosting and the cookieless analytics described
                  above.
                </Item>
              </ul>
              <p className="mt-3">
                Both are US-based providers, so data handled by them is
                processed in the United States.
              </p>
            </Section>

            <Section title="How long I keep it">
              <p>
                Contact-form messages live in my email inbox and are kept only as
                long as needed to correspond with you. The IP address used for
                rate-limiting is held in memory transiently and is not retained.
                Analytics data is aggregated and anonymized by Vercel.
              </p>
            </Section>

            <Section title="Your choices">
              <p>
                You are never required to use the contact form. If you have sent
                me a message and would like me to delete it, or you want to know
                what I hold about you, just email me at{" "}
                <a
                  href={`mailto:${profile.email}`}
                  className="text-accent hover:text-accent-bright"
                >
                  {profile.email}
                </a>{" "}
                and I will take care of it. Depending on where you live, you may
                have rights to access, correct, or delete your personal data. 
                If that is the case, then contacting me is the way to exercise them.
              </p>
            </Section>

            <Section title="Changes">
              <p>
                If this policy changes, I will update the &ldquo;Last
                updated&rdquo; date above.
              </p>
            </Section>

            <p className="border-t border-white/[0.07] pt-6 text-sm text-white/50">
              Questions about this policy? Reach me at{" "}
              <a
                href={`mailto:${profile.email}`}
                className="text-accent hover:text-accent-bright"
              >
                {profile.email}
              </a>
              .
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-white/65">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 flex-none rotate-45 bg-accent" />
      <span>
        <strong className="text-white/85">{label}.</strong> {children}
      </span>
    </li>
  );
}
