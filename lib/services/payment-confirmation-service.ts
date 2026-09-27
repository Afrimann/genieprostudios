import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus } from "@/lib/services/booking-service";
import { sendOwnerNewBookingEmail } from "@/lib/services/email-service";

// Shared by both confirmation paths for a Paystack charge:
//   1. app/api/webhooks/paystack/route.ts — Paystack pushing us a
//      charge.success event (the primary path in production).
//   2. verifyPaymentWithPaystack() in payment-service.ts — us pulling the
//      transaction status directly from Paystack's verify endpoint (the
//      fallback path, needed because a webhook can never reach a local dev
//      server, and can also legitimately be delayed/dropped in production).
// Both paths must apply the exact same idempotent state transition, so it
// lives here once rather than being duplicated and risking drift.
export type ApplyPaymentResult =
  | { outcome: "applied"; newStatus: BookingStatus }
  | { outcome: "already_processed"; newStatus: BookingStatus }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

/**
 * Marks a `payments` row success (idempotently) and rolls its amount into
 * the linked booking, deriving the booking's new status the same way for
 * every caller. Always uses the service-role admin client — there is no
 * customer session on a webhook, and this same rule (payments/bookings are
 * writable only by service-role, per 0010_rls_policies.sql) applies to the
 * verify-fallback path too, even though a customer's own click triggered it.
 */
export async function confirmPaymentByReference(
  reference: string,
  rawPayload?: unknown,
): Promise<ApplyPaymentResult> {
  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (paymentError) {
    return { outcome: "error", message: paymentError.message };
  }

  if (!payment) {
    return { outcome: "not_found" };
  }

  if (payment.status === "success") {
    // Idempotency guard — a retried webhook, or the verify-fallback racing
    // a webhook that already landed, must never double-count this payment.
    const { data: existingBooking } = await admin
      .from("bookings")
      .select("status")
      .eq("id", payment.booking_id)
      .maybeSingle();

    return {
      outcome: "already_processed",
      newStatus: (existingBooking?.status as BookingStatus) ?? "deposited",
    };
  }

  const { error: updatePaymentError } = await admin
    .from("payments")
    .update({
      status: "success",
      verified_at: new Date().toISOString(),
      ...(rawPayload ? { raw_webhook_payload: rawPayload } : {}),
    })
    .eq("id", payment.id);

  if (updatePaymentError) {
    return { outcome: "error", message: updatePaymentError.message };
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    return { outcome: "error", message: bookingError?.message ?? "Booking not found" };
  }

  const newAmountPaidKobo = booking.amount_paid_kobo + payment.amount_kobo;

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
    .update({ amount_paid_kobo: newAmountPaidKobo, status: newStatus })
    .eq("id", booking.id);

  if (updateBookingError) {
    return { outcome: "error", message: updateBookingError.message };
  }

  // Owner notification, best-effort, only on the FIRST payment (mirrors the
  // webhook's original behavior) — never allowed to change the outcome
  // reported to the caller.
  try {
    if (booking.status === "pending_deposit") {
      const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

      if (ownerEmail) {
        const [{ data: profile }, { data: service }] = await Promise.all([
          admin.from("profiles").select("full_name, email").eq("id", booking.customer_id).maybeSingle(),
          admin.from("services").select("label").eq("id", booking.service_id).maybeSingle(),
        ]);

        await sendOwnerNewBookingEmail({
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
      }
    }
  } catch (err) {
    console.error("confirmPaymentByReference: unexpected error sending owner notification", err);
  }

  return { outcome: "applied", newStatus };
}
