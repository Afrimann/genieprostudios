"use client";

import { useState } from "react";

import { initializePayment } from "@/lib/services/payment-service";
import { formatKobo } from "@/lib/utils/money";
import { useResetOnPageShow } from "@/lib/hooks/use-reset-on-pageshow";
import { Button } from "@/components/ui/button";

interface PayBalanceButtonProps {
  bookingId: string;
  remainingKobo: number;
}

/**
 * Client Component so app/dashboard/page.tsx (a Server Component) can offer
 * a "pay remaining balance" action without calling a Server Action directly
 * from server-rendered markup — same call/redirect/error-handling pattern as
 * the summary step's payment buttons in components/booking/booking-flow.tsx.
 */
export function PayBalanceButton({ bookingId, remainingKobo }: PayBalanceButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same bfcache fix as the booking flow's payment buttons — see
  // lib/hooks/use-reset-on-pageshow.ts.
  useResetOnPageShow(() => {
    setSubmitting(false);
    setError(null);
  });

  async function handleClick() {
    setError(null);
    setSubmitting(true);

    const result = await initializePayment(bookingId, "balance");

    if (!result.success) {
      setSubmitting(false);
      setError(result.message);
      return;
    }

    window.location.href = result.authorizationUrl;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" disabled={submitting} onClick={handleClick}>
        {submitting ? "Redirecting…" : `Pay remaining balance (${formatKobo(remainingKobo)})`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
