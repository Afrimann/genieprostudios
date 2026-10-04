import { timingSafeEqual } from "crypto";

import { runDailySweep } from "@/lib/services/reminder-service";

// Vercel Cron entry point for the Phase 4 daily sweep (stale-pending
// cleanup, 24h-before-session auto-cancel, 24h balance reminders). Vercel
// Cron always issues a GET (see vercel.json), and authenticates itself via
// the `authorization: Bearer ${CRON_SECRET}` header Vercel automatically
// attaches to cron-triggered requests — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// Mirrors the Paystack webhook's (app/api/webhooks/paystack/route.ts)
// misconfiguration-vs-client-error distinction: a missing CRON_SECRET is our
// own bug (fail closed, 500), while a present-but-wrong/missing header is
// treated as an unauthorized caller (401).

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("daily-sweep: CRON_SECRET is not configured");
    return new Response(null, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  // timingSafeEqual rather than !== — same reasoning as the Paystack
  // webhook's signature check: a plain compare leaks how much of the secret
  // matched through response timing.
  const providedBuf = Buffer.from(authHeader ?? "", "utf8");
  const expectedBuf = Buffer.from(`Bearer ${cronSecret}`, "utf8");

  if (
    !authHeader ||
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return new Response(null, { status: 401 });
  }

  const summary = await runDailySweep();

  return Response.json(summary, { status: 200 });
}
