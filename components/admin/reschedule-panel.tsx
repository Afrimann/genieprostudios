"use client";

import { useEffect, useState } from "react";

import {
  fetchOpenDatesForReschedule,
  fetchValidStartTimesForReschedule,
  fetchWindowsForRescheduleDate,
  rescheduleBookingAction,
} from "@/lib/services/admin-booking-actions";
import type { AvailabilitySlot } from "@/lib/repositories/availability-repository";
import type { StartTimeOption } from "@/lib/services/availability-service";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

// How far ahead the reschedule date picker looks — same horizon as the
// customer booking flow's DATE_RANGE_DAYS (lib/hooks/use-booking-flow.ts).
const DATE_RANGE_DAYS = 60;

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
 * Date -> window -> start-time picker for admin_reschedule_booking, extracted
 * from components/admin/unresolved-bookings-manager.tsx so both that list
 * and the /admin/bookings/[id] detail page can reschedule any booking without
 * duplicating this flow. Only needs the two identifiers the RPC/advisory
 * start-time lookup actually require — not a full booking object — so either
 * caller can pass whatever shape it has on hand.
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
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [datesError, setDatesError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [windows, setWindows] = useState<AvailabilitySlot[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [windowsError, setWindowsError] = useState<string | null>(null);

  const [selectedWindow, setSelectedWindow] = useState<AvailabilitySlot | null>(null);
  const [startTimeOptions, setStartTimeOptions] = useState<StartTimeOption[]>([]);
  const [startTimesLoading, setStartTimesLoading] = useState(false);
  const [startTimesError, setStartTimesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setDatesLoading(true);
      setDatesError(null);

      const today = new Date();
      const end = new Date();
      end.setDate(end.getDate() + DATE_RANGE_DAYS);

      const result = await fetchOpenDatesForReschedule(toIsoDate(today), toIsoDate(end));
      if (!active) return;
      setDatesLoading(false);

      if (!result.success) {
        setDatesError(result.message);
        return;
      }

      setOpenDates(result.dates);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSelectDate(date: Date | undefined) {
    if (!date) return;
    const iso = toIsoDate(date);
    setSelectedDate(iso);
    setSelectedWindow(null);
    setStartTimeOptions([]);
    setWindowsLoading(true);
    setWindowsError(null);

    const result = await fetchWindowsForRescheduleDate(iso);
    setWindowsLoading(false);

    if (!result.success) {
      setWindowsError(result.message);
      setWindows([]);
      return;
    }

    setWindows(result.windows);
  }

  async function handleSelectWindow(window: AvailabilitySlot) {
    setSelectedWindow(window);
    setStartTimesLoading(true);
    setStartTimesError(null);

    const result = await fetchValidStartTimesForReschedule(window.id, serviceId, bookingId);
    setStartTimesLoading(false);

    if (!result.success) {
      setStartTimesError(result.message);
      setStartTimeOptions([]);
      return;
    }

    setStartTimeOptions(result.options);
  }

  async function handleConfirm(option: StartTimeOption) {
    if (!selectedWindow) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await rescheduleBookingAction(bookingId, selectedWindow.id, option.startTime);
    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.message);
      return;
    }

    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {datesLoading && <p className="text-sm text-muted-foreground">Loading open dates…</p>}
      {datesError && <p className="text-sm text-destructive">{datesError}</p>}

      {!datesLoading && !datesError && (
        <Calendar
          mode="single"
          selected={selectedDate ? parseIsoDate(selectedDate) : undefined}
          onSelect={handleSelectDate}
          disabled={(date) => !openDates.includes(toIsoDate(date))}
        />
      )}

      {selectedDate && (
        <div className="flex flex-col gap-2">
          {windowsLoading && <p className="text-sm text-muted-foreground">Loading windows…</p>}
          {windowsError && <p className="text-sm text-destructive">{windowsError}</p>}
          {!windowsLoading && !windowsError && windows.length === 0 && (
            <p className="text-sm text-muted-foreground">No open windows on this date.</p>
          )}
          {!windowsLoading &&
            windows.map((window) => (
              <button
                key={window.id}
                type="button"
                onClick={() => handleSelectWindow(window)}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                {formatTimeRange(window.start_time, window.end_time)}
              </button>
            ))}
        </div>
      )}

      {selectedWindow && (
        <div className="flex flex-col gap-2">
          {startTimesLoading && (
            <p className="text-sm text-muted-foreground">Loading available start times…</p>
          )}
          {startTimesError && <p className="text-sm text-destructive">{startTimesError}</p>}
          {!startTimesLoading && !startTimesError && startTimeOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No available start times in this window for this service.
            </p>
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
                </Button>
              ))}
          </div>
        </div>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </div>
  );
}
