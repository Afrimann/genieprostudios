"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarClock,
  AlertTriangle,
  Clapperboard,
  MessageCircle,
  Users,
  UserRound,
  Activity,
  LogOut,
  Radio,
  Mic2,
} from "lucide-react";

import { signOut } from "@/lib/services/auth-service";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/equipment", label: "Equipment", icon: Mic2 },
  { href: "/admin/bookings", label: "Bookings", icon: AlertTriangle },
  { href: "/admin/customers", label: "Customers", icon: UserRound },
  { href: "/admin/support", label: "Support", icon: MessageCircle },
  { href: "/admin/portfolio", label: "Portfolio", icon: Clapperboard },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/staff", label: "Staff", icon: Users },
] as const;

/**
 * Longest-prefix match against NAV_ITEMS rather than a plain lookup — a
 * future nested page (e.g. a booking detail route under /admin/bookings/[id])
 * would otherwise show no title at all instead of falling back to its
 * section's label.
 */
function currentPageLabel(pathname: string | null): string {
  if (!pathname) return "Admin";

  const match = [...NAV_ITEMS]
    .filter((item) => (item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.label ?? "Admin";
}

interface AdminShellProps {
  adminEmail: string;
  unresolvedCount: number;
  openSupportCount: number;
  children: React.ReactNode;
}

/**
 * Persistent chrome for every /admin/(protected) page — sidebar nav (desktop)
 * / horizontal pill nav (mobile) + sign-out, wrapping whatever page content
 * is rendered. A Client Component purely because usePathname() (active-link
 * highlighting) requires it; the actual auth gate stays entirely in
 * app/admin/(protected)/layout.tsx, this component only renders chrome around
 * already-authorized children.
 *
 * "Studio control room" visual language, reusing the public site's existing
 * amber/near-black theme (already inherited via globals.css's shadcn
 * variables — this component adds the bespoke rack-strip layout and grain
 * texture on top of colors that already apply everywhere) rather than
 * inventing a separate admin palette.
 */
export function AdminShell({ adminEmail, unresolvedCount, openSupportCount, children }: AdminShellProps) {
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut("/admin/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <aside className="bg-grain relative z-10 flex shrink-0 flex-col border-b border-[var(--amber-glow)]/20 bg-card md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="relative z-[1] flex items-center gap-2 border-b border-border px-5 py-5">
          <Radio className="size-5 text-[var(--amber-glow)]" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-heading text-sm font-medium leading-none text-foreground">
              GPS Control Room
            </span>
            <span className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Admin
            </span>
          </div>
        </div>

        <nav className="scrollbar-hide relative z-[1] flex flex-1 gap-1 overflow-x-auto px-3 py-4 md:flex-col md:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;
            const badgeCount =
              item.href === "/admin/bookings"
                ? unresolvedCount
                : item.href === "/admin/support"
                  ? openSupportCount
                  : 0;
            const showBadge = badgeCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex shrink-0 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-[var(--amber-glow)] bg-[var(--amber-glow)]/10 font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-[var(--amber-glow)]/40 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${isActive ? "text-[var(--amber-glow)]" : ""}`}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{item.label}</span>
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="ml-auto h-5 min-w-5 justify-center rounded-none px-1 text-[10px] tabular-nums"
                  >
                    {badgeCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative z-[1] flex flex-col gap-3 border-t border-border px-5 py-4">
          <p className="truncate text-xs text-muted-foreground" title={adminEmail}>
            {adminEmail}
          </p>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-y-auto bg-background">
        <header className="sticky top-0 z-[1] flex shrink-0 items-center border-b border-border bg-background/95 px-6 py-4 backdrop-blur-sm sm:px-8">
          <h1 className="font-heading text-lg font-medium text-foreground">
            {currentPageLabel(pathname)}
          </h1>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
