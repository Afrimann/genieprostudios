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

/**
 * Like absoluteUrl(), but specifically for assets embedded in outgoing
 * emails (logo <img> tags) — never for links. A link only needs to resolve
 * for whoever clicks it (typically the same developer testing locally), so
 * SITE_URL's local-dev value of http://localhost:3000 is fine there. An
 * <img src>, though, is fetched by the recipient's mail client from its own
 * servers (Gmail's, Outlook's), which have no route to a developer's
 * machine — a real test send from local dev would otherwise ship a broken
 * image every time. Falls back to the deployed production URL whenever
 * SITE_URL points at localhost, so logos still render in test emails sent
 * from a local dev server.
 */
export function emailAssetUrl(path: string): string {
  const base = SITE_URL.includes("localhost") ? FALLBACK_SITE_URL : SITE_URL;
  return new URL(path, base).toString();
}
