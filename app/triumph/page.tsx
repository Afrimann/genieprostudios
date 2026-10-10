import { Suspense } from "react";
import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/utils/site-url";
import { serializeJsonLd } from "@/lib/utils/json-ld";
import { TriumphHero } from "@/components/triumph/hero";
import { TriumphMarquee } from "@/components/triumph/marquee";
import { TriumphArtists } from "@/components/triumph/artists";
import { TriumphWhy } from "@/components/triumph/why-triumph";
import { TriumphPortfolioTeaser } from "@/components/triumph/portfolio-teaser";
import { TriumphPricing } from "@/components/triumph/pricing";
import { TriumphTestimonials } from "@/components/triumph/testimonials";
import { TriumphBio } from "@/components/triumph/bio";
import { TriumphStartProjectForm } from "@/components/triumph/start-project-form";

// Distinct scope from the main GenieProStudios site (different business,
// different audience — see components/triumph/hero.tsx and pricing.tsx for
// the actual offering: mixing/mastering/production, one engineer, global
// remote clients). Does NOT inherit the root layout's title/description —
// this fully replaces them for /triumph, same as how app/opengraph-image.tsx
// is overridden by the sibling app/triumph/opengraph-image.tsx.
export const metadata: Metadata = {
  // `{ absolute: ... }` rather than a plain string — a plain string still
  // runs through the root layout's title template ("%s | GenieProStudios"),
  // which is exactly the "inherits the main site's defaults" this page is
  // supposed to avoid. Confirmed live: without `absolute`, the browser tab
  // showed "Triumph Music Global — Mixing & Mastering | GenieProStudios".
  title: { absolute: "Triumph Music Global — Mixing & Mastering" },
  description:
    "Mixing and mastering built for the moment your song needs to land — clean, balanced, radio-ready masters for artists anywhere in the world.",
  keywords: [
    "Triumph Music Global",
    "Triumph Music",
    "mixing and mastering",
    "online mixing engineer",
    "music mastering service",
    "vocal mixing",
    "remote mixing and mastering",
  ],
  alternates: { canonical: "/triumph" },
  openGraph: {
    type: "website",
    siteName: "Triumph Music Global",
    title: "Triumph Music Global — Mixing & Mastering",
    description:
      "Mixing and mastering built for the moment your song needs to land — clean, balanced, radio-ready masters for artists anywhere in the world.",
    url: "/triumph",
  },
  twitter: {
    card: "summary_large_image",
    title: "Triumph Music Global — Mixing & Mastering",
    description:
      "Mixing and mastering built for the moment your song needs to land — clean, balanced, radio-ready masters for artists anywhere in the world.",
  },
};

// Organization (not MusicGroup — Triumph is a mixing/mastering/production
// SERVICE run by one engineer, not a performing act) — separate identity
// from the main site's Organization JSON-LD in app/layout.tsx, using
// Triumph's own logo per its own branding.
const TRIUMPH_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Triumph Music Global",
  // Short forms people actually search for ("triumph music", "triumph") —
  // helps Google tie those queries back to this entity without claiming any
  // name the business doesn't actually go by.
  alternateName: ["Triumph Music", "Triumph"],
  url: absoluteUrl("/triumph"),
  logo: absoluteUrl("/images/triumph-logo-mark.png"),
  description:
    "Mixing and mastering built for the moment your song needs to land — clean, balanced, radio-ready masters for artists anywhere in the world.",
  areaServed: "Worldwide",
};

// TriumphPortfolioTeaser reads Supabase (via cookies()) — must stay
// Suspense-wrapped, same reasoning as SessionsReel on the Genie Pro home
// page (see app/(marketing)/page.tsx).
function PortfolioFallback() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <p className="text-sm text-muted-foreground">Loading recent work…</p>
      </div>
    </section>
  );
}

export default function TriumphPage() {
  return (
    <main className="flex flex-col">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(TRIUMPH_JSON_LD) }}
      />
      <TriumphHero />
      <TriumphArtists />
      <TriumphMarquee />
      <TriumphWhy />
      <TriumphPricing />
      <Suspense fallback={<PortfolioFallback />}>
        <TriumphPortfolioTeaser />
      </Suspense>
      <TriumphTestimonials />
      <TriumphBio />
      <TriumphStartProjectForm />
    </main>
  );
}
