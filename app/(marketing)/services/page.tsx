import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { getActiveServices, type Service } from "@/lib/repositories/service-repository";
import { formatKobo } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Public marketing page — static shell + dynamic data via Suspense, per
// AGENTS.md fix #2 (mirrors app/sign-up/page.tsx). No instant=false here:
// there's nothing inherently per-request about this page (no auth, no
// cookies), so a static shell around the dynamic services fetch is the
// correct fit under cacheComponents.

// Maps DB category values (migration 0002 seed data) to customer-facing
// group headings. Keeping this map here (not in the repository) since it's
// presentation-only — the repository layer must stay dumb data access.
const CATEGORY_LABELS: Record<string, string> = {
  rehearsal_day: "Rehearsal Sessions (Day)",
  rehearsal_night: "Rehearsal Sessions (Night)",
  multitrack_day: "Multi-track Recording (Day)",
  multitrack_night: "Multi-track Recording (Night)",
  video_livestream_day: "Video Livestream",
  virtual_package_day: "Virtual Package (Day)",
  virtual_package_night: "Virtual Package (Night)",
  post_production: "Post-Production Add-ons",
};

// Explicit display order — object key order from a DB query isn't
// guaranteed to match the order we want to present categories in.
const CATEGORY_ORDER = [
  "rehearsal_day",
  "rehearsal_night",
  "multitrack_day",
  "multitrack_night",
  "video_livestream_day",
  "virtual_package_day",
  "virtual_package_night",
  "post_production",
];

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

async function ServicesContent() {
  const services = await getActiveServices();
  const grouped = groupByCategory(services);

  return (
    <div className="flex flex-col gap-10">
      {Array.from(grouped.entries())
        .filter(([, items]) => items.length > 0)
        .map(([category, items]) => (
          <section key={category} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((service) => (
                <Card key={service.id}>
                  <CardHeader>
                    <CardTitle>{service.label}</CardTitle>
                    <CardDescription>
                      {service.is_addon
                        ? "Priced per song"
                        : `${service.duration_hours} hour${service.duration_hours === 1 ? "" : "s"}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{formatKobo(service.price_kobo)}</p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href={`/book?service=${service.id}`}>Book this</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        ))}

      {services.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No services are available right now — please check back soon.
        </p>
      )}
    </div>
  );
}

function ServicesFallback() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 w-full animate-pulse rounded-xl bg-muted" />
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Services &amp; packages
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Everything we offer, up front
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Pick a session below to start booking.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <Suspense fallback={<ServicesFallback />}>
            <ServicesContent />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
