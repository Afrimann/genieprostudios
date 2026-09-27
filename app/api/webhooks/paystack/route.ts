import { createHmac } from "crypto";

import { confirmPaymentByReference } from "@/lib/services/payment-confirmation-service";

// Paystack webhook handler. This is the primary place a booking is moved
// out of 'pending_deposit' — but NOT the only one: local dev (and any
// production webhook delivery hiccup) means this event can simply never
// arrive, so verifyPaymentWithPaystack() (payment-service.ts, called from
// the /book/confirmation page) is a pull-based fallback that reaches the
// exact same confirmPaymentByReference() state transition. Always uses the
// service-role client inside that shared function — there is no user
// session in a webhook request, and RLS on `payments`/`bookings` has no
// policy that would let an anon/authenticated write happen here anyway (see
// 0010_rls_policies.sql — writes to both tables are service-role only by
// design).
//
// No cacheTag/revalidateTag call here: grepping the codebase turns up no
// existing cacheTag usage anywhere (cacheComponents: true is set in
// next.config.ts, but no route/component has adopted tagged caching yet),
// so adding revalidateTag here would be inventing new caching infra rather
// than plugging into an established pattern — skipped per instructions.

type PaystackChargeSuccessEvent = {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    [key: string]: unknown;
  };
};

export async function POST(request: Request): Promise<Response> {
  // MUST read raw text first — signature verification needs the exact bytes
  // Paystack signed, not a re-serialized JSON.parse(...) round-trip (which
  // is not guaranteed to be byte-identical: key order, whitespace, etc.).
  const rawBody = await request.text();

  const signature = request.headers.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    // Misconfigured server — fail closed. This is our bug, not Paystack's,
    // so a 500 (rather than a 200 "handled") is appropriate; Paystack will
    // retry, which is the right behavior once the env var is fixed.
    console.error("paystack webhook: PAYSTACK_SECRET_KEY is not configured");
    return new Response(null, { status: 500 });
  }

  const expectedSignature = createHmac("sha512", secret).update(rawBody).digest("hex");

  if (!signature || signature !== expectedSignature) {
    return new Response(null, { status: 401 });
  }

  let event: PaystackChargeSuccessEvent;

  try {
    event = JSON.parse(rawBody);
  } catch {
    // Signature matched but body isn't valid JSON — shouldn't happen in
    // practice once the signature check passes, but bail out cleanly rather
    // than throwing.
    return new Response(null, { status: 400 });
  }

  // Paystack retries webhooks on any non-2xx response. Every event type we
  // don't explicitly handle below must still return 200 so Paystack doesn't
  // keep hammering this endpoint for events we intentionally ignore.
  if (event.event !== "charge.success") {
    return new Response(null, { status: 200 });
  }

  const reference = event.data?.reference;

  if (!reference) {
    console.error("paystack webhook: charge.success with no reference", event);
    return new Response(null, { status: 200 });
  }

  const result = await confirmPaymentByReference(reference, event);

  if (result.outcome === "error") {
    console.error("paystack webhook: failed to apply payment", reference, result.message);
  } else if (result.outcome === "not_found") {
    // Nothing to do — either a stale/foreign reference, or (in theory) the
    // webhook arrived before our own initialize-side insert committed.
    console.error("paystack webhook: no payment found for reference", reference);
  }

  // Every outcome (including error/not_found) still acks with 200: Paystack
  // retries on any non-2xx, and none of these failure modes are fixed by a
  // retry with the same payload — they're logged above for us to look into.
  return new Response(null, { status: 200 });
}
