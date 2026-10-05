import type { Metadata } from "next";
import { ConciergeBell } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Separate sign-in from both /login (customers) and /admin/login (owner).
// Gated by app/frontdesk/(protected)/layout.tsx checking is_frontdesk or
// is_admin. Not linked from any public page or nav — staff reach it by URL
// on the reception tablet.
export const metadata: Metadata = {
  title: "Front Desk Sign In",
  robots: { index: false, follow: false },
};

export default function FrontdeskLoginPage() {
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
          <CardTitle className="text-2xl">Front desk sign in</CardTitle>
          <CardDescription>
            Staff access. Sign in with your own account — every clock-in is
            recorded against whoever is signed in here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo="/frontdesk" />
        </CardContent>
      </Card>
    </main>
  );
}
