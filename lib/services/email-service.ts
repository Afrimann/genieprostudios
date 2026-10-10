import { Resend } from "resend";

import { formatKobo } from "@/lib/utils/money";
import { GENIE_PRO_BRAND, TRIUMPH_BRAND } from "@/lib/email/brand";
import { escapeHtml, escapeHtmlMultiline } from "@/lib/email/escape-html";
import {
  renderEmailLayout,
  eyebrow,
  heading,
  paragraph,
  detailTable,
  calloutBox,
  codeBlock,
  ctaButton,
} from "@/lib/email/layout";

// Thin wrapper around Resend for every transactional email this project
// sends (GenieProStudios booking lifecycle + support, Triumph Music Global
// project lifecycle). Every email body is built from lib/email/layout.ts's
// shared template shell plus the GenieProStudios or Triumph brand config in
// lib/email/brand.ts — no ad-hoc inline HTML per email anymore. None of
// these functions ever throw — a failed/unsent email must never abort a DB
// state transition (marking a booking auto_cancelled, etc.) or cause a
// Paystack webhook to return a non-2xx — so every path returns a typed
// result instead.

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

/**
 * Builds the From header for a given display name, reusing whatever address
 * RESEND_FROM_EMAIL (or its sandbox fallback) resolves to — Triumph Music
 * Global and GenieProStudios currently share one Resend account/domain, so
 * only the display name changes per sender, never the underlying address.
 */
function getFromAddress(senderName: string = "GenieProStudios"): string {
  const configured = process.env.RESEND_FROM_EMAIL || "GenieProStudios <onboarding@resend.dev>";
  const match = configured.match(/<(.+)>/);
  const address = match ? match[1] : configured;
  return `${senderName} <${address}>`;
}

/**
 * Shared send path: every exported function below builds its own subject +
 * HTML body and delegates here. Never throws — Resend SDK/network failures
 * are caught and mapped to { success: false }. `fromName` overrides the
 * sender display name (e.g. "Triumph Music Global") while keeping the same
 * underlying address — see getFromAddress().
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
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
      from: getFromAddress(params.fromName),
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

/**
 * Common "date at time" line used across several templates below. When
 * `sessionEndDate` is provided and differs from `sessionDate` (an overnight
 * session that crosses midnight — see bookings.session_end_date,
 * 0036_blocked_time_ranges.sql), the end date is shown alongside the end
 * time (e.g. "Oct 10, 11:00 PM – Oct 11, 2:00 AM") so the email is never
 * misread as ending earlier the same day. Falls back to today's plain
 * single-date format otherwise, unchanged from before this field existed.
 */
function formatSessionLine(
  sessionDate: string,
  sessionStartTime: string,
  sessionEndTime?: string,
  sessionEndDate?: string,
): string {
  if (!sessionEndTime) {
    return `${sessionDate}, ${sessionStartTime}`;
  }

  if (sessionEndDate && sessionEndDate !== sessionDate) {
    return `${sessionDate}, ${sessionStartTime} – ${sessionEndDate}, ${sessionEndTime}`;
  }

  return `${sessionDate}, ${sessionStartTime}–${sessionEndTime}`;
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
  sessionEndDate?: string;
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
    sessionEndDate,
    amountPaidKobo,
    totalPriceKobo,
    status,
  } = params;

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("New booking", brand) +
    heading("You've got a new booking", brand) +
    paragraph(`<strong>${escapeHtml(customerName)}</strong> (${escapeHtml(customerEmail)}) has paid for a session.`) +
    detailTable([
      { label: "Service", value: serviceLabel },
      { label: "Session", value: formatSessionLine(sessionDate, sessionStartTime, sessionEndTime, sessionEndDate) },
      { label: "Amount paid", value: `${formatKobo(amountPaidKobo)} of ${formatKobo(totalPriceKobo)}` },
      { label: "Status", value: status },
    ]);

  return sendEmail({
    to: ownerEmail,
    subject: `New booking: ${serviceLabel} — ${sessionDate}`,
    html: renderEmailLayout(brand, { previewText: `${customerName} has paid for a session.`, bodyHtml }),
  });
}

/**
 * Customer-facing counterpart to sendOwnerNewBookingEmail — fired alongside
 * it from the same chokepoint, payment-confirmation-service.ts's
 * confirmPaymentByReference(), the first time a booking receives a
 * successful payment (pending_deposit -> deposited or paid_in_full).
 * `status` branches the copy/CTA: a deposit still owes a balance (so it
 * shows what's left and the pay-later deadline), a full payment doesn't.
 */
export async function sendCustomerBookingConfirmedEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  sessionEndDate?: string;
  amountPaidKobo: number;
  totalPriceKobo: number;
  status: "deposited" | "paid_in_full";
  siteUrl: string;
}): Promise<SendEmailResult> {
  const {
    customerEmail,
    customerName,
    serviceLabel,
    sessionDate,
    sessionStartTime,
    sessionEndTime,
    sessionEndDate,
    amountPaidKobo,
    totalPriceKobo,
    status,
    siteUrl,
  } = params;

  const dashboardUrl = `${siteUrl}/dashboard`;
  const remainingKobo = totalPriceKobo - amountPaidKobo;
  const isFull = status === "paid_in_full";

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Booking confirmed", brand) +
    heading(isFull ? "You're all set — paid in full" : "Your booking is confirmed", brand) +
    paragraph(`Hi ${escapeHtml(customerName || "there")},`) +
    paragraph(
      isFull
        ? `Your <strong>${escapeHtml(serviceLabel)}</strong> session is confirmed and paid in full.`
        : `Your <strong>${escapeHtml(serviceLabel)}</strong> session is confirmed — your deposit has been received.`,
    ) +
    detailTable([
      { label: "Service", value: serviceLabel },
      { label: "Session", value: formatSessionLine(sessionDate, sessionStartTime, sessionEndTime, sessionEndDate) },
      { label: "Amount paid", value: formatKobo(amountPaidKobo) },
      ...(isFull ? [] : [{ label: "Balance remaining", value: formatKobo(remainingKobo) }]),
    ]) +
    (isFull
      ? paragraph("No further payment is needed — we'll see you at your session.")
      : paragraph("Please settle the remaining balance at least 24 hours before your session to avoid automatic cancellation.")) +
    ctaButton(dashboardUrl, "View your booking", brand);

  return sendEmail({
    to: customerEmail,
    subject: isFull
      ? `Booking confirmed — paid in full: ${serviceLabel}`
      : `Booking confirmed: ${serviceLabel} — ${sessionDate}`,
    html: renderEmailLayout(brand, {
      previewText: isFull ? "Your booking is confirmed and paid in full." : "Your booking is confirmed.",
      bodyHtml,
    }),
  });
}

/**
 * Customer-facing confirmation that the remaining balance on a previously
 * deposited booking has now been paid — fired from the same
 * confirmPaymentByReference() chokepoint as the two functions above, only
 * on a deposited -> paid_in_full transition (a deposit was already on
 * file, this is the balance landing after it, not the first payment).
 */
export async function sendCustomerBalancePaidEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  sessionEndDate?: string;
  totalPriceKobo: number;
  siteUrl: string;
}): Promise<SendEmailResult> {
  const {
    customerEmail,
    customerName,
    serviceLabel,
    sessionDate,
    sessionStartTime,
    sessionEndTime,
    sessionEndDate,
    totalPriceKobo,
    siteUrl,
  } = params;

  const dashboardUrl = `${siteUrl}/dashboard`;
  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Balance received", brand) +
    heading("You're paid in full", brand) +
    paragraph(`Hi ${escapeHtml(customerName || "there")},`) +
    paragraph(
      `We've received your remaining balance for <strong>${escapeHtml(serviceLabel)}</strong> — your booking is now paid in full.`,
    ) +
    detailTable([
      { label: "Service", value: serviceLabel },
      { label: "Session", value: formatSessionLine(sessionDate, sessionStartTime, sessionEndTime, sessionEndDate) },
      { label: "Total paid", value: formatKobo(totalPriceKobo) },
    ]) +
    paragraph("No further payment is needed — we'll see you at your session.") +
    ctaButton(dashboardUrl, "View your booking", brand);

  return sendEmail({
    to: customerEmail,
    subject: `Balance received — paid in full: ${serviceLabel}`,
    html: renderEmailLayout(brand, { previewText: "Your remaining balance has been received.", bodyHtml }),
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
  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Balance due", brand) +
    heading("Your balance is due", brand) +
    paragraph(`Hi ${escapeHtml(customerName || "there")},`) +
    paragraph(
      `You have a remaining balance of <strong>${formatKobo(balanceRemainingKobo)}</strong> for your ` +
        `<strong>${escapeHtml(serviceLabel)}</strong> session on <strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong>.`,
    ) +
    paragraph("Please settle this at least 24 hours before your session to avoid automatic cancellation.") +
    ctaButton(dashboardUrl, "Pay your balance", brand);

  return sendEmail({
    to: customerEmail,
    subject: `Balance due: ${serviceLabel} — ${sessionDate}`,
    html: renderEmailLayout(brand, { previewText: "Your remaining balance is due.", bodyHtml }),
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

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Booking cancelled", brand) +
    heading("Your booking has been cancelled", brand) +
    paragraph(`Hi ${escapeHtml(customerName || "there")},`) +
    paragraph(
      `Your <strong>${escapeHtml(serviceLabel)}</strong> session on ` +
        `<strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong> has been automatically cancelled ` +
        `because the remaining balance was not paid at least 24 hours before the session.`,
    ) +
    paragraph("If you'd still like to book, please make a new booking on our site.");

  return sendEmail({
    to: customerEmail,
    subject: `Booking cancelled: ${serviceLabel} — ${sessionDate}`,
    html: renderEmailLayout(brand, { previewText: "Your booking has been automatically cancelled.", bodyHtml }),
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

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Auto-cancelled", brand) +
    heading("Booking auto-cancelled (unpaid balance)", brand) +
    paragraph(
      `<strong>${escapeHtml(customerName)}</strong>'s <strong>${escapeHtml(serviceLabel)}</strong> session on ` +
        `<strong>${formatSessionLine(sessionDate, sessionStartTime)}</strong> was automatically cancelled — the ` +
        `remaining balance was not paid at least 24 hours before the session.`,
    );

  return sendEmail({
    to: ownerEmail,
    subject: `Auto-cancelled: ${serviceLabel} — ${sessionDate}`,
    html: renderEmailLayout(brand, { previewText: "A booking was auto-cancelled for unpaid balance.", bodyHtml }),
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

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Front desk", brand) +
    heading("New message from the front desk chat", brand) +
    paragraph(
      `<strong>${escapeHtml(customerName)}</strong> (${escapeHtml(customerEmail)}) wrote in on: ` +
        `<strong>${escapeHtml(subject)}</strong>`,
    ) +
    calloutBox(escapeHtmlMultiline(body), brand) +
    ctaButton(ticketUrl, "Reply in the admin dashboard", brand);

  return sendEmail({
    to: ownerEmail,
    subject: `Front desk: ${customerName} — ${subject}`,
    html: renderEmailLayout(brand, { previewText: `${customerName} sent a new message.`, bodyHtml }),
  });
}

/**
 * Owner notification fired from triumph-actions.ts's submitProjectRequestAction()
 * whenever a visitor submits the Triumph Music Global "Start a Project" form —
 * best-effort, same discipline as every other email here.
 */
export async function sendOwnerNewProjectRequestEmail(params: {
  ownerEmail: string;
  fullName: string;
  email: string;
  country: string;
  phone: string;
  numberOfSongs: number;
  serviceLabel: string;
  projectDetails: string;
}): Promise<SendEmailResult> {
  const { ownerEmail, fullName, email, country, phone, numberOfSongs, serviceLabel, projectDetails } =
    params;

  const brand = TRIUMPH_BRAND;
  const bodyHtml =
    eyebrow("New project request", brand) +
    heading("New Triumph Music Global project request", brand) +
    paragraph(`<strong>${escapeHtml(fullName)}</strong> (${escapeHtml(email)}) submitted a project request.`) +
    detailTable([
      { label: "Country", value: escapeHtml(country) },
      { label: "Phone", value: escapeHtml(phone) },
      { label: "Number of songs", value: String(numberOfSongs) },
      { label: "Service", value: serviceLabel },
    ]) +
    paragraph("<strong>Project details:</strong>") +
    calloutBox(escapeHtmlMultiline(projectDetails), brand);

  return sendEmail({
    to: ownerEmail,
    subject: `Triumph Music Global: new project request from ${fullName}`,
    html: renderEmailLayout(brand, { previewText: `${fullName} submitted a new project request.`, bodyHtml }),
    fromName: "Triumph Music Global",
  });
}

/**
 * Client-facing confirmation fired alongside sendOwnerNewProjectRequestEmail
 * — belt-and-suspenders alongside the inline on-screen code shown by
 * start-project-form.tsx's success state, since the project_code is the
 * client's only way back into their project (no account/password, see
 * 0023_triumph_projects.sql). Links to the plain /triumph/track lookup page,
 * never a pre-filled URL — the code is shown as text, the email itself is
 * never put in a URL.
 */
export async function sendClientProjectConfirmationEmail(params: {
  clientEmail: string;
  fullName: string;
  projectCode: string;
  serviceLabel: string;
  siteUrl: string;
}): Promise<SendEmailResult> {
  const { clientEmail, fullName, projectCode, serviceLabel, siteUrl } = params;
  const trackUrl = `${siteUrl}/triumph/track`;

  const brand = TRIUMPH_BRAND;
  const bodyHtml =
    eyebrow("Project received", brand) +
    heading("We've got your project", brand) +
    paragraph(`Hi ${escapeHtml(fullName || "there")},`) +
    paragraph(
      `Thanks for submitting your <strong>${escapeHtml(serviceLabel)}</strong> request to Triumph Music Global. ` +
        `We'll be in touch within 24 hours.`,
    ) +
    paragraph("Your project code is:") +
    codeBlock(projectCode, brand) +
    paragraph("Save this — you can check your project's status anytime using this code and the email address you submitted with.") +
    ctaButton(trackUrl, "Check your project status", brand);

  return sendEmail({
    to: clientEmail,
    subject: `Your Triumph Music Global project code: ${projectCode}`,
    html: renderEmailLayout(brand, { previewText: `Your project code is ${projectCode}.`, bodyHtml }),
    fromName: "Triumph Music Global",
  });
}

/**
 * Client-facing notice fired from triumph-admin-actions.ts's
 * postTriumphProjectUpdateAction() whenever the engineer's update actually
 * changes the project's status (never for a status-less note) — best-effort,
 * same discipline as every other email here.
 */
export async function sendClientProjectUpdateEmail(params: {
  clientEmail: string;
  fullName: string;
  projectCode: string;
  statusLabel: string;
  body: string;
  siteUrl: string;
}): Promise<SendEmailResult> {
  const { clientEmail, fullName, projectCode, statusLabel, body, siteUrl } = params;
  const trackUrl = `${siteUrl}/triumph/track`;

  const brand = TRIUMPH_BRAND;
  const bodyHtml =
    eyebrow("Project update", brand) +
    heading("Your project status has been updated", brand) +
    paragraph(`Hi ${escapeHtml(fullName || "there")},`) +
    paragraph(`Your project <strong>${escapeHtml(projectCode)}</strong> is now: <strong>${escapeHtml(statusLabel)}</strong>.`) +
    calloutBox(escapeHtmlMultiline(body), brand) +
    ctaButton(trackUrl, "View your project", brand);

  return sendEmail({
    to: clientEmail,
    subject: `Update on your project ${projectCode}: ${statusLabel}`,
    html: renderEmailLayout(brand, { previewText: `Your project ${projectCode} is now ${statusLabel}.`, bodyHtml }),
    fromName: "Triumph Music Global",
  });
}

/**
 * Fired from triumph-download-verification-actions.ts's
 * requestDownloadVerificationCodeAction() — confirms the client currently
 * controls the email on file before they can download a deliverable (see
 * lib/services/triumph-email-verification.ts). Best-effort, same
 * discipline as every other email here.
 */
export async function sendDownloadVerificationCodeEmail(params: {
  clientEmail: string;
  fullName: string;
  projectCode: string;
  code: string;
}): Promise<SendEmailResult> {
  const { clientEmail, fullName, projectCode, code } = params;

  const brand = TRIUMPH_BRAND;
  const bodyHtml =
    eyebrow("Verify it's you", brand) +
    heading("Verify it's you", brand) +
    paragraph(`Hi ${escapeHtml(fullName || "there")},`) +
    paragraph(`Use this code to confirm it's you before downloading files from your project <strong>${escapeHtml(projectCode)}</strong>:`) +
    codeBlock(code, brand) +
    paragraph("This code expires in about 10 minutes. If you didn't request this, you can ignore this email.");

  return sendEmail({
    to: clientEmail,
    subject: `Your verification code: ${code}`,
    html: renderEmailLayout(brand, { previewText: `Your verification code is ${code}.`, bodyHtml }),
    fromName: "Triumph Music Global",
  });
}

/**
 * Front desk staff invite — sent via this project's own Resend pipeline
 * rather than Supabase Auth's built-in invite email. `acceptUrl` is built by
 * the caller (lib/services/frontdesk-staff-actions.ts) from a token Supabase
 * generated via admin.generateLink(), in this project's own
 * /auth/confirm?token_hash=...&type=invite&next=... shape — see that route
 * handler's comment for why the token_hash flow is used at all.
 *
 * Deliberately NOT inviteUserByEmail()'s automatic email: Supabase's default
 * mailer is rate-limited to a handful of sends/hour, and editing its
 * template at all requires custom SMTP configured first — friction this
 * project's existing Resend setup already has solved for every other
 * transactional email. Routing invites through the same pipeline also means
 * a re-invite (someone who never finished setting a password) can always
 * send a fresh email, where inviteUserByEmail() itself just errors
 * "already registered" for an existing-but-unconfirmed account.
 */
export async function sendFrontdeskInviteEmail(params: {
  to: string;
  acceptUrl: string;
}): Promise<SendEmailResult> {
  const { to, acceptUrl } = params;

  const brand = GENIE_PRO_BRAND;
  const bodyHtml =
    eyebrow("Front desk invite", brand) +
    heading("You've been invited to the front desk", brand) +
    paragraph(
      "You've been given access to the GenieProStudios front desk board, where you'll clock booked sessions in and out.",
    ) +
    ctaButton(acceptUrl, "Set your password", brand) +
    paragraph("This link is single-use and expires after a while — if it's stopped working, ask the studio owner to send a new one.");

  return sendEmail({
    to,
    subject: "You've been invited to the GenieProStudios front desk",
    html: renderEmailLayout(brand, {
      previewText: "Set your password to start using the front desk board.",
      bodyHtml,
    }),
  });
}
