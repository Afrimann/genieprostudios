import { createHmac } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus } from "@/lib/services/booking-service";
import { sendOwnerNewBookingEmail } from "@/lib/services/email-service";

// Paystack webhook handler. This is the ONLY place a booking is ever moved
// out of 'pending_deposit' — never on client-side redirect, per
// project-notes.md. Always uses the service-role client: there is no user
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

  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (paymentError) {
    console.error("paystack webhook: failed to look up payment", paymentError);
    return new Response(null, { status: 200 });
  }

  if (!payment) {
    // Nothing to do — either a stale/foreign reference, or (in theory) the
    // webhook arrived before our own initialize-side insert committed.
    // Either way, nothing safe to act on; log and ack.
    console.error("paystack webhook: no payment found for reference", reference);
    return new Response(null, { status: 200 });
  }

  // Idempotency guard: Paystack retries webhooks (e.g. if it doesn't see a
  // fast-enough 200), and this must prevent double-counting a payment that
  // was already verified. If we've already marked this payment successful,
  // do nothing further — in particular, do NOT re-add its amount to the
  // booking's amount_paid_kobo again.
  if (payment.status === "success") {
    return new Response(null, { status: 200 });
  }

  const { error: updatePaymentError } = await admin
    .from("payments")
    .update({
      status: "success",
      verified_at: new Date().toISOString(),
      raw_webhook_payload: event,
    })
    .eq("id", payment.id);

  if (updatePaymentError) {
    console.error("paystack webhook: failed to update payment", updatePaymentError);
    return new Response(null, { status: 200 });
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    console.error(
      "paystack webhook: payment verified but linked booking not found",
      payment.booking_id,
      bookingError,
    );
    return new Response(null, { status: 200 });
  }

  const newAmountPaidKobo = booking.amount_paid_kobo + payment.amount_kobo;

  // Status derivation rule (project-notes.md): applied after ANY successful
  // payment, webhook-driven only. Handles both "pay minimum then pay the
  // rest later" and "pay in full immediately" with one rule.
  let newStatus: BookingStatus;
  if (newAmountPaidKobo >= booking.total_price_kobo) {
    newStatus = "paid_in_full";
  } else if (newAmountPaidKobo >= booking.deposit_amount_kobo) {
    newStatus = "deposited";
  } else {
    newStatus = booking.status;
  }

  const { error: updateBookingError } = await admin
    .from("bookings")
    .update({
      amount_paid_kobo: newAmountPaidKobo,
      status: newStatus,
    })
    .eq("id", booking.id);

  if (updateBookingError) {
    console.error("paystack webhook: failed to update booking", updateBookingError);
    return new Response(null, { status: 200 });
  }

  // Owner notification: only fired the FIRST time this booking receives a
  // successful payment, i.e. when it was pending_deposit before this
  // webhook's update above (never on a later top-up payment, e.g. deposited
  // -> paid_in_full, since the owner was already notified about the booking
  // existing at all when the deposit landed). Checked against `booking`,
  // the row fetched BEFORE the update — `newStatus` is the status AFTER,
  // which would wrongly match every payment on a booking that started life
  // pending_deposit.
  //
  // Wrapped in try/catch and never allowed to affect the response: Paystack
  // must not retry this webhook just because our own notification email
  // failed to send — the payment/booking state above is already correctly
  // persisted regardless of what happens here.
  try {
    if (booking.status === "pending_deposit") {
      const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

      if (!ownerEmail) {
        console.warn("paystack webhook: OWNER_NOTIFICATION_EMAIL is not configured, skipping owner notification");
      } else {
        const [{ data: profile }, { data: service }] = await Promise.all([
          admin.from("profiles").select("full_name, email").eq("id", booking.customer_id).maybeSingle(),
          admin.from("services").select("label").eq("id", booking.service_id).maybeSingle(),
        ]);

        const emailResult = await sendOwnerNewBookingEmail({
          ownerEmail,
          customerName: profile?.full_name ?? "Unknown customer",
          customerEmail: profile?.email ?? "unknown",
          serviceLabel: service?.label ?? "Unknown service",
          sessionDate: booking.session_date,
          sessionStartTime: booking.session_start_time,
          sessionEndTime: booking.session_end_time,
          amountPaidKobo: newAmountPaidKobo,
          totalPriceKobo: booking.total_price_kobo,
          status: newStatus,
        });

        if (!emailResult.success) {
          console.error("paystack webhook: failed to send owner notification email", emailResult.message);
        }
      }
    }
  } catch (err) {
    console.error("paystack webhook: unexpected error while sending owner notification", err);
  }

  return new Response(null, { status: 200 });
}
