"use server";

import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, BookingStatus } from "@/lib/services/booking-service";

// The three payment choices surfaced to the customer, per project-notes.md's
// deposit model correction: "minimum" and "full" are only ever offered as
// the INITIAL payment on a pending_deposit booking; "balance" is only ever
// offered once a booking has reached "deposited" (i.e. the minimum deposit
// is already in). There is never a customer-supplied custom amount — every
// choice resolves to a server-computed kobo amount read off the booking row
// itself, never trusted from the client.
export type PaymentChoice = "minimum" | "full" | "balance";

export type InitializePaymentResult =
  | { success: true; authorizationUrl: string }
  | { success: false; error: "auth_required"; message: string }
  | { success: false; error: "booking_not_found"; message: string }
  | { success: false; error: "consent_required"; message: string }
  | { success: false; error: "invalid_choice"; message: string }
  | { success: false; error: "no_email"; message: string }
  | { success: false; error: "paystack_error"; message: string }
  | { success: false; error: "unknown"; message: string };

type ResolvedAmount = {
  amountKobo: number;
  type: "deposit" | "balance";
};

/**
 * Resolves a PaymentChoice to a server-trusted kobo amount + payments.type,
 * reading ONLY from the already-fetched booking row (itself fetched via the
 * RLS-scoped client, so it's already guaranteed to belong to the
 * authenticated customer). Never accepts or derives an amount from anything
 * client-supplied.
 *
 * Returns null for any choice/status combination that doesn't make sense
 * (e.g. "minimum"/"full" once already paid_in_full, "balance" before the
 * minimum deposit has landed, or a booking that's cancelled/auto_cancelled)
 * so the caller can reject before ever calling Paystack.
 */
function resolveAmount(booking: Booking, choice: PaymentChoice): ResolvedAmount | null {
  const nonPayableStatuses: BookingStatus[] = ["auto_cancelled", "cancelled", "paid_in_full"];

  if (choice === "minimum" || choice === "full") {
    // Both are the initial payment on the booking — only valid while
    // nothing (or nothing sufficient) has been paid yet.
    if (nonPayableStatuses.includes(booking.status) || booking.status !== "pending_deposit") {
      return null;
    }

    const amountKobo =
      choice === "minimum" ? booking.deposit_amount_kobo : booking.total_price_kobo;

    if (amountKobo <= 0) return null;

    return { amountKobo, type: "deposit" };
  }

  // choice === "balance": only valid once the minimum deposit has already
  // been verified (status = 'deposited'). Explicitly rejects
  // pending_deposit (nothing paid yet — that's "minimum"/"full"'s job),
  // paid_in_full (nothing left to pay), and cancelled/auto_cancelled.
  if (booking.status !== "deposited") {
    return null;
  }

  const amountKobo = booking.total_price_kobo - booking.amount_paid_kobo;

  if (amountKobo <= 0) return null;

  return { amountKobo, type: "balance" };
}

/**
 * Confirms the booking has a valid, current-version T&Cs acceptance linked
 * before any payment is allowed to proceed — enforcing the same rule stated
 * on bookings.tc_acceptance_id's column comment (0005_bookings.sql):
 * "BookingService.book() must refuse to proceed to payment without a valid,
 * linked acceptance for the current terms_version." This must be checked
 * here (server-side, inside initializePayment itself) rather than trusted
 * from the frontend checkbox gate, since a replayed/forged/direct call to
 * this function could otherwise skip consent entirely — the frontend gate
 * is UX, this is the actual enforcement boundary.
 *
 * Two failure modes are treated identically (both return false, both map to
 * the same "consent_required" result at the call site, since from the
 * customer's perspective both mean "you need to (re-)accept the terms
 * before paying"):
 *   1. booking.tc_acceptance_id is null — nothing was ever recorded/linked.
 *   2. The linked tc_acceptances row exists but its terms_version no longer
 *      matches process.env.TERMS_VERSION — the terms changed after the
 *      customer consented, so that consent is stale and no longer valid for
 *      "the current terms_version" as the schema comment requires.
 *
 * Reads via the RLS-scoped client — tc_acceptances_select_own
 * (0010_rls_policies.sql) already allows an authenticated user to select
 * their own rows (customer_id = auth.uid()), so no admin client is needed
 * for this read.
 */
async function hasValidCurrentTcAcceptance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  booking: Booking,
): Promise<boolean> {
  if (!booking.tc_acceptance_id) {
    return false;
  }

  const termsVersion = process.env.TERMS_VERSION;

  if (!termsVersion) {
    // Same misconfiguration case as tc-service.ts's recordTcAcceptance —
    // without a configured terms version there is no "current" version to
    // compare against, so treat consent as unverifiable rather than valid.
    return false;
  }

  const { data: acceptance, error } = await supabase
    .from("tc_acceptances")
    .select("terms_version")
    .eq("id", booking.tc_acceptance_id)
    .maybeSingle();

  if (error || !acceptance) {
    return false;
  }

  return acceptance.terms_version === termsVersion;
}

/**
 * Fetches the authenticated customer's email. profiles.email
 * (0012_add_email_to_profiles.sql) is kept in sync with auth.users.email by
 * a DB trigger, so it's the reliable source in this codebase — but falls
 * back to auth.getUser()'s own `.email` field (already in hand from the
 * caller) if the profiles row is somehow missing/null, rather than failing
 * outright.
 */
async function resolveCustomerEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authEmail: string | null | undefined,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  return profile?.email ?? authEmail ?? null;
}

/**
 * Initializes a Paystack transaction for one of the two/three fixed payment
 * choices on a booking. Never trusts a client-supplied amount — the amount
 * is always resolved server-side from the booking row itself (see
 * resolveAmount()), which is fetched through the RLS-scoped client so it can
 * only ever be a booking the authenticated customer owns.
 *
 * The `payments` row is inserted BEFORE calling Paystack (status='pending')
 * so that a webhook arriving for this reference always has a row to match
 * against, and so the reference is reserved even if the Paystack call itself
 * fails partway through. Per 0010_rls_policies.sql, there is intentionally
 * NO customer insert policy on `payments` ("payments are written exclusively
 * by the service-role client") — a Server Action is trusted server code, but
 * it still runs with the user's cookie-session client for the booking
 * lookup/RLS enforcement above; for this specific insert we deliberately
 * switch to createAdminClient() because the RLS design intent here is "no
 * direct client write ever, full stop", not "customers may write their own
 * pending rows". Using the admin client for this one write is the intended
 * path, not a workaround.
 */
export async function initializePayment(
  bookingId: string,
  choice: PaymentChoice,
): Promise<InitializePaymentResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return {
      success: false,
      error: "auth_required",
      message: "Please sign in before making a payment.",
    };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return {
      success: false,
      error: "unknown",
      message: "Something went wrong while looking up your booking. Please try again.",
    };
  }

  if (!booking) {
    // Either it doesn't exist, or RLS hid it because it belongs to another
    // customer — indistinguishable from the outside, and deliberately so.
    return {
      success: false,
      error: "booking_not_found",
      message: "We couldn't find that booking.",
    };
  }

  const hasValidConsent = await hasValidCurrentTcAcceptance(supabase, booking as Booking);

  if (!hasValidConsent) {
    return {
      success: false,
      error: "consent_required",
      message: "Please accept the terms and conditions before paying.",
    };
  }

  const resolved = resolveAmount(booking as Booking, choice);

  if (!resolved) {
    return {
      success: false,
      error: "invalid_choice",
      message: "This payment option isn't available for your booking's current status.",
    };
  }

  const email = await resolveCustomerEmail(supabase, userData.user.id, userData.user.email);

  if (!email) {
    return {
      success: false,
      error: "no_email",
      message: "We don't have an email on file for your account. Please update your profile.",
    };
  }

  const reference = randomUUID();

  const adminClient = createAdminClient();

  const { error: insertError } = await adminClient.from("payments").insert({
    booking_id: bookingId,
    paystack_reference: reference,
    type: resolved.type,
    amount_kobo: resolved.amountKobo,
    status: "pending",
  });

  if (insertError) {
    return {
      success: false,
      error: "unknown",
      message: "Could not start the payment. Please try again.",
    };
  }

  let paystackResponse: Response;

  try {
    paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: resolved.amountKobo,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book/confirmation`,
      }),
    });
  } catch {
    return {
      success: false,
      error: "paystack_error",
      message: "Could not reach Paystack. Please check your connection and try again.",
    };
  }

  let body: {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };

  try {
    body = await paystackResponse.json();
  } catch {
    return {
      success: false,
      error: "paystack_error",
      message: "Received an unreadable response from Paystack. Please try again.",
    };
  }

  if (!paystackResponse.ok || body.status !== true || !body.data?.authorization_url) {
    // Known historical failure mode in this project: a wrong/placeholder
    // secret key. Paystack returns 401 with a message mentioning "Invalid
    // key" in that case — logged server-side only (never returned to the
    // customer, who has no use for "check your env var" and shouldn't see
    // internal config details) so it's still cheap to diagnose from
    // Vercel's function logs without leaking anything into the UI.
    const looksLikeAuthError =
      paystackResponse.status === 401 ||
      /invalid key/i.test(body.message ?? "");

    if (looksLikeAuthError) {
      console.error(
        `initializePayment: Paystack rejected the request as unauthorized (${body.message ?? "invalid key"}). Check PAYSTACK_SECRET_KEY.`,
      );
    }

    const message = looksLikeAuthError
      ? "Payment couldn't be started right now. Please try again shortly, or contact the studio if this continues."
      : body.message || "Paystack could not initialize this payment. Please try again.";

    return { success: false, error: "paystack_error", message };
  }

  return { success: true, authorizationUrl: body.data.authorization_url };
}

// Minimal additive export for the booking confirmation page's poller
// (app/book/confirmation/page.tsx, components/booking/confirmation-poller.tsx).
// Deliberately kept small and separate from initializePayment() above, which
// is owned by the parallel backend correction pass — this only reads.
export type PaymentStatusResult = {
  status: "pending" | "success" | "failed" | "not_found";
};

/**
 * Looks up a single payment's status by its Paystack reference, scoped to
 * the authenticated customer via the RLS-scoped client (payments_select_own
 * policy, 0010_rls_policies.sql, joins through the payment's booking to
 * require booking.customer_id = auth.uid()) — a customer can never see a
 * payment on someone else's booking. Landing on this page is never itself
 * treated as proof of payment; only this DB read (ultimately written by the
 * Paystack webhook, not this page) counts.
 */
export async function getPaymentStatus(reference: string): Promise<PaymentStatusResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (error || !data) {
    return { status: "not_found" };
  }

  return { status: data.status as PaymentStatusResult["status"] };
}
