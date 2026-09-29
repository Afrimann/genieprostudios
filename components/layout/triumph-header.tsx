import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";

// Triumph Music Global is one single-page landing (app/triumph/page.tsx) —
// these are in-page anchors, not routes, same "same-page jump, no reload"
// pattern the gospelsoundclinic.studio reference itself uses. Deliberately
// its own header (not a reskinned SiteHeader): different nav, different CTA
// target, no auth/booking icons — trying to make one component branch for
// both would be more conditional-branching than just having two small
// components.
const NAV_ITEMS = [
  { href: "#pricing", label: "Services" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#start-project", label: "Start a Project" },
];

export function TriumphHeader() {
  return (
    <header className="relative z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/triumph" className="flex items-center" aria-label="Triumph Music Global">
          <Image
            src="/images/triumph-logo-mark.png"
            alt="Triumph Music Global"
            width={150}
            height={84}
            priority
            className="h-8 w-auto rounded-md bg-white p-1"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            asChild
            className="h-9 rounded-none bg-[var(--amber-glow)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="#start-project">Start a Project</Link>
          </Button>
        </div>

        <MobileNav
          navItems={NAV_ITEMS}
          ctaLabel="Start a Project"
          ctaHref="#start-project"
          authLinks={null}
        />
      </div>
    </header>
  );
}
