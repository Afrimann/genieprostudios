import {
  getBookingsNeedingAutoCancel,
  getBookingsNeedingBalanceReminder,
  getStalePendingBookings,
  insertReminderLog,
  markBookingAutoCancelled,
  markBookingCancelled,
  type SweepBooking,
} from "@/lib/repositories/reminder-repository";
import {
  sendAutoCancelCustomerEmail,
  sendAutoCancelOwnerEmail,
  sendBalanceReminderEmail,
} from "@/lib/services/email-service";

// Business logic + orchestration for the Phase 4 daily sweep. Called only
// from app/api/cron/daily-sweep/route.ts (service-role context — no user
// session exists in a cron request). Each sweep function is independently
// safe to call/retry: DB state transitions are the source of truth and
// happen unconditionally where specified; email sends are best-effort and
// never block or roll back a state transition, per this file's guiding rule
// (see runAutoCancelSweep()'s comment for the one case where ordering
// matters).

export type SweepResult = { processed: number; sent: number; failed: number };

/**
 * For every deposited booking with an outstanding balance and no reminder
 * sent in the last 24h (see bookings_needing_balance_reminder(),
 * 0016_session_start_at_helper.sql), sends the customer a reminder email and
 * — ONLY on a successful send — logs it to reminder_log so the next run's
 * dedupe window picks it up correctly. A failed send intentionally leaves no
 * log row, so the very next daily run retries it rather than silently
 * skipping the customer for 24h.
 */
export async function runBalanceReminderSweep(): Promise<SweepResult> {
  const bookings = await getBookingsNeedingBalanceReminder();

  let sent = 0;
  let failed = 0;

  for (const booking of bookings) {
    try {
      if (!booking.customerEmail) {
        console.warn(
          `runBalanceReminderSweep: booking ${booking.id} has no customer email on file, skipping`,
        );
        failed += 1;
        continue;
      }

      const balanceRemainingKobo = booking.totalPriceKobo - booking.amountPaidKobo;

      const result = await sendBalanceReminderEmail({
        customerEmail: booking.customerEmail,
        customerName: booking.customerName ?? "",
        serviceLabel: booking.serviceLabel,
        sessionDate: booking.sessionDate,
        sessionStartTime: booking.sessionStartTime,
        balanceRemainingKobo,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      });

      if (!result.success) {
        console.warn(
          `runBalanceReminderSweep: failed to send reminder for booking ${booking.id}: ${result.message}`,
        );
        failed += 1;
        continue;
      }

      await insertReminderLog(booking.id, "balance_due_24h");
      sent += 1;
    } catch (err) {
      // Never let one booking's failure abort the sweep for the rest —
      // log and move on to the next booking, per this phase's idempotency
      // rule.
      console.error(`runBalanceReminderSweep: unexpected error for booking ${booking.id}`, err);
      failed += 1;
    }
  }

  return { processed: bookings.length, sent, failed };
}

/**
 * For every deposited booking whose session start is now within 24h (or
 * already past) with an outstanding balance (see
 * bookings_needing_autocancel()), marks it auto_cancelled FIRST — the state
 * transition is the source of truth and must happen regardless of email
 * outcome — then best-effort notifies both the customer and the owner.
 * Notification failures are logged only; they never roll back the
 * cancellation, since the booking is genuinely no longer viable (balance
 * unpaid this close to the session) independent of whether anyone was
 * successfully emailed about it.
 */
export async function runAutoCancelSweep(): Promise<SweepResult> {
  const bookings = await getBookingsNeedingAutoCancel();

  let sent = 0;
  let failed = 0;

  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (!ownerEmail) {
    console.warn("runAutoCancelSweep: OWNER_NOTIFICATION_EMAIL is not configured, skipping owner emails");
  }

  for (const booking of bookings) {
    try {
      // The state transition happens unconditionally, before any email is
      // attempted — see this function's JSDoc.
      await markBookingAutoCancelled(booking.id);

      const emailResults = await sendAutoCancelNotifications(booking, ownerEmail);

      if (emailResults.everySent) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      // A failure here means markBookingAutoCancelled itself threw (a
      // genuine DB error) — the state transition did not happen for this
      // booking, so it's correctly left out of both sent/failed counts'
      // "processed" success path and will be retried on the next run.
      console.error(`runAutoCancelSweep: failed to auto-cancel booking ${booking.id}`, err);
      failed += 1;
    }
  }

  return { processed: bookings.length, sent, failed };
}

/**
 * Fires both auto-cancel notification emails for a single booking,
 * independently of each other (a customer email failure must not skip the
 * owner email, and vice versa). Returns whether every configured recipient
 * was successfully notified, purely for runAutoCancelSweep()'s sent/failed
 * tally — never used to gate or reverse the cancellation itself.
 */
async function sendAutoCancelNotifications(
  booking: SweepBooking,
  ownerEmail: string | undefined,
): Promise<{ everySent: boolean }> {
  let everySent = true;

  if (booking.customerEmail) {
    const customerResult = await sendAutoCancelCustomerEmail({
      customerEmail: booking.customerEmail,
      customerName: booking.customerName ?? "",
      serviceLabel: booking.serviceLabel,
      sessionDate: booking.sessionDate,
      sessionStartTime: booking.sessionStartTime,
    });

    if (!customerResult.success) {
      console.warn(
        `runAutoCancelSweep: failed to send customer notice for booking ${booking.id}: ${customerResult.message}`,
      );
      everySent = false;
    }
  } else {
    console.warn(`runAutoCancelSweep: booking ${booking.id} has no customer email on file, skipping customer notice`);
    everySent = false;
  }

  if (ownerEmail) {
    const ownerResult = await sendAutoCancelOwnerEmail({
      ownerEmail,
      customerName: booking.customerName ?? "",
      serviceLabel: booking.serviceLabel,
      sessionDate: booking.sessionDate,
      sessionStartTime: booking.sessionStartTime,
    });

    if (!ownerResult.success) {
      console.warn(
        `runAutoCancelSweep: failed to send owner notice for booking ${booking.id}: ${ownerResult.message}`,
      );
      everySent = false;
    }
  } else {
    everySent = false;
  }

  return { everySent };
}

/**
 * For every booking still pending_deposit more than 30 minutes after
 * creation (see stale_pending_bookings()), marks it cancelled. No email is
 * sent for this case — an abandoned checkout with no payment ever attempted
 * has nothing to notify the customer about, per the Phase 4 spec.
 */
export async function runStalePendingCleanupSweep(): Promise<{ processed: number }> {
  const bookings = await getStalePendingBookings();

  for (const booking of bookings) {
    try {
      await markBookingCancelled(booking.id);
    } catch (err) {
      console.error(`runStalePendingCleanupSweep: failed to cancel booking ${booking.id}`, err);
    }
  }

  return { processed: bookings.length };
}

export type DailySweepSummary = {
  stalePendingCleanup: { processed: number };
  autoCancel: SweepResult;
  balanceReminder: SweepResult;
};

/**
 * Runs the three sweeps in order — stale-cleanup, then auto-cancel, then
 * balance-reminders — and returns a combined summary for the cron route
 * handler to return as JSON. Order matters only for readability/log
 * ordering here, not correctness: the three predicates
 * (pending_deposit+stale / deposited+<=24h / deposited+>24h+no-recent-log)
 * are mutually exclusive by status and time window, so no booking can be
 * matched by more than one sweep in a single run.
 */
export async function runDailySweep(): Promise<DailySweepSummary> {
  const stalePendingCleanup = await runStalePendingCleanupSweep();
  const autoCancel = await runAutoCancelSweep();
  const balanceReminder = await runBalanceReminderSweep();

  return { stalePendingCleanup, autoCancel, balanceReminder };
}
