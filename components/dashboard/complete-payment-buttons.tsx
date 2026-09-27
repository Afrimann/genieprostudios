"use client";

import { useState } from "react";

import { initializePayment, type PaymentChoice } from "@/lib/services/payment-service";
import { formatKobo } from "@/lib/utils/money";
import { useResetOnPageShow } from "@/lib/hooks/use-reset-on-pageshow";
import { Button } from "@/components/ui/button";

interface CompletePaymentButtonsProps {
  bookingId: string;
  depositAmountKobo: number;
  totalPriceKobo: number;
}

/**
 * Resume-payment CTA for a still-pending_deposit booking — the "cart" that
 * survives a closed/cancelled/failed Paystack checkout (see
 * confirmPaymentByReference and verifyPaymentWithPaystack's failed/abandoned
 * branch in payment-service.ts, which only cancels a booking outright once
 * it's confirmed failed; simply not returning to /book/confirmation at all
 * leaves it exactly here, still pending_deposit, resumable). Same
 * minimum/full choice and Paystack-redirect pattern as the booking flow's
 * own summary step (components/booking/booking-flow.tsx) — this is the
 * "come back and finish paying" surface for that same booking.
 */
export function CompletePaymentButtons({
  bookingId,
  depositAmountKobo,
  totalPriceKobo,
}: CompletePaymentButtonsProps) {
  const [submitting, setSubmitting] = useState<PaymentChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useResetOnPageShow(() => {
    setSubmitting(null);
    setError(null);
  });

  async function handlePayment(choice: PaymentChoice) {
    setError(null);
    setSubmitting(choice);

    const result = await initializePayment(bookingId, choice);

    if (!result.success) {
      setSubmitting(null);
      setError(result.message);
      return;
    }

    window.location.href = result.authorizationUrl;
  }

  const isPaying = submitting !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          disabled={isPaying}
          onClick={() => handlePayment("minimum")}
          className="rounded-none bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
        >
          {submitting === "minimum" ? "Redirecting…" : `Pay deposit (${formatKobo(depositAmountKobo)})`}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPaying}
          onClick={() => handlePayment("full")}
          className="rounded-none"
        >
          {submitting === "full" ? "Redirecting…" : `Pay in full (${formatKobo(totalPriceKobo)})`}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
