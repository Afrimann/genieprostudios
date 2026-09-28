import { Resend } from "resend";

import { formatKobo } from "@/lib/utils/money";

// Thin wrapper around Resend for the four Phase 4 transactional emails
// (owner new-booking notice, customer balance reminder, auto-cancel notice
// to both parties). Plain HTML template strings, no react-email dependency,
// per the spec for this phase. None of these functions ever throw — a
// failed/unsent email must never abort a DB state transition (marking a
// booking auto_cancelled, etc.) or cause a Paystack webhook to return a
// non-2xx — so every path returns a typed result instead.

export type SendEmailResult = { success: true } | { success: false; message: string };

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Expected in local dev before a Resend account is wired up — logged as
    // a warning (not an error) so the DB-mutation side of the sweep stays
    // testable without a real Resend account configured, per the Phase 4
    // spec's verification notes.
    console.warn("email-service: RESEND_API_KEY is not configured, skipping email send");
    return null;
  }

  return new Resend(apiKey);
}

function getFromAddress(): string {
  // Falls back to Resend's own sandbox sender if unset, so a missing env var
  // doesn't itself become the failure reason once RESEND_API_KEY is present.
  return process.env.RESEND_FROM_EMAIL || "GenieProStudios <onboarding@resend.dev>";
}

/**
 * Shared send path: every exported function below builds its own subject +
 * HTML body and delegates here. Never throws — Resend SDK/network failures
 * are caught and mapped to { success: false }.
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      message: "RESEND_API_KEY is not configured; email not sent.",
    };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error("email-service: Resend returned an error", error);
      return { success: false, message: error.message ?? "Resend failed to send the email." };
    }

    return { success: true };
  } catch (err) {
    console.error("email-service: unexpected error sending email", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unexpected error sending email.",
    };
  }
}

/** Common "date at time" line used across all four templates below. */
function formatSessionLine(sessionDate: string, sessionStartTime: string, sessionEndTime?: string): string {
  return sessionEndTime
    ? `${sessionDate}, ${sessionStartTime}–${sessionEndTime}`
    : `${sessionDate}, ${sessionStartTime}`;
}

/**
 * Owner-only notification fired from the Paystack webhook the first time a
 * booking receives a successful payment (pending_deposit -> deposited or
 * paid_in_full). `status` is the booking's new status after that payment, so
 * the owner knows immediately whether it's a deposit or a full payment.
 */
export async function sendOwnerNewBookingEmail(params: {
  ownerEmail: string;
  customerName: string;
  customerEmail: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  amountPaidKobo: number;
  totalPriceKobo: number;
  status: string;
}): Promise<SendEmailResult> {
  const {
    ownerEmail,
    customerName,
    customerEmail,
    serviceLabel,
    sessionDate,
    sessionStartTime,
    sessionEndTime,
    amountPaidKobo,
    totalPriceKobo,
    status,
  } = params;

  const html = `
    <h2>New booking received</h2>
    <p><strong>${customerName}</strong> (${customerEmail}) has paid for a session.</p>
    <ul>
      <li><strong>Service:</strong> ${serviceLabel}</li>
      <li><strong>Session:</strong> ${formatSessionLine(sessionDate, sessionStartTime, sessionEndTime)}</li>
      <li><strong>Amount paid so far:</strong> ${formatKobo(amountPaidKobo)} of ${formatKobo(totalPriceKobo)}</li>
      <li><strong>Booking status:</strong> ${status}</li>
    </ul>
  `.trim();

  return sendEmail({
    to: ownerEmail,
    subject: `New booking: ${serviceLabel} — ${sessionDate}`,
    html,
  });
}

/**
 * Customer-facing reminder that the remaining balance on a deposited booking
 * is due, sent by runBalanceReminderSweep() at most once per 24h per booking
 * (dedupe enforced upstream via reminder_log, see reminder-repository.ts).
 * Links to /dashboard rather than a direct pay link, since the "pay balance"
 * action lives there (booking-flow-actions.ts's PaymentChoice = "balance").
 */
export async function sendBalanceReminderEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  balanceRemainingKobo: number;
  siteUrl: string;
}): Promise<SendEmailResult> {
  const { customerEmail, customerName, serviceLabel, sessionDate, sessionStartTime, balanceRemainingKobo, siteUrl } =
    params;

  const dashboardUrl = `${siteUrl}/dashboard`;

  const html = `
    <h2>Your balance is due</h2>
    <p>Hi ${customerName || "there"},</p>
    <p>
      You have a remaining balance of <strong>${formatKobo(balanceRemainingKobo)}</strong> for your
      <strong>${serviceLabel}</strong> session on <strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong>.
    </p>
    <p>Please settle this at least 24 hours before your session to avoid automatic cancellation.</p>
    <p><a href="${dashboardUrl}">Pay your balance</a></p>
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject: `Balance due: ${serviceLabel} — ${sessionDate}`,
    html,
  });
}

/**
 * Customer-facing notice sent alongside sendAutoCancelOwnerEmail() when a
 * deposited booking is auto-cancelled for non-payment within 24h of the
 * session start. Fired AFTER the booking's status has already been updated
 * to auto_cancelled (see runAutoCancelSweep()) — this is a best-effort
 * notification, not part of the state transition itself.
 */
export async function sendAutoCancelCustomerEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
}): Promise<SendEmailResult> {
  const { customerEmail, customerName, serviceLabel, sessionDate, sessionStartTime } = params;

  const html = `
    <h2>Your booking has been cancelled</h2>
    <p>Hi ${customerName || "there"},</p>
    <p>
      Your <strong>${serviceLabel}</strong> session on
      <strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong> has been automatically cancelled
      because the remaining balance was not paid at least 24 hours before the session.
    </p>
    <p>If you'd still like to book, please make a new booking on our site.</p>
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject: `Booking cancelled: ${serviceLabel} — ${sessionDate}`,
    html,
  });
}

/**
 * Owner-facing counterpart to sendAutoCancelCustomerEmail(), fired together
 * (both best-effort, independently) so the owner knows a slot they were
 * expecting to be used just opened back up.
 */
export async function sendAutoCancelOwnerEmail(params: {
  ownerEmail: string;
  customerName: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
}): Promise<SendEmailResult> {
  const { ownerEmail, customerName, serviceLabel, sessionDate, sessionStartTime } = params;

  const html = `
    <h2>Booking auto-cancelled (unpaid balance)</h2>
    <p>
      <strong>${customerName}</strong>'s <strong>${serviceLabel}</strong> session on
      <strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong> was automatically cancelled — the
      remaining balance was not paid at least 24 hours before the session.
    </p>
  `.trim();

  return sendEmail({
    to: ownerEmail,
    subject: `Auto-cancelled: ${serviceLabel} — ${sessionDate}`,
    html,
  });
}

/**
 * Owner notification fired from support-service.ts's sendTicketMessage()
 * whenever a CUSTOMER sends a message on their front-desk ticket (never for
 * an admin's own reply) — best-effort, same as every other email here.
 */
export async function sendOwnerNewSupportMessageEmail(params: {
  ownerEmail: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  ticketUrl: string;
}): Promise<SendEmailResult> {
  const { ownerEmail, customerName, customerEmail, subject, body, ticketUrl } = params;

  const html = `
    <h2>New message from the front desk chat</h2>
    <p><strong>${customerName}</strong> (${customerEmail}) wrote in on: <strong>${subject}</strong></p>
    <blockquote style="margin:0;padding-left:12px;border-left:3px solid #ccc;">${body}</blockquote>
    <p><a href="${ticketUrl}">Reply in the admin dashboard</a></p>
  `.trim();

  return sendEmail({
    to: ownerEmail,
    subject: `Front desk: ${customerName} — ${subject}`,
    html,
  });
}
