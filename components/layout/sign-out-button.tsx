import { LogOut } from "lucide-react";

import { signOut } from "@/lib/services/auth-service";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Customer-facing sign-out — the counterpart to the one that already exists
// in components/admin/admin-shell.tsx and triumph-admin-shell.tsx. Until
// this existed, a signed-in customer had no way to sign out anywhere on the
// site (auth-service.ts's signOut doc comment anticipated this: "generic
// enough to reuse for a future customer-facing sign-out").
//
// Presentational + `visible`, same contract as BookingsIconLink/
// SupportIconLink: the signed-in check happens once in
// header-auth-links.tsx, never per-icon, to avoid the concurrent
// auth.getUser() reads that previously hung a Suspense boundary.
//
// Deliberately NOT a Client Component: signOut is already a Server Action
// ("use server" in auth-service.ts), so binding the redirect target and
// handing it straight to <form action> means this ships zero JavaScript.
// The admin shells wrap it in a client handler only because they're already
// Client Components for other reasons ("use client" for usePathname).
//
// Redirects home rather than to /login — a customer signing out is leaving,
// not switching accounts, so bouncing them to a login wall would be hostile.
// (Admin sign-out goes to its own login page because that area has no
// public surface to return to.)
export function SignOutButton({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <form action={signOut.bind(null, "/")}>
          <button
            type="submit"
            aria-label="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-none text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </form>
      </TooltipTrigger>
      <TooltipContent>Sign out</TooltipContent>
    </Tooltip>
  );
}
