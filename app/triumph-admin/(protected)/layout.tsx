import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TriumphAdminShell } from "@/components/triumph-admin/triumph-admin-shell";

// Fully separate admin area from /admin (2026-10-01 client request), but
// deliberately reuses the SAME profiles.is_admin flag as /admin rather than
// a new is_triumph_admin column — the "fully separate" decision was about
// UI/URL/nav separation (a deliberate choice against bolting a section onto
// the existing admin nav), not credential separation, and it's the same
// business owner behind both logins. If a non-owner engineer is ever hired
// who shouldn't see GenieProStudios bookings, THAT'S the actual trigger for
// a real role distinction — not built speculatively now.
//
// Same two-check gate + sibling-route-group anti-redirect-loop reasoning as
// app/admin/(protected)/layout.tsx: lives in (protected) so
// /triumph-admin/login (a sibling, not a child) never inherits this guard.
export const instant = false;

export const metadata: Metadata = {
  title: "Triumph Admin",
  robots: { index: false, follow: false },
};

export default async function TriumphAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/triumph-admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/triumph-admin/login");
  }

  return <TriumphAdminShell adminEmail={user.email ?? "Admin"}>{children}</TriumphAdminShell>;
}
