import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

// Lands the link from a Supabase Auth email (invite today — see
// lib/services/frontdesk-staff-actions.ts — reusable for magic-link/recovery
// later, same route, since verifyOtp's shape doesn't change per type).
//
// WHY A ROUTE HANDLER INSTEAD OF LETTING THE BROWSER CLIENT PARSE THE LINK
// Supabase's default invite email links to `{{ .ConfirmationURL }}`, which
// redirects to `redirectTo` with the session in a URL hash fragment
// (#access_token=...&type=invite) — a Client Component's browser Supabase
// client picks that up automatically via detectSessionInUrl. That's the
// simpler path, and it's deliberately NOT the one used here: hash-fragment
// tokens are fragile against email link-scanners (Outlook/Gmail/corporate
// security gateways routinely "click" links before a human does, consuming
// a one-time token before the real recipient ever sees it) and this
// project's own Supabase/@supabase-ssr version targets the
// token_hash+verifyOtp flow as the supported pattern for SSR apps. This
// route is that flow's server-side half.
//
// MANUAL SUPABASE DASHBOARD STEP REQUIRED (cannot be done from this repo):
// the project's "Invite user" email template must be edited to link here
// instead of the default `{{ .ConfirmationURL }}`:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// `next` is already embedded in the `redirectTo` passed to
// inviteUserByEmail() (see frontdesk-staff-actions.ts) and Supabase exposes
// it to the template as {{ .RedirectTo }}, so the template can instead read:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}
// Also add this route's full URL to Authentication > URL Configuration >
// Redirect URLs for every environment (local/preview/production), or
// Supabase rejects the invite link outright.
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // safeRedirectPath (not raw) — `next` arrives via a URL an email client or
  // a scanner has already touched once; same "never trust a redirect target
  // straight from a query param" discipline as safe-redirect.ts's own doc
  // comment, applied here even though the only current producer is our own
  // invite action.
  const next = safeRedirectPath(searchParams.get("next"), "/frontdesk/login");

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/frontdesk/login?reason=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/frontdesk/login?reason=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
