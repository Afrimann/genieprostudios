import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { TriumphTeaser } from "@/components/home/triumph-teaser";
import { PublicServiceCatalog } from "@/components/services/public-service-catalog";

// Public marketing page — static shell + dynamic data via Suspense, per
// AGENTS.md fix #2 (mirrors app/sign-up/page.tsx). No instant=false here:
// there's nothing inherently per-request about this page (no auth, no
// cookies), so a static shell around the dynamic services fetch is the
// correct fit under cacheComponents.

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
            Rehearsal, recording, livestreaming, production, and post-production — with current
            package rates shown up front. Browse by category below, or jump straight to one.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <Suspense fallback={<ServicesFallback />}>
          <PublicServiceCatalog />
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
