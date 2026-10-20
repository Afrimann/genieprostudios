import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request so server components
// see a valid session for /admin routes (Supabase Auth, owner-only).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

// Excludes /api/* in addition to the usual static-asset exclusions — nothing
// under app/api/ reads the Supabase session cookie (they're all
// service-role/admin-client or externally-authenticated, e.g. the Paystack
// webhook's signature check and the cron routes' CRON_SECRET bearer token),
// so running this on them was pure unnecessary overhead: an un-guarded
// supabase.auth.getUser() network call ahead of every API request, including
// Paystack's webhook POST. If that Supabase call is ever slow or errors, it
// could throw before the request reaches the route handler at all — a
// silent failure with zero application-level logging, since our code never
// runs. Confirmed as the likely cause of a 2026-10 incident where a
// Paystack webhook never landed (root-cause investigation, see
// app/api/webhooks/paystack/route.ts).
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
