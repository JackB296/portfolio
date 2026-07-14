import type { MetadataRoute } from "next";
import { caseStudies } from "@/lib/caseStudies";
import { demos } from "@/lib/demos";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://jbialecki.com";
  const now = new Date();
  const routes = [
    { url: base, priority: 1 },
    { url: `${base}/resume`, priority: 0.8 },
    { url: `${base}/demos`, priority: 0.7 },
    ...caseStudies.map((c) => ({ url: `${base}/work/${c.slug}`, priority: 0.7 })),
    ...demos.map((d) => ({ url: `${base}/${d.slug}`, priority: 0.6 })),
  ];
  return routes.map((r) => ({ ...r, lastModified: now }));
}
