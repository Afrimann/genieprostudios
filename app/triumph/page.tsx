import { Suspense } from "react";

import { TriumphHero } from "@/components/triumph/hero";
import { TriumphMarquee } from "@/components/triumph/marquee";
import { TriumphWhy } from "@/components/triumph/why-triumph";
import { TriumphPortfolioTeaser } from "@/components/triumph/portfolio-teaser";
import { TriumphPricing } from "@/components/triumph/pricing";
import { TriumphBio } from "@/components/triumph/bio";
import { TriumphStartProjectForm } from "@/components/triumph/start-project-form";

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
      <TriumphHero />
      <TriumphMarquee />
      <TriumphWhy />
      <TriumphPricing />
      <Suspense fallback={<PortfolioFallback />}>
        <TriumphPortfolioTeaser />
      </Suspense>
      <TriumphBio />
      <TriumphStartProjectForm />
    </main>
  );
}
