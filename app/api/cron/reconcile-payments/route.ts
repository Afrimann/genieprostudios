import { timingSafeEqual } from "crypto";

import { runPaymentReconciliationSweep } from "@/lib/services/payment-service";

// Entry point for the payment reconciliation sweep — the server-side safety
// net for a Paystack webhook that's dropped/delayed and never reconciled by
// a customer's own confirmation-page poll (see payment-service.ts's
// runPaymentReconciliationSweep() for the full incident writeup this is
// fixing). Deliberately NOT wired into vercel.json as a Vercel Cron entry:
// Vercel's Hobby plan caps cron frequency at once-per-day, and this needs a
// much tighter cadence (every 15-30 min) to actually be useful — see
// .github/workflows/reconcile-payments.yml, which calls this route on that
// schedule instead via a plain authenticated HTTP request.
//
// Same CRON_SECRET bearer-auth pattern as app/api/cron/daily-sweep/route.ts
// — the GitHub Actions workflow sets the same header Vercel Cron would have
// attached automatically, since this isn't invoked by Vercel Cron itself.

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("reconcile-payments: CRON_SECRET is not configured");
    return new Response(null, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  const providedBuf = Buffer.from(authHeader ?? "", "utf8");
  const expectedBuf = Buffer.from(`Bearer ${cronSecret}`, "utf8");

  if (
    !authHeader ||
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return new Response(null, { status: 401 });
  }

  const summary = await runPaymentReconciliationSweep();

  return Response.json(summary, { status: 200 });
}
