import type { Metadata } from "next";

import { TrackLookupForm } from "@/components/triumph/track-lookup-form";
import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

// Public, passwordless "Find Your Project" lookup — Project Code + email,
// no account (see 0023_triumph_projects.sql's comments for why). noindex
// since this is a utility page, not marketing content, same convention as
// /admin/login.
export const metadata: Metadata = {
  title: { absolute: "Find Your Project — Triumph Music Global" },
  robots: { index: false, follow: false },
};

export default function TriumphTrackPage() {
  return (
    <section className="bg-grain relative overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="center" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Find your project
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
            Check your project status
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your project code and the email you submitted with.
          </p>
        </div>
        <TrackLookupForm />
      </Reveal>
    </section>
  );
}
