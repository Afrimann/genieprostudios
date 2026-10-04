import { LogOut } from "lucide-react";

import { exitTriumphProjectAction } from "@/lib/services/triumph-tracking-actions";

// The passwordless counterpart to signing out, for /triumph/track/[code].
// Access there is a 7-day signed cookie, not a Supabase session, so the
// customer-facing SignOutButton (components/layout/sign-out-button.tsx)
// doesn't apply — this clears the tracking + verified cookies instead. See
// exitTriumphProjectAction for why both must go together.
//
// Zero JavaScript: exitTriumphProjectAction is a Server Action, so binding
// the project code and handing it to <form action> needs no client
// boundary. Same approach as the main site's sign-out.
//
// Labelled "Exit" rather than "Sign out" — there is no account or password
// in this flow, so "sign out" would imply a login that never happened.
export function ExitProjectButton({ projectCode }: { projectCode: string }) {
  return (
    <form action={exitTriumphProjectAction.bind(null, projectCode)}>
      <button
        type="submit"
        className="inline-flex shrink-0 items-center gap-1.5 border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-[#22e6c8] hover:text-[#22e6c8]"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        Exit
      </button>
    </form>
  );
}
