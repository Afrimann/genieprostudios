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
      disallow: [
        "/book",
        "/login",
        "/sign-up",
        "/dashboard",
        "/dashboard/",
        "/admin",
        "/admin/",
        // Added 2026-10-03 (audit finding V-8): these already carried
        // `robots: { index: false }` metadata but were missing from this
        // belt-and-suspenders list. /triumph/track URLs embed the
        // TMG-XXXXXX project code, which is half of an access credential —
        // it shouldn't sit in a crawler's index or request logs.
        "/triumph-admin",
        "/triumph-admin/",
        "/triumph/track",
        "/triumph/track/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
