"use client";

import { useState } from "react";

import {
  fetchValidStartTimesForReschedule,
  rescheduleBookingAction,
} from "@/lib/services/admin-booking-actions";
import type { StartTimeOption } from "@/lib/services/availability-service";
import { lagosToday } from "@/lib/utils/lagos-time";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

/**
 * Date -> start-time picker for admin_reschedule_booking, extracted from
 * components/admin/unresolved-bookings-manager.tsx so both that list and the
 * /admin/bookings/[id] detail page can reschedule any booking without
 * duplicating this flow.
 *
 * 0036/0037 note: every date is open by default now — there is no more
 * window-picking step. Picking a date goes straight to loading that date's
 * valid start times via fetchValidStartTimesForReschedule(date, serviceId,
 * bookingId); confirming a start time calls rescheduleBookingAction(bookingId,
 * date, startTime) directly, no slot/window id involved. Only needs the two
 * identifiers the RPC/advisory start-time lookup actually require — not a
 * full booking object — so either caller can pass whatever shape it has on
 * hand.
 */
export function ReschedulePanel({
  bookingId,
  serviceId,
  onDone,
}: {
  bookingId: string;
  serviceId: string;
  onDone: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startTimeOptions, setStartTimeOptions] = useState<StartTimeOption[]>([]);
  const [startTimesLoading, setStartTimesLoading] = useState(false);
  const [startTimesError, setStartTimesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSelectDate(date: Date | undefined) {
    if (!date) return;
    const iso = toIsoDate(date);
    setSelectedDate(iso);
    setStartTimeOptions([]);
    setStartTimesLoading(true);
    setStartTimesError(null);

    const result = await fetchValidStartTimesForReschedule(iso, serviceId, bookingId);
    setStartTimesLoading(false);

    if (!result.success) {
      setStartTimesError(result.message);
      return;
    }

    setStartTimeOptions(result.options);
  }

  async function handleConfirm(option: StartTimeOption) {
    if (!selectedDate) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await rescheduleBookingAction(bookingId, selectedDate, option.startTime);
    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.message);
      return;
    }

    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <Calendar
        mode="single"
        selected={selectedDate ? parseIsoDate(selectedDate) : undefined}
        onSelect={handleSelectDate}
        disabled={(date) => date < parseIsoDate(lagosToday())}
      />

      {selectedDate && (
        <div className="flex flex-col gap-2">
          {startTimesLoading && (
            <p className="text-sm text-muted-foreground">Loading available start times…</p>
          )}
          {startTimesError && <p className="text-sm text-destructive">{startTimesError}</p>}
          {!startTimesLoading && !startTimesError && startTimeOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No available start times on this date.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!startTimesLoading &&
              startTimeOptions.map((option) => (
                <Button
                  key={option.startTime}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleConfirm(option)}
                >
                  {formatTimeRange(option.startTime, option.endTime)}
                  {option.endDate !== selectedDate ? " (+1 day)" : ""}
                </Button>
              ))}
          </div>
        </div>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </div>
  );
}
