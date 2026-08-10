import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { profile } from "@/lib/data";
import { gradeBootScript } from "@/lib/grades";
import KonamiCode from "@/components/layout/KonamiCode";
import CommentaryRoot from "@/components/commentary/CommentaryRoot";
import GuestTerminal from "@/components/terminal/GuestTerminal";
import PlaygroundToggle from "@/components/playground/PlaygroundToggle";
import FilmExperienceRoot from "@/components/film-experience/FilmExperienceRoot";

// The -base variables are the raw faces; globals.css maps them onto the
// --font-sans / --font-pixel slots the Tailwind families read, so a film
// grade can re-voice the whole site by overriding the slots inline.
const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-base",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// The signature display face: a pixel mono whose letterforms share DNA with
// the Game of Life cells. Self-hosted (OFL license lives next to the file).
const pixel = localFont({
  src: "./fonts/DepartureMono-Regular.woff2",
  variable: "--font-pixel-base",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the grade boot script mutates <html> (style +
    // data attributes) before React hydrates; that mismatch is intentional.
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${pixel.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {/* Re-apply the persisted film grade before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: gradeBootScript() }} />
        {children}
        <FilmExperienceRoot />
        <CommentaryRoot />
        <GuestTerminal />
        <PlaygroundToggle />
        <KonamiCode />
        <Analytics />
      </body>
    </html>
  );
}
