import { Radio } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Deliberately separate from the customer /login page — this is the owner-only
// admin sign-in, gated by app/admin/layout.tsx checking profiles.is_admin.
// Not linked from any public page/nav. Redirects to /admin (the dashboard
// home) rather than /admin/availability now that a dashboard exists.
export default function AdminLoginPage() {
  return (
    <main className="bg-grain relative flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="relative z-[1] flex items-center gap-2">
        <Radio className="size-6 text-[var(--amber-glow)]" aria-hidden="true" />
        <span className="font-heading text-lg font-medium text-foreground">
          GPS Control Room
        </span>
      </div>

      <Card className="relative z-[1] w-full max-w-md border-[var(--amber-glow)]/20">
        <CardHeader>
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <CardDescription>
            Owner-only access. Sign in with your admin account to manage
            availability and bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo="/admin" />
        </CardContent>
      </Card>
    </main>
  );
}
