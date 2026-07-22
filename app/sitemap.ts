import type { MetadataRoute } from "next";
import { caseStudies } from "@/lib/caseStudies";
import { demos } from "@/lib/demos";
import {
  PROFILE_LAST_MODIFIED,
  RESUME_LAST_MODIFIED,
  SITE_URL,
} from "@/lib/structuredData";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    {
      url: SITE_URL,
      lastModified: new Date(PROFILE_LAST_MODIFIED),
      priority: 1,
    },
    {
      url: `${SITE_URL}/resume`,
      lastModified: new Date(RESUME_LAST_MODIFIED),
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/demos`,
      // The demos hub is as fresh as its most recently updated demo.
      lastModified: new Date(
        Math.max(...demos.map((demo) => new Date(demo.lastModified).getTime()))
      ),
      priority: 0.7,
    },
    ...caseStudies.map((caseStudy) => ({
      url: `${SITE_URL}/work/${caseStudy.slug}`,
      lastModified: new Date(caseStudy.lastModified),
      priority: 0.7,
    })),
    ...demos.map((demo) => ({
      url: `${SITE_URL}/${demo.slug}`,
      lastModified: new Date(demo.lastModified),
      priority: 0.6,
    })),
  ];
  return routes;
}
