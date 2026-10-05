import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FrontdeskShell } from "@/components/frontdesk/frontdesk-shell";

// Reception area — a genuinely separate environment from /admin and
// /triumph-admin, and the first one in this project gated on something other
// than profiles.is_admin. A receptionist is not an admin: they see today's
// sessions and two buttons, and nothing about revenue, availability, support
// or Triumph. See 0032_frontdesk_role.sql for the role and the RLS that
// actually enforces that separation at the database.
//
// Same (protected) route-group structure and two-check gate as
// app/admin/(protected)/layout.tsx — /frontdesk/login is a sibling of this
// group rather than a child, so it never inherits this guard and the
// redirect below can't loop.
//
// The gate accepts is_admin as well as is_frontdesk, matching
// can_use_frontdesk() in the database. Keeping the two in step matters: a
// gate that let the owner in while RLS did not would show him an empty board
// rather than an error, which is a confusing way to find out about a bug.
export const instant = false;

export const metadata: Metadata = {
  title: "Front Desk",
  robots: { index: false, follow: false },
};

export default async function FrontdeskLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/frontdesk/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_frontdesk, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_frontdesk && !profile?.is_admin) {
    redirect("/frontdesk/login");
  }

  return (
    <FrontdeskShell staffEmail={user.email ?? "Front desk"}>{children}</FrontdeskShell>
  );
}
