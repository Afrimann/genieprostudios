import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Auth-gated: always needs a live session check, so it can never be
// meaningfully prerendered — opt out of Cache Components' static-shell validation.
export const instant = false;

// Signed-in customer area (dashboard, booking detail, support tickets) —
// noindex covers every route nested under here (dashboard/[id],
// dashboard/support, dashboard/support/[id]) without needing to repeat this
// on each page.
export const metadata: Metadata = {
  title: "Your Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up?redirect=/dashboard");
  }

  return children;
}
