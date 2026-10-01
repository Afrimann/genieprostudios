"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, LogOut, Music4 } from "lucide-react";

import { signOut } from "@/lib/services/auth-service";

// Visually and structurally parallel to components/admin/admin-shell.tsx,
// but with Triumph's own nav and the teal accent (#22e6c8) already
// established in components/triumph/* — the "fully separate admin area"
// decision (vs. bolting a section onto the existing /admin nav) should
// read as visually real, not just a different URL. Reuses the existing
// profiles.is_admin flag for auth (see app/triumph-admin/(protected)/layout.tsx) —
// same login as /admin, since it's the same business owner.
//
// Deliberately flat/restrained (no gradients, glow, or boxed-icon
// decoration) — this is a daily-use work tool, not a marketing surface,
// and the teal accent is reserved for the active nav item only so it
// still reads as meaningful rather than decorative.
const NAV_ITEMS = [{ href: "/triumph-admin", label: "Projects", icon: LayoutDashboard }] as const;

interface TriumphAdminShellProps {
  adminEmail: string;
  children: React.ReactNode;
}

export function TriumphAdminShell({ adminEmail, children }: TriumphAdminShellProps) {
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut("/triumph-admin/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-card md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
          <Music4 className="size-4 text-[#22e6c8]" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-heading text-sm font-medium leading-none text-foreground">
              Triumph Control Room
            </span>
            <span className="text-[10px] text-muted-foreground">Admin</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-[#22e6c8] font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? "text-[#22e6c8]" : ""}`} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
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
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
