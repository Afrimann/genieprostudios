import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

// Root-level 404 — catches any unmatched URL app-wide (both the main site
// and /triumph, since this renders outside both (marketing)/layout.tsx and
// app/triumph/layout.tsx, at the app/layout.tsx level). Deliberately
// standalone (no SiteHeader/TriumphHeader — a 404 doesn't know which brand
// context the visitor meant to be in) but still on-theme and with a clear
// way back.
export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="bg-grain flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
        404
      </span>
      <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
        This page doesn&apos;t exist.
      </h1>
      <p className="max-w-md text-base text-muted-foreground">
        The link might be outdated, or the page may have moved.
      </p>
      <Button
        asChild
        className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
      >
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
