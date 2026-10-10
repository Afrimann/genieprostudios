import { Suspense } from "react";
import Link from "next/link";

import { getAllBookingsForAdmin } from "@/lib/repositories/admin-booking-repository";
import { formatKobo } from "@/lib/utils/money";
import { UnresolvedBookingsManager } from "@/components/admin/unresolved-bookings-manager";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
async function AllBookingsTable() {
  const bookings = await getAllBookingsForAdmin();

  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">No bookings yet.</p>;
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
            <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"}>
              {STATUS_LABELS[booking.status] ?? booking.status}
            </Badge>
          </div>
        </Link>
      ))}
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
        Every booking, and the ones that need a decision right now.
      </p>

      <UnresolvedBookingsManager />

      <Card>
        <CardHeader>
          <CardTitle>All bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AllBookingsTableFallback />}>
            <AllBookingsTable />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
