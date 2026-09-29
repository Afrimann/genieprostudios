"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENTS = [
  { brand: "geniepro", href: "/", label: "Genie Pro" },
  { brand: "triumph", href: "/triumph", label: "Triumph Music Global" },
] as const;

// A quiet utility line above the main header — deliberately understated
// (plain text, no border/fill box) rather than a loud bordered pill, per
// explicit feedback that the earlier boxed version was "too obvious" for
// what's a secondary affordance, not a primary nav item. Self-determines
// both whether to render and which segment is active from the current
// pathname, rather than each layout passing an `active` prop — dashboard
// pages live under app/(marketing)/dashboard/, nested inside the SAME
// layout that renders SiteHeader (app/(marketing)/layout.tsx), and a nested
// layout can't remove chrome an ancestor already rendered — so "public
// pages only, not dashboard" has to be decided in here, not by which layout
// calls this component. usePathname() requires a Suspense boundary in this
// codebase's Cache Components setup (same reasoning as mobile-nav.tsx's
// NavLinksWithPathname) — fallback renders nothing, same as
// HeaderAuthLinks's Suspense fallback elsewhere in site-header.tsx, so the
// bar pops in once resolved rather than blocking the shell.
function BrandToggleBarInner() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  const active = pathname?.startsWith("/triumph") ? "triumph" : "geniepro";

  return (
    <div className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-6 py-1.5">
        {SEGMENTS.map((segment, i) => {
          const isActive = segment.brand === active;
          return (
            <span key={segment.brand} className="flex items-center gap-3">
              {i > 0 && <span className="text-[10px] text-muted-foreground/40">·</span>}
              <Link
                href={segment.href}
                aria-current={isActive ? "page" : undefined}
                className={`text-[10px] tracking-wide uppercase transition-colors ${
                  isActive
                    ? "font-medium text-muted-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
              >
                {segment.label}
              </Link>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BrandToggleBar() {
  return (
    <Suspense fallback={null}>
      <BrandToggleBarInner />
    </Suspense>
  );
}
