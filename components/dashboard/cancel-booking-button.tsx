"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { cancelBooking } from "@/lib/services/booking-flow-actions";
import { Button } from "@/components/ui/button";

interface CancelBookingButtonProps {
  bookingId: string;
  // Where to send the customer after a successful cancel — the dashboard
  // list for the detail page (nothing left to show there), or just a
  // refresh for the list page itself (the cancelled row simply disappears,
  // per getBookingsForCurrentCustomer's .neq("status", "cancelled")).
  redirectTo?: string;
  // Takes precedence over redirectTo/refresh when supplied. Needed by the
  // booking flow (components/booking/booking-flow.tsx), which is a Client
  // Component living ON /book: router.push("/book") from there is a no-op
  // navigation that never remounts it, so its ~18 pieces of form state
  // survived a cancel and the summary step stayed fully populated against a
  // booking that no longer existed. The flow passes resetFlow() here
  // instead of relying on a remount that can't happen.
  onCancelled?: () => void;
}

/**
 * Two-step inline confirm (not a native window.confirm, to match the rest
 * of this site's custom UI) for a customer opting out of a pending_deposit
 * booking before ever paying for it.
 */
export function CancelBookingButton({
  bookingId,
  redirectTo,
  onCancelled,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const result = await cancelBooking(bookingId);

    setSubmitting(false);

    if (!result.success) {
      setError(result.message);
      setConfirming(false);
      return;
    }

    // Reset the inline confirm too — without this, a caller that keeps this
    // component mounted (the booking flow) would re-render it still stuck in
    // its "Cancel this booking?" confirm state.
    setConfirming(false);

    if (onCancelled) {
      onCancelled();
    } else if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Cancel this booking? This can&apos;t be undone, and your time slot will be released.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Cancelling…" : "Yes, cancel it"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => setConfirming(false)}
          >
            Keep booking
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <X className="size-3.5" aria-hidden="true" />
        Cancel this booking
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
