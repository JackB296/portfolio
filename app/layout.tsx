import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { profile } from "@/lib/data";
import { gradeBootScript } from "@/lib/grades";
import KonamiCode from "@/components/layout/KonamiCode";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = "https://jbialecki.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${profile.name} · ${profile.title}`,
  description: profile.tagline,
  keywords: [
    "Jackson Bialecki",
    "Jack Bialecki",
    "Jackson Bialecki software engineer",
    "Jack Bialecki Cincinnati",
    "Full Stack Engineer",
    "Software Engineer",
    "AI",
    "Machine Learning",
    "React",
    "Next.js",
    "University of Cincinnati",
  ],
  authors: [{ name: profile.name, url: siteUrl }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${profile.name} · ${profile.title}`,
    description: profile.tagline,
    url: siteUrl,
    siteName: profile.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} · ${profile.title}`,
    description: profile.tagline,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

// Person structured data — helps search engines connect "Jack/Jackson Bialecki" to this site.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  alternateName: ["Jack Bialecki", "Jackson R. Bialecki"],
  jobTitle: profile.title,
  email: `mailto:${profile.email}`,
  url: siteUrl,
  image: `${siteUrl}/opengraph-image`,
  address: { "@type": "PostalAddress", addressLocality: "Cincinnati", addressRegion: "OH", addressCountry: "US" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of Cincinnati" },
  knowsAbout: [
    "Full-Stack Web Development",
    "Artificial Intelligence",
    "Machine Learning",
    "Industrial Control Systems",
    "PostgreSQL",
    "React",
  ],
  sameAs: [profile.github, profile.linkedin],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the grade boot script mutates <html> (style +
    // data attributes) before React hydrates; that mismatch is intentional.
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {/* Re-apply the persisted film grade before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: gradeBootScript() }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        {children}
        <KonamiCode />
        <Analytics />
      </body>
    </html>
  );
}
