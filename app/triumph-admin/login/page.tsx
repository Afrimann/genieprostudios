import type { Metadata } from "next";
import { Music4 } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Deliberately separate from both the customer /login and the Genie Pro
// /admin/login — same profiles.is_admin flag (see the (protected) layout's
// comment for why), just its own URL/shell for the "fully separate admin
// area" decision. Not linked from any public page/nav. Sibling of
// (protected), not a child, same anti-redirect-loop reasoning as
// app/admin/login/page.tsx. Flat/plain on purpose — a sign-in screen for a
// work tool, not a marketing moment.
export const metadata: Metadata = {
  title: "Triumph Admin Sign In",
  robots: { index: false, follow: false },
};

export default function TriumphAdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="flex items-center gap-2.5">
        <Music4 className="size-5 text-[#22e6c8]" aria-hidden="true" />
        <span className="font-heading text-lg font-medium text-foreground">Triumph Control Room</span>
      </div>

      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <CardDescription>
            Owner-only access. Sign in with your admin account to manage Triumph Music Global projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo="/triumph-admin" />
        </CardContent>
      </Card>
    </main>
  );
}
