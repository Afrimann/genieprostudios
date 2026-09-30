import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";
import { WorkGrid } from "@/components/portfolio/work-grid";
import { Button } from "@/components/ui/button";

// Public marketing/exhibition page — static shell + dynamic Supabase read
// via Suspense, same treatment as app/services/page.tsx (AGENTS.md fix #2:
// cacheComponents throws for any Server Component reading uncached dynamic
// data outside <Suspense>). No auth/cookies here, so a static shell around
// the dynamic fetch is the right fit.

async function WorkContent() {
  const entries = await getPublishedPortfolioEntries();

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No work has been published yet — check back soon.
      </p>
    );
  }

  return <WorkGrid entries={entries} />;
}

function WorkFallback() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-none bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "A look at sessions we've recorded, mixed, and shot for gospel artists — browse recordings, livestreams, and produced sessions.",
  alternates: { canonical: "/work" },
  openGraph: { url: "/work" },
};

export default function WorkPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Selected work
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Sound, shot right.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            A look at sessions we&apos;ve recorded, mixed, and shot — filter by category
            below, or open any piece for the full clip.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <Suspense fallback={<WorkFallback />}>
            <WorkContent />
          </Suspense>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-6 py-16">
          <p className="text-sm text-muted-foreground">Ready to create something?</p>
          <Button
            asChild
            className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="/book">Book a session</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
