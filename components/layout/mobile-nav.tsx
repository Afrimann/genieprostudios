"use client";

import { useState, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string };

interface MobileNavProps {
  navItems: NavItem[];
  authLinks: ReactNode;
  ctaLabel: string;
  ctaHref: string;
}

const linkClassName =
  "rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground data-[active=true]:text-foreground";

// Isolated purely so usePathname() can be Suspense-boundary'd (see below) —
// SiteHeader/MobileNav render from app/(marketing)/layout.tsx, a layout
// shared by every marketing page, so a single static prerender of it can't
// bake in one "correct" active pathname for every page that uses it.
// activePathname is null in the Suspense fallback (no active-link
// highlighting for the brief pre-hydration window) and the real pathname
// once resolved — same links, same onClick, just with/without the
// data-active attribute, so there's exactly one place the link markup lives.
function NavLinks({
  navItems,
  activePathname,
  onNavigate,
}: {
  navItems: NavItem[];
  activePathname: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          data-active={activePathname === item.href}
          className={linkClassName}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

function NavLinksWithPathname({
  navItems,
  onNavigate,
}: {
  navItems: NavItem[];
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  return <NavLinks navItems={navItems} activePathname={pathname} onNavigate={onNavigate} />;
}

export function MobileNav({ navItems, authLinks, ctaLabel, ctaHref }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Any navigation (link click, or the browser/back-forward changing the
  // path) should close the panel — closing purely on click isn't enough
  // since a Link to the already-active route won't trigger a new pathname
  // and wouldn't otherwise be caught, but that's an edge case worth
  // accepting rather than adding an effect keyed on pathname just for it.
  function close() {
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 top-full z-100 overflow-hidden border-b border-border bg-background"
          >
            <nav className="flex flex-col gap-1 px-6 py-4">
              <Suspense
                fallback={<NavLinks navItems={navItems} activePathname={null} onNavigate={close} />}
              >
                <NavLinksWithPathname navItems={navItems} onNavigate={close} />
              </Suspense>

              <div className="mt-2 flex items-center gap-2 border-t border-border pt-4">
                <Button
                  asChild
                  className="h-10 flex-1 rounded-none bg-[var(--amber-glow)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
                  onClick={close}
                >
                  <Link href={ctaHref}>{ctaLabel}</Link>
                </Button>
                {authLinks}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
