import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConciergeBell } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/frontdesk/set-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Not under app/frontdesk/(protected) — a brand-new invite accepter has a
// session (verifyOtp in app/auth/confirm/route.ts set it) but may not yet
// have is_frontdesk set to true in a way they can prove from here, and
// gating on that would be circular anyway: the whole point of this page is
// to finish setting them up. The guard here is simpler and sufficient — any
// signed-in session, same as the one-time nature of the invite link itself.
export const metadata: Metadata = {
  title: "Set Your Password",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function FrontdeskAcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means they landed here directly rather than through
  // app/auth/confirm/route.ts's verifyOtp redirect — the invite link is
  // either stale, already used, or this URL was guessed.
  if (!user) {
    redirect("/frontdesk/login?reason=invalid_link");
  }

  return (
    <main className="bg-grain relative flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="relative z-[1] flex items-center gap-2">
        <ConciergeBell className="size-6 text-[var(--amber-glow)]" aria-hidden="true" />
        <span className="font-heading text-lg font-medium text-foreground">
          GPS Front Desk
        </span>
      </div>

      <Card className="relative z-[1] w-full max-w-md border-[var(--amber-glow)]/20">
        <CardHeader>
          <CardTitle className="text-2xl">Set your password</CardTitle>
          <CardDescription>
            You&apos;ve been invited to the front desk. Choose a password to finish setting up
            {user.email ? ` ${user.email}` : " your account"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
