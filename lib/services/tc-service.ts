"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Discriminated-union result, mirroring the pattern established by
// CreatePendingBookingResult in lib/services/booking-service.ts — the
// frontend branches on `.error`, never parses a raw Postgres/Supabase error
// string itself.
export type RecordTcAcceptanceResult =
  | { success: true; tcAcceptanceId: string }
  | { success: false; error: "auth_required"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Records proof of T&Cs acceptance for the given booking: timestamp
 * (server-set DB default), terms version (from env), and best-effort IP
 * (from the request headers). Recorded per booking, not per account, per
 * project-notes.md.
 *
 * Must be called with the authenticated customer's own session — the
 * customer id is always taken from auth.getUser(), never from a
 * client-supplied parameter, so a caller can never record acceptance on
 * behalf of another customer. Relies on the "tc_acceptances_insert_own" RLS
 * policy (supabase/migrations/0010_rls_policies.sql), which allows an
 * authenticated user to insert a row only where customer_id = auth.uid() —
 * this function uses the RLS-scoped client (not the admin client) precisely
 * so that policy is the actual enforcement boundary, not just a suggestion.
 *
 * accepted_at is intentionally omitted from the insert payload: the column
 * has `default now()` at the DB level (0004_tc_acceptances.sql) and must
 * never be supplied from application code, client or server.
 *
 * ip_address is derived server-side from the `x-forwarded-for` header only
 * — never accepted as a parameter from the caller, since a malicious client
 * could otherwise smuggle an arbitrary value into a column that exists
 * specifically for audit/dispute purposes. Falls back to null in local dev,
 * where there is no real reverse proxy setting that header.
 */
export async function recordTcAcceptance(
  bookingId: string,
): Promise<RecordTcAcceptanceResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return {
      success: false,
      error: "auth_required",
      message: "Please sign in before accepting the terms.",
    };
  }

  const termsVersion = process.env.TERMS_VERSION;

  if (!termsVersion) {
    // Misconfiguration, not a user-facing validation failure — fail loudly
    // rather than silently recording acceptance against an empty/undefined
    // terms version, which would be useless as legal proof.
    return {
      success: false,
      error: "unknown",
      message: "Terms version is not configured. Please contact support.",
    };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  // x-forwarded-for can be a comma-separated list ("client, proxy1, proxy2")
  // when multiple proxies are involved — the first entry is the original
  // client. Falls back to null (not undefined, not "") when the header is
  // absent, matching the ip_address column's nullable text type.
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;

  const { data, error } = await supabase
    .from("tc_acceptances")
    .insert({
      customer_id: userData.user.id,
      booking_id: bookingId,
      terms_version: termsVersion,
      ip_address: ipAddress,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "unknown",
      message: "Could not record your acceptance of the terms. Please try again.",
    };
  }

  // Link the new acceptance back onto bookings.tc_acceptance_id
  // (0005_bookings.sql's column comment: "BookingService.book() must refuse
  // to proceed to payment without a valid, linked acceptance for the
  // current terms_version" — that refusal is only possible if this link
  // actually gets written). There is deliberately NO customer UPDATE policy
  // on `bookings` at all (0010_rls_policies.sql: "Deliberately no
  // insert/update/delete policy for plain customers: all writes happen
  // server-side via the service-role client") — bookings_update_admin is
  // admin-only, so the RLS-scoped client would silently no-op this update
  // (0 rows affected, no error) rather than enforce anything. The admin
  // client is therefore the intended path here, not a workaround: this is
  // exactly the kind of server-only, non-customer write 0010 has in mind.
  const adminClient = createAdminClient();

  const { error: linkError } = await adminClient
    .from("bookings")
    .update({ tc_acceptance_id: data.id })
    .eq("id", bookingId);

  if (linkError) {
    // An acceptance row that never gets linked back defeats the point of
    // recording it (payment-service's consent check reads
    // bookings.tc_acceptance_id, not tc_acceptances directly) — treat this
    // as a full failure of the operation rather than a partial success.
    return {
      success: false,
      error: "unknown",
      message: "Could not record your acceptance of the terms. Please try again.",
    };
  }

  return { success: true, tcAcceptanceId: data.id };
}
