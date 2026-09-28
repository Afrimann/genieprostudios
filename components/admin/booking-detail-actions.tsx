"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { markBookingStaleAction } from "@/lib/services/admin-booking-actions";
import type { BookingStatus } from "@/lib/services/booking-service";
import { Button } from "@/components/ui/button";
import { ReschedulePanel } from "@/components/admin/reschedule-panel";

// Rescheduling makes sense for a booking that has (or had) a real deposit
// tied to it — pending_deposit never got that far (the customer would just
// book again normally), and cancelled is an abandoned checkout with nothing
// to carry over. deposited/auto_cancelled/paid_in_full all keep their
// existing amount_paid_kobo untouched when moved (see
// admin_reschedule_booking, 0017), so moving them to a new time is a real,
// useful action for each of those three.
const RESCHEDULABLE_STATUSES: BookingStatus[] = ["deposited", "auto_cancelled", "paid_in_full"];

export function BookingDetailActions({
  bookingId,
  serviceId,
  status,
  canMarkStale,
  hasSession,
}: {
  bookingId: string;
  serviceId: string;
  status: BookingStatus;
  canMarkStale: boolean;
  // False for an is_addon booking (per-song mixing/mastering) — there's no
  // studio time slot to move, so "Reschedule" doesn't apply regardless of
  // status. See supabase/migrations/0019_addon_bookings.sql.
  hasSession: boolean;
}) {
  const router = useRouter();
  const [staleSubmitting, setStaleSubmitting] = useState(false);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  async function handleMarkStale() {
    setStaleSubmitting(true);
    setStaleError(null);
    const result = await markBookingStaleAction(bookingId);
    setStaleSubmitting(false);

    if (!result.success) {
      setStaleError(result.message);
      return;
    }

    router.refresh();
  }

  const canReschedule = hasSession && RESCHEDULABLE_STATUSES.includes(status);

  if (!canMarkStale && !canReschedule) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-lg font-medium text-foreground">Actions</p>

      <div className="flex flex-wrap gap-2">
        {canMarkStale && (
          <Button variant="outline" size="sm" disabled={staleSubmitting} onClick={handleMarkStale}>
            {staleSubmitting ? "Marking…" : "Mark as stale"}
          </Button>
        )}
        {canReschedule && (
          <Button
            variant={rescheduling ? "secondary" : "outline"}
            size="sm"
            onClick={() => setRescheduling((v) => !v)}
          >
            {rescheduling ? "Cancel reschedule" : "Reschedule"}
          </Button>
        )}
      </div>

      {staleError && <p className="text-sm text-destructive">{staleError}</p>}

      {rescheduling && (
        <ReschedulePanel
          bookingId={bookingId}
          serviceId={serviceId}
          onDone={() => {
            setRescheduling(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
