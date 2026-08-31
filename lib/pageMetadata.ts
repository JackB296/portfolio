import type { Metadata } from "next";
import { profile } from "@/lib/data";

// Canonical + social-card metadata for a route. Next.js does not deep-merge
// `alternates` or `openGraph` from parent segments — a page either declares
// its own or inherits the root layout's verbatim, which is how every subpage
// used to self-report as a canonical duplicate of `/` and share the homepage's
// social card. Relative URLs resolve against the layout's `metadataBase`.
export function routeMetadata({
  title,
  description,
  path,
  ogType = "website",
}: Readonly<{
  title: string;
  description: string;
  /** Route path starting with "/", e.g. "/work/jakapa". */
  path: string;
  ogType?: "website" | "article";
}>): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: profile.name,
      type: ogType,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
