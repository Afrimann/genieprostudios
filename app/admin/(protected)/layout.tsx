import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getUnresolvedCount } from "@/lib/repositories/admin-dashboard-repository";
import { getOpenTicketsAwaitingReplyCount } from "@/lib/repositories/admin-support-repository";
import { AdminShell } from "@/components/admin/admin-shell";

// Owner-only area. Lives in the (protected) route group specifically so that
// /admin/login (a sibling of this group, not a child) never inherits this
// guard — redirecting an unauthenticated/non-admin user to /admin/login from
// a layout that itself wraps /admin/login would otherwise be a redirect loop.
// Route groups are stripped from the URL, so this still guards everything
// that resolves under /admin/* except /admin/login itself, e.g.
// /admin/availability, /admin/bookings, /admin/bookings/[id].
//
// Two checks here, mirroring the RLS policies in
// supabase/migrations/0010_rls_policies.sql:
// 1. Is there a signed-in user at all?
// 2. Does profiles.is_admin = true for that user?
// Both must pass or we bounce to /admin/login. This is a Layout (not Proxy),
// so per the Next.js auth guide it's an "optimistic-ish" check that runs on
// every request to a segment under /admin — it does not run on every
// navigation the way Proxy does, but every full load/refresh of an /admin
// route re-executes this Server Component, which is enough here since admin
// pages are not statically shared between users.
//
// Always needs a live session + profile check, so it can never be
// meaningfully prerendered — opt out of Cache Components' static-shell validation.
export const instant = false;

// Owner-only control room — noindex covers every /admin/* route nested
// under this (protected) group (dashboard, availability, bookings,
// bookings/[id], portfolio, support, support/[id]) without repeating this
// on each page. /admin/login is a sibling outside this group and gets its
// own metadata separately.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/admin/login");
  }

  const [unresolvedCount, openSupportCount] = await Promise.all([
    getUnresolvedCount(),
    getOpenTicketsAwaitingReplyCount(),
  ]);

  return (
    <AdminShell
      adminEmail={user.email ?? "Admin"}
      unresolvedCount={unresolvedCount}
      openSupportCount={openSupportCount}
    >
      {children}
    </AdminShell>
  );
}
