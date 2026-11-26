import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, BookingStatus } from "@/lib/services/booking-service";
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
  | { outcome: "refund_required"; newStatus: BookingStatus }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

type ConfirmPaymentRpcResult =
  | {
      outcome: "applied";
      new_status: BookingStatus;
      previous_status: BookingStatus;
      new_amount_paid_kobo: number;
      booking: Booking;
    }
  | { outcome: "already_processed"; new_status: BookingStatus }
  | { outcome: "refund_required"; new_status: BookingStatus; booking_id: string }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

/**
 * Atomically confirms a payment and rolls its amount into the linked
 * booking, deriving the booking's new status the same way for every caller.
 * A payment that loses a slot race is marked refund_required instead.
 * Always uses the service-role admin client — there is no
 * customer session on a webhook, and this same rule (payments/bookings are
 * writable only by service-role, per 0010_rls_policies.sql) applies to the
 * verify-fallback path too, even though a customer's own click triggered it.
 */
export async function confirmPaymentByReference(
  reference: string,
  rawPayload?: unknown,
): Promise<ApplyPaymentResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("confirm_booking_payment", {
    p_reference: reference,
    p_verified_at: new Date().toISOString(),
    p_raw_payload: rawPayload ?? null,
  });

  if (error) {
    return { outcome: "error", message: error.message };
  }

  if (!data) {
    return { outcome: "error", message: "Payment confirmation returned no result." };
  }

  const result = data as ConfirmPaymentRpcResult;

  if (result.outcome === "not_found") {
    return result;
  }

  if (result.outcome === "error") {
    return result;
  }

  if (result.outcome === "refund_required") {
    return { outcome: "refund_required", newStatus: result.new_status };
  }

  if (result.outcome === "already_processed") {
    return { outcome: "already_processed", newStatus: result.new_status };
  }

  const { booking, new_status: newStatus, previous_status: previousStatus } = result;
  const newAmountPaidKobo = result.new_amount_paid_kobo;

  // The newStatus half of wasFirstPayment matters because a successful payment
  // doesn't strictly guarantee a status change (see the newAmountPaidKobo
  // comparison above) — in practice every real payment is exactly the
  // deposit or exactly the balance, so this never actually skips, but it
  // keeps "booking confirmed" from firing on a technicality where nothing
  // actually confirmed, and keeps newStatus's type narrowed to
  // "deposited" | "paid_in_full" below with no unsafe cast needed.
  //
  // Includes 'cancelled'/'auto_cancelled' as a "first payment" starting
  // point, not just 'pending_deposit' — a payment can land here with the
  // booking already cancelled (the stale-pending sweep ran before a slow
  // customer finished paying, then the webhook/reconciliation confirms the
  // charge afterward; see payment-service.ts's reconcilePaymentWithPaystack
  // JSDoc for the full incident this fixes). Before this, that reactivation
  // path sent NO confirmation to the customer at all — she'd have a
  // confirmed, paid booking and no email ever telling her so.
  const wasFirstPayment =
    (previousStatus === "pending_deposit" ||
      previousStatus === "cancelled" ||
      previousStatus === "auto_cancelled") &&
    (newStatus === "deposited" || newStatus === "paid_in_full");
  const wasBalancePayment = previousStatus === "deposited" && newStatus === "paid_in_full";

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
            sessionEndDate: booking.session_end_date,
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
            sessionEndDate: booking.session_end_date,
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
          sessionEndDate: booking.session_end_date,
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
