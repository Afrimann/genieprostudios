"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createSlotFormSchema, type CreateSlotFormValues } from "@/lib/validation/availability";
import {
  addSlot,
  closeSlotAction,
  fetchSlotsForDateWithBookings,
} from "@/lib/services/availability-actions";
import type {
  AvailabilitySlot,
  SlotWithBookings,
} from "@/lib/repositories/availability-repository";
import type { BookingStatus } from "@/lib/services/booking-service";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Local YYYY-MM-DD formatting — deliberately not toISOString() (which
// shifts to UTC and can roll the date across a timezone boundary). All
// availability dates are plain calendar dates with no timezone component.
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function statusBadgeVariant(status: AvailabilitySlot["status"]) {
  switch (status) {
    case "open":
      return "default" as const;
    case "booked":
      return "secondary" as const;
    case "closed":
      return "outline" as const;
  }
}

// Same copy/variant mapping as app/dashboard/page.tsx's STATUS_LABELS/
// STATUS_VARIANTS — reused here rather than invented fresh so a booking's
// status reads identically whether the customer or the admin is looking at
// it.
const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const BOOKING_STATUS_VARIANTS: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_deposit: "outline",
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
};

export function AvailabilityManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<SlotWithBookings[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : null;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSlotFormValues>({
    resolver: zodResolver(createSlotFormSchema),
  });

  async function loadSlots(date: string) {
    setLoading(true);
    setLoadError(null);
    const result = await fetchSlotsForDateWithBookings(date);
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setSlots([]);
      return;
    }

    setSlots(result.slots);
  }

  function handleSelectDate(date: Date | undefined) {
    setSelectedDate(date);
    reset();

    if (date) {
      loadSlots(toIsoDate(date));
    } else {
      setSlots([]);
      setLoadError(null);
    }
  }

  async function onSubmit(values: CreateSlotFormValues) {
    if (!selectedIso) return;

    const result = await addSlot({
      date: selectedIso,
      startTime: values.startTime,
      endTime: values.endTime,
    });

    if (!result.success) {
      setError("endTime", { message: result.message });
      return;
    }

    reset();
    startTransition(() => {
      loadSlots(selectedIso);
    });
  }

  async function handleClose(slotId: string) {
    if (!selectedIso) return;
    setClosingId(slotId);
    const result = await closeSlotAction(slotId);
    setClosingId(null);

    if (!result.success) {
      setLoadError(result.message);
      return;
    }

    loadSlots(selectedIso);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Pick a date</CardTitle>
          <CardDescription>Select a date to manage its slots.</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectDate}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Slots for {selectedIso ?? "—"}</CardTitle>
            <CardDescription>
              {selectedIso
                ? "All slots for this date, regardless of status."
                : "Pick a date on the calendar to see its slots."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!selectedIso && (
              <p className="text-sm text-muted-foreground">No date selected yet.</p>
            )}

            {selectedIso && loading && (
              <p className="text-sm text-muted-foreground">Loading slots…</p>
            )}

            {selectedIso && !loading && loadError && (
              <p className="text-sm text-destructive">{loadError}</p>
            )}

            {selectedIso && !loading && !loadError && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No slots yet for this date. Add one below.
              </p>
            )}

            {selectedIso &&
              !loading &&
              slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatTimeRange(slot.start_time, slot.end_time)}
                      </span>
                      <Badge variant={statusBadgeVariant(slot.status)}>{slot.status}</Badge>
                    </div>

                    {/* Closing a window only stops new bookings from being
                        carved out of it — it's independent of whatever
                        bookings are already nested underneath, so this stays
                        available regardless of the list below. */}
                    {slot.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={closingId === slot.id}
                        onClick={() => handleClose(slot.id)}
                      >
                        {closingId === slot.id ? "Closing…" : "Close"}
                      </Button>
                    )}
                  </div>

                  {slot.bookings.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-l border-border pl-3">
                      {slot.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {/* Non-null by construction: every booking in a window's own
                                list has a real slot_id, and slot_id/session_* fields are
                                only ever null together for an is_addon booking (see
                                0019_addon_bookings.sql's consistency check) — an addon
                                booking has no slot_id, so it can never appear here. */}
                            {formatTimeRange(
                              booking.session_start_time!,
                              booking.session_end_time!,
                            )}
                          </span>
                          <Badge variant={BOOKING_STATUS_VARIANTS[booking.status]}>
                            {BOOKING_STATUS_LABELS[booking.status]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {slot.bookings.length === 0 && (
                    <p className="pl-3 text-xs text-muted-foreground">
                      No bookings yet in this window.
                    </p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a slot</CardTitle>
            <CardDescription>
              Opens a new time slot on {selectedIso ?? "the selected date"}. A 30-minute
              buffer from any existing slot is required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="startTime">Start time</Label>
                <Input
                  id="startTime"
                  type="time"
                  aria-invalid={!!errors.startTime}
                  disabled={!selectedIso}
                  {...register("startTime")}
                />
                {errors.startTime && (
                  <p className="text-sm text-destructive">{errors.startTime.message}</p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="endTime">End time</Label>
                <Input
                  id="endTime"
                  type="time"
                  aria-invalid={!!errors.endTime}
                  disabled={!selectedIso}
                  {...register("endTime")}
                />
                {errors.endTime && (
                  <p className="text-sm text-destructive">{errors.endTime.message}</p>
                )}
              </div>

              <Button type="submit" disabled={!selectedIso || isSubmitting || isPending}>
                {isSubmitting ? "Adding…" : "Add slot"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Closing a slot only affects open slots — booked slots represent a committed
          session and can&apos;t be withdrawn from here.
        </p>
      </div>
    </div>
  );
}
