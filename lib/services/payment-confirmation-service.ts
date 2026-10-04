import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus } from "@/lib/services/booking-service";
import {
  sendOwnerNewBookingEmail,
  sendCustomerBookingConfirmedEmail,
  sendCustomerBalancePaidEmail,
} from "@/lib/services/email-service";
import { SITE_URL } from "@/lib/utils/site-url";

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

  // `booking.status` here is still the PRE-update status — the local object
  // was never mutated, only the DB row was, so this is the correct "what
  // was it before this payment" check for both branches below. The
  // newStatus half of wasFirstPayment matters because a successful payment
  // doesn't strictly guarantee a status change (see the newAmountPaidKobo
  // comparison above) — in practice every real payment is exactly the
  // deposit or exactly the balance, so this never actually skips, but it
  // keeps "booking confirmed" from firing on a technicality where nothing
  // actually confirmed, and keeps newStatus's type narrowed to
  // "deposited" | "paid_in_full" below with no unsafe cast needed.
  const wasFirstPayment =
    booking.status === "pending_deposit" && (newStatus === "deposited" || newStatus === "paid_in_full");
  const wasBalancePayment = booking.status === "deposited" && newStatus === "paid_in_full";

  // Notifications, best-effort — never allowed to change the outcome
  // reported to the caller. Owner gets notified only on the first payment
  // (mirrors the original behavior); the customer gets a parallel
  // confirmation on that same first payment, plus a separate one here when
  // a remaining balance lands after an earlier deposit (2026-10-03 client
  // request: "email whenever a booking is successfully made... and also
  // when the remaining balance is paid").
  if (wasFirstPayment || wasBalancePayment) {
    try {
      const [{ data: profile }, { data: service }] = await Promise.all([
        admin.from("profiles").select("full_name, email").eq("id", booking.customer_id).maybeSingle(),
        admin.from("services").select("label").eq("id", booking.service_id).maybeSingle(),
      ]);

      const customerName = profile?.full_name ?? "";
      const customerEmail = profile?.email ?? null;
      const serviceLabel = service?.label ?? "Unknown service";

      if (wasFirstPayment) {
        const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

        if (ownerEmail) {
          await sendOwnerNewBookingEmail({
            ownerEmail,
            customerName: customerName || "Unknown customer",
            customerEmail: customerEmail ?? "unknown",
            serviceLabel,
            sessionDate: booking.session_date,
            sessionStartTime: booking.session_start_time,
            sessionEndTime: booking.session_end_time,
            amountPaidKobo: newAmountPaidKobo,
            totalPriceKobo: booking.total_price_kobo,
            status: newStatus,
          });
        }

        // Re-checking newStatus directly (not just trusting wasFirstPayment)
        // lets TypeScript narrow it to "deposited" | "paid_in_full" on its
        // own — no unsafe cast needed for sendCustomerBookingConfirmedEmail's
        // stricter status param.
        if (customerEmail && (newStatus === "deposited" || newStatus === "paid_in_full")) {
          await sendCustomerBookingConfirmedEmail({
            customerEmail,
            customerName,
            serviceLabel,
            sessionDate: booking.session_date,
            sessionStartTime: booking.session_start_time,
            sessionEndTime: booking.session_end_time,
            amountPaidKobo: newAmountPaidKobo,
            totalPriceKobo: booking.total_price_kobo,
            status: newStatus,
            siteUrl: SITE_URL,
          });
        }
      } else if (customerEmail) {
        await sendCustomerBalancePaidEmail({
          customerEmail,
          customerName,
          serviceLabel,
          sessionDate: booking.session_date,
          sessionStartTime: booking.session_start_time,
          sessionEndTime: booking.session_end_time,
          totalPriceKobo: booking.total_price_kobo,
          siteUrl: SITE_URL,
        });
      }
    } catch (err) {
      console.error("confirmPaymentByReference: unexpected error sending notifications", err);
    }
  }

  return { outcome: "applied", newStatus };
}
