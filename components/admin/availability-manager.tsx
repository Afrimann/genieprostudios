"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBlockFormSchema, type CreateBlockFormValues } from "@/lib/validation/availability";
import {
  addBlock,
  deleteBlockAction,
  fetchBlocksAndBookingsForDate,
} from "@/lib/services/availability-actions";
import type {
  BlockedTimeRange,
  DateRangeBookingRow,
} from "@/lib/repositories/availability-repository";
import type { BookingStatus } from "@/lib/services/booking-service";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
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

const AVAILABILITY_REALTIME_TABLES = [{ table: "blocked_time_ranges" }, { table: "bookings" }];

/**
 * Admin availability manager, reworked onto blocked_time_ranges (0036) —
 * every date is open by default now, so this no longer manages an "open a
 * slot" allowlist. Instead it shows, per selected date: existing blocks
 * (closures) with a "Remove block" action, and bookings overlapping that
 * date for visibility (read-only here — bookings are managed from
 * /admin/bookings).
 */
export function AvailabilityManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [blockList, setBlockList] = useState<BlockedTimeRange[]>([]);
  const [bookingList, setBookingList] = useState<DateRangeBookingRow[]>([]);

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : null;

  useRealtimeRefresh({
    channelName: "admin-availability",
    tables: AVAILABILITY_REALTIME_TABLES,
    // No-op until a date is picked — nothing is rendered to refresh yet.
    onRefresh: () => {
      if (selectedIso) loadForDate(selectedIso);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBlockFormValues>({
    resolver: zodResolver(createBlockFormSchema),
  });

  async function loadForDate(date: string) {
    setLoading(true);
    setLoadError(null);
    const result = await fetchBlocksAndBookingsForDate(date);
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setBlockList([]);
      setBookingList([]);
      return;
    }

    setBlockList(result.data.blocks);
    setBookingList(result.data.bookings);
  }

  function handleSelectDate(date: Date | undefined) {
    setSelectedDate(date);
    reset();

    if (date) {
      loadForDate(toIsoDate(date));
    } else {
      setBlockList([]);
      setBookingList([]);
      setLoadError(null);
    }
  }

  async function onSubmit(values: CreateBlockFormValues) {
    if (!selectedIso) return;

    const result = await addBlock({
      date: selectedIso,
      startTime: values.startTime,
      endTime: values.endTime,
      reason: values.reason,
    });

    if (!result.success) {
      setError("endTime", { message: result.message });
      return;
    }

    reset();
    startTransition(() => {
      loadForDate(selectedIso);
    });
  }

  async function handleRemoveBlock(blockId: string) {
    if (!selectedIso) return;
    setRemovingId(blockId);
    const result = await deleteBlockAction(blockId);
    setRemovingId(null);

    if (!result.success) {
      setLoadError(result.message);
      return;
    }

    loadForDate(selectedIso);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Pick a date</CardTitle>
          <CardDescription>Select a date to manage its blocked time ranges.</CardDescription>
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
            <CardTitle>Blocked ranges for {selectedIso ?? "—"}</CardTitle>
            <CardDescription>
              {selectedIso
                ? "Every date is open by default — these ranges are closed to new bookings."
                : "Pick a date on the calendar to see its blocks."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!selectedIso && (
              <p className="text-sm text-muted-foreground">No date selected yet.</p>
            )}

            {selectedIso && loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {selectedIso && !loading && loadError && (
              <p className="text-sm text-destructive">{loadError}</p>
            )}

            {selectedIso && !loading && !loadError && blockList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No blocks for this date — it&apos;s fully open. Block a time range below.
              </p>
            )}

            {selectedIso &&
              !loading &&
              blockList.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {formatTimeRange(block.start_time, block.end_time)}
                    </span>
                    {block.reason && (
                      <span className="text-xs text-muted-foreground">{block.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={removingId === block.id}
                    onClick={() => handleRemoveBlock(block.id)}
                  >
                    {removingId === block.id ? "Removing…" : "Remove block"}
                  </Button>
                </div>
              ))}

            {selectedIso && !loading && bookingList.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  Bookings overlapping this date
                </p>
                <div className="flex flex-col gap-1.5">
                  {bookingList.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {booking.session_start_time && booking.session_end_time
                          ? formatTimeRange(booking.session_start_time, booking.session_end_time)
                          : "—"}
                      </span>
                      <Badge variant={BOOKING_STATUS_VARIANTS[booking.status]}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Block a time range</CardTitle>
            <CardDescription>
              Closes this time range on {selectedIso ?? "the selected date"} to new bookings. A
              30-minute buffer from any existing, still-live booking is enforced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
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
                  {isSubmitting ? "Blocking…" : "Block range"}
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g. Maintenance, owner unavailable"
                  disabled={!selectedIso}
                  {...register("reason")}
                />
                {errors.reason && (
                  <p className="text-sm text-destructive">{errors.reason.message}</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Removing a block immediately re-opens that time range to new bookings — it has no
          effect on bookings already made.
        </p>
      </div>
    </div>
  );
}
