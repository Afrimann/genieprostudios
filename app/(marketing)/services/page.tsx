import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { getActiveServices, type Service } from "@/lib/repositories/service-repository";
import { formatKobo } from "@/lib/utils/money";
import { CATEGORY_LABELS, CATEGORY_BLURBS, CATEGORY_ORDER } from "@/lib/data/service-categories";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { TriumphTeaser } from "@/components/home/triumph-teaser";

// Public marketing page — static shell + dynamic data via Suspense, per
// AGENTS.md fix #2 (mirrors app/sign-up/page.tsx). No instant=false here:
// there's nothing inherently per-request about this page (no auth, no
// cookies), so a static shell around the dynamic services fetch is the
// correct fit under cacheComponents.

function groupByCategory(services: Service[]): Map<string, Service[]> {
  const groups = new Map<string, Service[]>();

  for (const category of CATEGORY_ORDER) {
    groups.set(category, []);
  }

  for (const service of services) {
    const bucket = groups.get(service.category) ?? [];
    bucket.push(service);
    groups.set(service.category, bucket);
  }

  return groups;
}

// Per-card mini VU-bar graphic — same "rack unit" motif as
// components/home/services-teaser.tsx, so the full /services page reads as
// a continuation of that teaser rather than a visually different page.
const BAR_HEIGHTS = [10, 16, 12, 20, 14];

function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--amber-glow)]/60 hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
      <div className="flex items-end gap-1" aria-hidden="true">
        {BAR_HEIGHTS.map((height, i) => (
          <span
            key={i}
            style={{ height }}
            className="w-1.5 rounded-none bg-[var(--amber-glow)]/70 transition-all duration-300 group-hover:bg-[var(--amber-glow)]"
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-medium text-foreground">{service.label}</h3>
        <p className="text-sm text-muted-foreground">
          {service.is_addon
            ? "Priced per song · handled remotely, no studio time needed"
            : `${service.duration_hours} hour${service.duration_hours === 1 ? "" : "s"} session`}
        </p>
      </div>

      <p className="font-heading text-2xl font-medium text-foreground">
        {formatKobo(service.price_kobo)}
      </p>

      <div className="mt-auto pt-2">
        {service.is_addon ? (
          // No studio time required — this is Triumph Music Global's
          // territory (remote mixing/mastering), not the room-booking flow,
          // so send the request there instead of into /book.
          <Button asChild className="w-full rounded-none bg-[#22e6c8] text-[#0b0712] hover:bg-[#1cc9ae]">
            <Link href="/triumph#start-project">Send a request to Triumph</Link>
          </Button>
        ) : (
          <Button
            asChild
            className="w-full rounded-none bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href={`/book?service=${service.id}`}>Book this</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

async function ServicesContent() {
  const services = await getActiveServices();
  const grouped = groupByCategory(services);
  const activeCategories = Array.from(grouped.entries()).filter(([, items]) => items.length > 0);

  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No services are available right now — please check back soon.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Jump nav — anchors straight to a category instead of scrolling
          past seven others to find, say, add-ons. Same pill styling as
          components/portfolio/work-grid.tsx's filter buttons, but plain
          anchors (no client-side active-state tracking) since this page
          doesn't hide content behind the nav, it just scrolls to it. */}
      <div className="scrollbar-hide -mx-6 flex gap-2 overflow-x-auto border-b border-border bg-background px-6 py-4">
        {activeCategories.map(([category]) => (
          <a
            key={category}
            href={`#${category}`}
            className="shrink-0 rounded-none border border-border px-4 py-1.5 text-xs font-medium whitespace-nowrap text-foreground/70 transition-colors hover:border-[var(--amber-glow)] hover:text-foreground"
          >
            {CATEGORY_LABELS[category] ?? category}
          </a>
        ))}
      </div>

      {activeCategories.map(([category, items], i) => (
        <section
          key={category}
          id={category}
          className={`scroll-mt-16 border-b border-border ${i % 2 === 0 ? "bg-background" : "bg-card"}`}
        >
          <Reveal className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              {CATEGORY_BLURBS[category] && (
                <p className="max-w-2xl text-sm text-muted-foreground">{CATEGORY_BLURBS[category]}</p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </Reveal>
        </section>
      ))}
    </div>
  );
}

function ServicesFallback() {
  return (
    <div className="flex flex-col gap-4 px-6 py-16">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 w-full animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Every recording, rehearsal, livestream, and mixing & mastering package — priced up front. Pick a session and book online.",
  alternates: { canonical: "/services" },
  openGraph: { url: "/services" },
};

export default function ServicesPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Services &amp; packages
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Every session, priced up front.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Rehearsal, multi-track recording, livestreaming, and mixing &amp; mastering — each
            priced by the hour or by song, no hidden fees. Browse by category below, or jump
            straight to one with the links.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <Suspense fallback={<ServicesFallback />}>
          <ServicesContent />
        </Suspense>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-6 py-16">
          <p className="text-sm text-muted-foreground">Not sure which package fits?</p>
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-none border-border/60 bg-transparent px-6 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <Link href="/contact">Ask us a question</Link>
          </Button>
        </div>
      </section>

      <TriumphTeaser />
    </main>
  );
}
