"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  fetchUnresolvedBookings,
  markBookingStaleAction,
} from "@/lib/services/admin-booking-actions";
import type { UnresolvedBooking } from "@/lib/repositories/admin-booking-repository";
import { formatKobo } from "@/lib/utils/money";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReschedulePanel } from "@/components/admin/reschedule-panel";
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

const UNRESOLVED_BOOKINGS_TABLES = [{ table: "bookings" }];

export function UnresolvedBookingsManager() {
  const [bookings, setBookings] = useState<UnresolvedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staleId, setStaleId] = useState<string | null>(null);
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchUnresolvedBookings();
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setBookings([]);
      return;
    }

    setBookings(result.bookings);
  }

  useRealtimeRefresh({
    channelName: "admin-unresolved-bookings",
    tables: UNRESOLVED_BOOKINGS_TABLES,
    onRefresh: refresh,
  });

  // Initial load is a fully self-contained local function (never calling out
  // to `refresh`, which is declared outside the effect) — matches
  // lib/hooks/use-booking-flow.ts's mount-effect shape, which
  // react-hooks/set-state-in-effect accepts; calling an externally-declared
  // setState-triggering function directly from an effect body does not.
  useEffect(() => {
    let active = true;

    async function loadInitial() {
      const result = await fetchUnresolvedBookings();
      if (!active) return;
      setLoading(false);

      if (!result.success) {
        setLoadError(result.message);
        setBookings([]);
        return;
      }

      setBookings(result.bookings);
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  async function handleMarkStale(bookingId: string) {
    setStaleId(bookingId);
    const result = await markBookingStaleAction(bookingId);
    setStaleId(null);

    if (!result.success) {
      setLoadError(result.message);
      return;
    }

    refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          Bookings whose session has already passed with a balance still owed. Mark a
          booking stale to give up on collecting the balance, or reschedule it onto a new
          open window if the customer still wants to use their deposit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!loading && !loadError && bookings.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing unresolved right now — every past session is either fully paid or
            already handled.
          </p>
        )}

        {!loading &&
          bookings.map((booking) => {
            const remainingKobo = booking.totalPriceKobo - booking.amountPaidKobo;
            const isRescheduling = rescheduleTargetId === booking.id;

            return (
              <div
                key={booking.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="text-sm font-medium hover:text-[var(--amber-glow)] hover:underline"
                    >
                      {booking.customerName ?? "Unknown customer"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                    <p className="mt-1 text-sm">
                      {booking.serviceLabel} — {booking.sessionDate} at{" "}
                      {formatTimeRange(booking.sessionStartTime, booking.sessionEndTime)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paid {formatKobo(booking.amountPaidKobo)} of{" "}
                      {formatKobo(booking.totalPriceKobo)} — {formatKobo(remainingKobo)} owed
                    </p>
                  </div>
                  <Badge variant={booking.status === "auto_cancelled" ? "destructive" : "secondary"}>
                    {booking.status === "auto_cancelled" ? "Marked stale" : "Deposit paid"}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  {booking.status === "deposited" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={staleId === booking.id}
                      onClick={() => handleMarkStale(booking.id)}
                    >
                      {staleId === booking.id ? "Marking…" : "Mark as stale"}
                    </Button>
                  )}
                  <Button
                    variant={isRescheduling ? "secondary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setRescheduleTargetId(isRescheduling ? null : booking.id)
                    }
                  >
                    {isRescheduling ? "Cancel reschedule" : "Reschedule"}
                  </Button>
                </div>

                {isRescheduling && (
                  <ReschedulePanel
                    bookingId={booking.id}
                    serviceId={booking.serviceId}
                    onDone={() => {
                      setRescheduleTargetId(null);
                      refresh();
                    }}
                  />
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
