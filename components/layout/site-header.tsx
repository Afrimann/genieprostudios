import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HeaderAuthLinks } from "@/components/layout/header-auth-links";
import { MobileNav } from "@/components/layout/mobile-nav";

const NAV_ITEMS = [
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="relative z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-lg font-medium tracking-tight text-foreground"
        >
          Genie Pro Studios
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
          <Suspense fallback={null}>
            <HeaderAuthLinks />
          </Suspense>
          <Button
            asChild
            className="h-9 rounded-none bg-[var(--amber-glow)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="/book">Book a session</Link>
          </Button>
        </div>

        <MobileNav
          navItems={NAV_ITEMS}
          authLinks={
            <Suspense fallback={null}>
              <HeaderAuthLinks />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}
