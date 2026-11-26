import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { getAllBookingsForAdmin } from "@/lib/repositories/admin-booking-repository";
import { formatKobo } from "@/lib/utils/money";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lagosToday } from "@/lib/utils/lagos-time";

const BOOKINGS_LIST_REALTIME_TABLES = [{ table: "bookings" }, { table: "payments" }];

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so this
// page can never be meaningfully prerendered either — same reasoning as the
// layout itself and app/admin/(protected)/availability/page.tsx.
export const instant = false;

const STATUS_LABELS: Record<string, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_deposit: "outline",
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
};

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

/**
 * "Oct 10 at 11:00 PM – Oct 11, 2:00 AM" when sessionEndDate differs from
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
    return `${sessionDate} at ${start.slice(0, 5)} – ${sessionEndDate} at ${end.slice(0, 5)}`;
  }

  return `${sessionDate} at ${formatTimeRange(start, end)}`;
}

/**
 * Every booking, "order admin" style — full metadata is one click away on
 * /admin/bookings/[id] (getBookingDetailForAdmin), so this list itself stays
 * scannable: customer, service, session, status, paid/total, nothing more.
 */
function BookingRows({
  bookings,
  emptyMessage,
}: {
  bookings: Awaited<ReturnType<typeof getAllBookingsForAdmin>>;
  emptyMessage: string;
}) {
  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {bookings.map((booking) => (
        <Link
          key={booking.id}
          href={`/admin/bookings/${booking.id}`}
          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-foreground">
              {booking.customerName ?? "Unknown customer"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {booking.sessionDate && booking.sessionStartTime && booking.sessionEndTime
                ? `${booking.serviceLabel} — ${formatSessionLine(booking.sessionDate, booking.sessionStartTime, booking.sessionEndTime, booking.sessionEndDate)}`
                : `${booking.serviceLabel} — per-song add-on, no studio time`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatKobo(booking.amountPaidKobo)} / {formatKobo(booking.totalPriceKobo)}
            </span>
            {booking.refundRequiredPaymentCount > 0 && (
              <Badge variant="destructive" className="shrink-0">
                {booking.refundRequiredPaymentCount > 1
                  ? `Refunds ×${booking.refundRequiredPaymentCount}`
                  : "Refund required"}
              </Badge>
            )}
            <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"}>
              {STATUS_LABELS[booking.status] ?? booking.status}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function AllBookingsSections() {
  const bookings = await getAllBookingsForAdmin();
  const today = lagosToday();
  const upcoming = bookings
    .filter((booking) => booking.sessionDate !== null && booking.sessionDate >= today)
    .sort((a, b) => a.sessionDate!.localeCompare(b.sessionDate!));
  const archives = bookings
    .filter((booking) => booking.sessionDate !== null && booking.sessionDate < today)
    .sort((a, b) => b.sessionDate!.localeCompare(a.sessionDate!));
  const otherOrders = bookings.filter((booking) => booking.sessionDate === null);
  const refundBookings = bookings.filter((booking) => booking.refundRequiredPaymentCount > 0);
  const refundCount = refundBookings.reduce(
    (total, booking) => total + booking.refundRequiredPaymentCount,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      {refundCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
              Refunds require review
              <Badge variant="destructive" className="ml-auto">
                {refundCount}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These payments were received after their requested studio time became unavailable.
              Review each booking and arrange the refund.
            </p>
          </CardHeader>
          <CardContent>
            <BookingRows bookings={refundBookings} emptyMessage="No refunds need review." />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingRows bookings={upcoming} emptyMessage="No upcoming bookings." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archives</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingRows bookings={archives} emptyMessage="No past bookings." />
        </CardContent>
      </Card>

      {otherOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add-on orders</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingRows bookings={otherOrders} emptyMessage="No add-on orders." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AllBookingsTableFallback() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher channelName="admin-bookings-list" tables={BOOKINGS_LIST_REALTIME_TABLES} />
      <p className="text-sm text-muted-foreground">
        Review scheduled sessions and browse completed bookings in the archives.
      </p>

      <Suspense fallback={<AllBookingsTableFallback />}>
        <AllBookingsSections />
      </Suspense>
    </main>
  );
}
