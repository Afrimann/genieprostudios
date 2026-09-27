import { Suspense } from "react";
import { getBookingsForCurrentCustomer } from "@/lib/repositories/booking-repository";
import type { BookingStatus } from "@/lib/services/booking-service";
import { formatKobo } from "@/lib/utils/money";
import { PayBalanceButton } from "@/components/dashboard/pay-balance-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
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

  return (
    <>
      {bookings.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No bookings yet</CardTitle>
            <CardDescription>
              Once you book a session, it will show up here with its deposit status,
              remaining balance, and confirmation details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ready to get started? Head over to Book a Session to pick a date and time.
            </p>
          </CardContent>
        </Card>
      )}

      {bookings.map((booking) => {
        const remainingKobo = booking.total_price_kobo - booking.amount_paid_kobo;

        return (
          <Card key={booking.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{booking.serviceName}</CardTitle>
                  <CardDescription>
                    {booking.session_date} at{" "}
                    {formatTimeRange(booking.session_start_time, booking.session_end_time)}
                  </CardDescription>
                </div>
                <Badge variant={STATUS_VARIANTS[booking.status]}>
                  {STATUS_LABELS[booking.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <p>
                  Total price:{" "}
                  <span className="font-semibold">{formatKobo(booking.total_price_kobo)}</span>
                </p>
                <p>
                  Amount paid:{" "}
                  <span className="font-semibold">{formatKobo(booking.amount_paid_kobo)}</span>
                </p>
              </div>

              {booking.status === "deposited" && remainingKobo > 0 && (
                <PayBalanceButton bookingId={booking.id} remainingKobo={remainingKobo} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your Bookings</h1>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <DashboardBookings />
      </Suspense>
    </main>
  );
}
