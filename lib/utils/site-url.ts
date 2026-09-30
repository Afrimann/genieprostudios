// Single source of truth for the site's absolute base URL — every place
// that needs to build an absolute URL (metadataBase, canonical tags,
// sitemap.ts, robots.ts, JSON-LD, OG image routes) imports SITE_URL from
// here instead of reading process.env.NEXT_PUBLIC_SITE_URL or hardcoding a
// domain directly. When genieprostudios.com goes live, flip
// NEXT_PUBLIC_SITE_URL in the Vercel project's environment variables (and
// .env.local for local prod-parity testing) — nothing in this file or any
// caller needs to change.
//
// NEXT_PUBLIC_SITE_URL is also already used for non-SEO purposes (Paystack's
// callback_url in payment-service.ts, ticket/dashboard links in transactional
// emails) — this is the same variable, not a second one, per the existing
// convention. Local dev keeps it as http://localhost:3000 (.env.local) so
// those existing flows keep working unchanged; the fallback below only
// matters for a production build where the env var is somehow unset.
const FALLBACK_SITE_URL = "https://genieprostudios.vercel.app";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL;

/** Builds an absolute URL from a site-relative path (e.g. "/triumph" -> "https://.../triumph"). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
