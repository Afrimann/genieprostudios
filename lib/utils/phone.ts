// Phone formatting helpers for admin-facing CTAs (e.g. the "Chat on
// WhatsApp" button on /admin/customers/[id]). Customer phone numbers are
// collected at sign-up (lib/validation/auth.ts's lenient "optional leading
// +, 7-15 digits" rule) and stored as entered — some are a Nigerian local
// number like "08012345678" (the common case, no country code), others may
// already include one. wa.me requires a full international number with no
// leading zero or '+', so this normalises best-effort rather than strictly
// validating — it's a convenience link for the admin, not a payment path.

/**
 * Strips everything but digits, then drops a Nigerian local-format leading
 * "0" in favour of the "234" country code (the common case for this
 * studio's customer base — see lib/utils/lagos-time.ts's own Nigeria-only
 * assumption). A number already carrying a country code (no leading 0,
 * length > 10) is passed through unchanged.
 */
function toInternationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    return `234${digits.slice(1)}`;
  }

  return digits;
}

/** `https://wa.me/<digits>` — opens a WhatsApp chat with this number, no pre-filled message. */
export function toWhatsAppLink(phone: string): string {
  return `https://wa.me/${toInternationalDigits(phone)}`;
}
