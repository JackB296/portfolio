import type { CaseStudy } from "./caseStudies";
import type { Demo } from "./demos";
import { profile } from "./data";

export const SITE_URL = "https://jbialecki.com";
export const PROFILE_LAST_MODIFIED = "2026-07-20";
/** Bump when the résumé PDF (public/Bialecki_Jackson_Resume2026.pdf) is regenerated. */
export const RESUME_LAST_MODIFIED = "2026-07-19";

const personId = `${SITE_URL}/#person`;

const person = {
  "@id": personId,
  "@type": "Person",
  name: profile.name,
  alternateName: ["Jack Bialecki", "Jackson R. Bialecki"],
  description: profile.tagline,
  jobTitle: profile.title,
  email: `mailto:${profile.email}`,
  url: SITE_URL,
  image: `${SITE_URL}/opengraph-image`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Cincinnati",
    addressRegion: "Ohio",
    addressCountry: "US",
  },
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "University of Cincinnati",
  },
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

/** A minimal reference to `person`, reused wherever schema.org wants an author/creator. */
const personRef = {
  "@id": personId,
  "@type": "Person",
  name: profile.name,
  url: SITE_URL,
};

export const profilePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${SITE_URL}/#profile`,
  url: SITE_URL,
  name: `${profile.name} · ${profile.title}`,
  description: profile.tagline,
  dateModified: PROFILE_LAST_MODIFIED,
  inLanguage: "en-US",
  mainEntity: person,
};

export function caseStudyJsonLd(caseStudy: CaseStudy) {
  const url = `${SITE_URL}/work/${caseStudy.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${url}/#article`,
    url,
    mainEntityOfPage: url,
    headline: caseStudy.headline,
    description: caseStudy.summary,
    dateModified: caseStudy.lastModified,
    inLanguage: "en-US",
    author: personRef,
    keywords: caseStudy.tags,
    ...(caseStudy.image
      ? { image: `${SITE_URL}${caseStudy.image.src}` }
      : {}),
  };
}

export function demoJsonLd(demo: Demo) {
  const url = `${SITE_URL}/${demo.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}/#application`,
    url,
    name: `${demo.title} ${demo.titleAccent}`,
    description: demo.blurb,
    dateModified: demo.lastModified,
    applicationCategory: "EducationalApplication",
    applicationSubCategory: demo.accentLabel,
    operatingSystem: "Any modern web browser",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    inLanguage: "en-US",
    keywords: demo.tags,
    creator: personRef,
    ...(demo.github ? { codeRepository: demo.github } : {}),
  };
}
