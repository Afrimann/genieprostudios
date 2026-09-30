import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/utils/site-url";

// Disallow rules are belt-and-suspenders alongside the per-route
// `robots: { index: false }` metadata on book/login/sign-up/dashboard/admin
// (see those routes) — crawlers that respect robots.txt won't even fetch
// these paths, rather than fetching them and then honoring a noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/book", "/login", "/sign-up", "/dashboard", "/dashboard/", "/admin", "/admin/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
