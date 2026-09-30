import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/utils/site-url";
import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";

// Only indexable routes belong here — everything gated behind auth or
// funnel-only (book, login, sign-up, dashboard/*, admin/*) is excluded, and
// also carries its own `robots: { index: false }` (see those routes'
// layout.tsx/page.tsx metadata) so it's consistently kept out of search
// both ways. Covers both scopes: the main GenieProStudios site AND
// /triumph (Triumph Music Global) — they're one Next.js app with one
// sitemap, not two separate sitemaps.
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/services", changeFrequency: "weekly", priority: 0.8 },
  { path: "/work", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "weekly", priority: 0.8 },
  { path: "/gallery", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/triumph", changeFrequency: "weekly", priority: 0.9 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Best-effort: a Supabase hiccup here shouldn't break sitemap generation
  // for the static routes above — fall back to an empty list of work
  // entries rather than throwing.
  let portfolioEntries: MetadataRoute.Sitemap = [];
  try {
    const entries = await getPublishedPortfolioEntries();
    portfolioEntries = entries.map((entry) => ({
      url: `${SITE_URL}/work/${entry.id}`,
      lastModified: new Date(entry.created_at),
      changeFrequency: "monthly",
      priority: 0.5,
    }));
  } catch (err) {
    console.error("sitemap: failed to load portfolio entries", err);
  }

  return [...staticEntries, ...portfolioEntries];
}
