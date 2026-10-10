import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { getBookingsForCurrentCustomer } from "@/lib/repositories/booking-repository";
import type { BookingStatus } from "@/lib/services/booking-service";
import { formatKobo } from "@/lib/utils/money";
import { PayBalanceButton } from "@/components/dashboard/pay-balance-button";
import { CompletePaymentButtons } from "@/components/dashboard/complete-payment-buttons";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// DashboardBookings below is an async Server Component doing a live
// cookie+DB read (getBookingsForCurrentCustomer), rendered inside a
// Suspense boundary right here on the page (not just gated by
// dashboard/layout.tsx's own auth check) — same reasoning as every other
// page in this codebase with this pattern (e.g.
// app/(marketing)/dashboard/[id]/page.tsx, app/admin/(protected)/bookings/[id]/page.tsx):
// without opting out, Cache Components can treat this as a static
// "postponed" hole that doesn't reliably resume on every navigation path,
// leaving the Suspense fallback stuck. Always needs a live session, so it
// can never be meaningfully prerendered anyway.
export const instant = false;

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

/**
 * "Oct 10 · 11:00 PM – Oct 11, 2:00 AM" when sessionEndDate differs from
 * sessionDate (an overnight session — see bookings.session_end_date,
 * 0036_blocked_time_ranges.sql), else the plain single-date format —
 * mirrors lib/services/email-service.ts's formatSessionLine convention.
 */
function formatSessionLine(
  sessionDate: string,
  start: string,
  end: string,
  sessionEndDate: string | null,
): string {
  if (sessionEndDate && sessionEndDate !== sessionDate) {
    return `${sessionDate} · ${start.slice(0, 5)} – ${sessionEndDate}, ${end.slice(0, 5)}`;
  }

  return `${sessionDate} · ${formatTimeRange(start, end)}`;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_deposit: "outline",
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
};

async function DashboardBookings() {
  const bookings = await getBookingsForCurrentCustomer();

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-8">
        <p className="font-heading text-lg font-medium text-foreground">No bookings yet</p>
        <p className="text-sm text-muted-foreground">
          Once you book a session, it will show up here with its deposit status, remaining
          balance, and confirmation details.
        </p>
        <Button
          asChild
          className="mt-1 h-10 rounded-none bg-[var(--amber-glow)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
        >
          <Link href="/book">Book a session</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bookings.map((booking) => {
        const remainingKobo = booking.total_price_kobo - booking.amount_paid_kobo;
        const canPayBalance = booking.status === "deposited" && remainingKobo > 0;
        const canCompletePayment = booking.status === "pending_deposit";

        return (
          <div
            key={booking.id}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[var(--amber-glow)]/40"
          >
            <Link href={`/dashboard/${booking.id}`} className="group/booking flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-heading text-lg font-medium text-foreground">
                    {booking.serviceName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.session_date && booking.session_start_time && booking.session_end_time
                      ? formatSessionLine(
                          booking.session_date,
                          booking.session_start_time,
                          booking.session_end_time,
                          booking.session_end_date,
                        )
                      : "Per-song add-on — no studio time"}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[booking.status]}>
                  {STATUS_LABELS[booking.status]}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    Paid{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatKobo(booking.amount_paid_kobo)}
                    </span>{" "}
                    of{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatKobo(booking.total_price_kobo)}
                    </span>
                  </span>
                </div>
                <span className="flex items-center gap-1 font-medium text-[var(--amber-glow)]">
                  Details
                  <ChevronRight
                    className="size-4 transition-transform group-hover/booking:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>

            {canPayBalance && (
              <div className="border-t border-border pt-4">
                <PayBalanceButton bookingId={booking.id} remainingKobo={remainingKobo} />
              </div>
            )}

            {canCompletePayment && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  This booking isn&apos;t confirmed yet — complete payment to lock it in.
                </p>
                <CompletePaymentButtons
                  bookingId={booking.id}
                  depositAmountKobo={booking.deposit_amount_kobo}
                  totalPriceKobo={booking.total_price_kobo}
                />
                <CancelBookingButton bookingId={booking.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="h-32 w-full animate-pulse rounded-2xl border border-border bg-muted" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-14">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Your account
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Your bookings
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Track deposits, balances, and session details for every booking you&apos;ve made.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <Suspense fallback={<DashboardFallback />}>
            <DashboardBookings />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
