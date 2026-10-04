// Money helpers for kobo (bigint) <-> display formatting.
//
// All prices in the DB (services.price_kobo, bookings.total_price_kobo,
// bookings.deposit_amount_kobo, bookings.amount_paid_kobo) are bigint kobo
// (NGN * 100) to avoid floating point money bugs. Supabase returns bigint
// columns as JS `string` over the wire in some client configs and `number`
// in others depending on PostgREST/driver settings — these helpers accept
// both plus native `bigint` so callers don't have to think about it.

export type KoboAmount = number | string | bigint;

/**
 * Converts a kobo amount to a display string, e.g. 3000000 -> "N30,000".
 * Uses "N" instead of the "₦" glyph is NOT done here — the naira sign is
 * used directly; kept as a plain string (not Intl.NumberFormat currency)
 * because NGN formatting via Intl varies by runtime ICU data and we want a
 * guaranteed consistent "₦" + thousands-separated integer naira output with
 * no decimal places (kobo remainders, if any, are not customer-facing).
 */
export function formatKobo(amountKobo: KoboAmount): string {
  const naira = koboToNaira(amountKobo);
  const rounded = Math.round(naira);
  return `₦${rounded.toLocaleString("en-NG")}`;
}

/** Converts a plain naira number (e.g. from a form input) to an integer kobo amount for storage. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Converts a kobo amount to a plain naira number (no formatting). */
export function koboToNaira(amountKobo: KoboAmount): number {
  const asNumber =
    typeof amountKobo === "bigint" ? Number(amountKobo) : Number(amountKobo);

  if (!Number.isFinite(asNumber)) {
    throw new Error(`formatKobo: invalid kobo amount "${String(amountKobo)}"`);
  }

  return asNumber / 100;
}

/**
 * Client-side display-only deposit estimate: 70% of total, rounded up to
 * the nearest kobo, matching Postgres's `ceil(price_kobo * 0.7)` in the
 * book_slot_and_create_booking RPC (see supabase/migrations/0013_book_slot_rpc.sql).
 *
 * IMPORTANT: this is for showing the customer an accurate "you'll pay ~₦X
 * deposit" figure before they book — it must NEVER be sent to the RPC as a
 * parameter. The RPC recomputes the deposit itself server-side from the
 * service's current price_kobo, and that computed value (returned on the
 * booking row) is the sole source of truth for what's actually owed.
 */
export function estimateDepositKobo(totalKobo: KoboAmount): number {
  const total =
    typeof totalKobo === "bigint" ? Number(totalKobo) : Number(totalKobo);

  if (!Number.isFinite(total)) {
    throw new Error(`estimateDepositKobo: invalid kobo amount "${String(totalKobo)}"`);
  }

  return Math.ceil(total * 0.7);
}
