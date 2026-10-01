import { Suspense } from "react";
import type { Metadata } from "next";

import { Hero } from "@/components/home/hero";
import { FeaturedSession } from "@/components/home/featured-session";
import { AboutTeaser } from "@/components/home/about-teaser";
import { MissionMarquee } from "@/components/home/mission-marquee";
import { ServicesTeaser } from "@/components/home/services-teaser";
import { TriumphTeaser } from "@/components/home/triumph-teaser";
import { SessionsReel } from "@/components/home/sessions-reel";
import { TestimonialsTeaser } from "@/components/home/testimonials-teaser";
import { ContactTeaser } from "@/components/home/contact-teaser";

// ServicesTeaser/FeaturedSession/SessionsReel all read from Supabase (via
// cookies()) — must stay Suspense-wrapped or cacheComponents throws at
// prerender time (the same class of bug already hit on /sign-up, /login,
// /book, and /dashboard).
function ServicesTeaserFallback() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <p className="text-sm text-muted-foreground">Loading services…</p>
      </div>
    </section>
  );
}

function FeaturedSessionFallback() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-24">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    </section>
  );
}

function SessionsReelFallback() {
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <div className="flex gap-6 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-video w-60 shrink-0 animate-pulse rounded-2xl bg-muted sm:w-64" />
          ))}
        </div>
      </div>
    </section>
  );
}

// No `title` here deliberately — the root layout's title.default
// ("GenieProStudios — Recording, Rehearsal & Production Sessions") is meant
// for exactly this page; setting a string title here would instead run it
// through the title template ("X | GenieProStudios"), which is the wrong
// shape for the homepage itself.
export const metadata: Metadata = {
  description:
    "Recording, rehearsal, and production sessions for gospel artists — built for artists who want the finished sound and the finished footage in one booking.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function Home() {
  return (
    <main className="flex flex-col">
      <Hero />
      <Suspense fallback={<FeaturedSessionFallback />}>
        <FeaturedSession />
      </Suspense>
      <AboutTeaser />
      <MissionMarquee />
      <Suspense fallback={<ServicesTeaserFallback />}>
        <ServicesTeaser />
      </Suspense>
      <TriumphTeaser />
      <Suspense fallback={<SessionsReelFallback />}>
        <SessionsReel />
      </Suspense>
      <TestimonialsTeaser />
      <ContactTeaser />
    </main>
  );
}
