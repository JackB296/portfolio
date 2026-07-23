import { demos } from "./demos";
import { professionalCaseStudies } from "./caseStudies";

type RingItem = { href: string; label: string };

// Ring 1: professional case studies. /work pages for these cycle among themselves.
const caseStudyRing: RingItem[] = professionalCaseStudies.map((c) => ({
  href: `/work/${c.slug}`,
  label: c.cardName,
}));

// Ring 2: "real projects". The 8-bit computer (a /work page) plus every live demo.
// The 8-bit case-study page and all demo pages cycle through this ring.
const projectRing: RingItem[] = [
  { href: "/work/8-bit-computer", label: "8-Bit Computer" },
  { href: "/work/media-archiver", label: "Media Archiver" },
  ...demos.map((d) => ({ href: `/${d.slug}`, label: `${d.title} ${d.titleAccent}` })),
];

function nextInRing(ring: RingItem[], currentHref: string): RingItem | null {
  if (ring.length === 0) return null;
  const i = ring.findIndex((r) => r.href === currentHref);
  if (i === -1) return ring[0];
  return ring[(i + 1) % ring.length];
}

// Next link for a /work/[slug] page. Case studies cycle through the case-study
// ring; the 8-bit project cycles into the project ring.
export function nextForWork(slug: string): RingItem | null {
  const href = `/work/${slug}`;
  if (caseStudyRing.some((r) => r.href === href)) return nextInRing(caseStudyRing, href);
  return nextInRing(projectRing, href);
}

// Next link for a demo page (e.g. /flappy) cycles through the project ring.
export function nextForDemo(slug: string): RingItem | null {
  return nextInRing(projectRing, `/${slug}`);
}
