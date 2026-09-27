"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { verifyPaymentWithPaystack } from "@/lib/services/payment-service";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 30000;

type PollStatus = "pending" | "success" | "failed" | "timed_out";

interface ConfirmationPollerProps {
  reference: string;
}

/**
 * Polls verifyPaymentWithPaystack() every ~2s until the payment's status
 * flips to success/failed, or ~30s elapses with no resolution. Arrival at
 * this page (or a client-side redirect) is never itself proof of payment.
 * verifyPaymentWithPaystack() checks the DB first (the webhook may have
 * already landed) and, if still pending, asks Paystack directly — a
 * necessary fallback since the webhook can never reach a local dev server,
 * and can be delayed in production too.
 */
export function ConfirmationPoller({ reference }: ConfirmationPollerProps) {
  const [status, setStatus] = useState<PollStatus>("pending");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      const result = await verifyPaymentWithPaystack(reference);

      if (!active) return;

      if (result.bookingId) setBookingId(result.bookingId);

      if (result.status === "success" || result.status === "failed") {
        setStatus(result.status);
        return;
      }

      elapsedRef.current += POLL_INTERVAL_MS;

      if (elapsedRef.current >= MAX_POLL_MS) {
        setStatus("timed_out");
        return;
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [reference]);

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle2 className="size-8 text-[var(--amber-glow)]" aria-hidden="true" />
        <p className="font-medium text-foreground">Payment confirmed — thank you!</p>
        <Button
          asChild
          className="h-10 rounded-none bg-[var(--amber-glow)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
        >
          <Link href={bookingId ? `/dashboard/${bookingId}` : "/dashboard"}>View your booking</Link>
        </Button>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <XCircle className="size-8 text-destructive" aria-hidden="true" />
        <p className="font-medium text-destructive">This payment did not go through.</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          No charge was made{bookingId ? " and your time slot has been released" : ""}. You can
          try again whenever you&apos;re ready.
        </p>
        <div className="flex gap-3">
          <Button
            asChild
            className="h-10 rounded-none bg-[var(--amber-glow)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href={bookingId ? `/dashboard/${bookingId}` : "/book"}>
              {bookingId ? "Review and retry" : "Start a new booking"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-none px-5 text-sm font-medium">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "timed_out") {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-medium">Still processing — this can take a little longer.</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll keep confirming your payment in the background. Check your dashboard in a
          few minutes for the final status.
        </p>
        <Link
          href={bookingId ? `/dashboard/${bookingId}` : "/dashboard"}
          className="text-sm underline underline-offset-2"
        >
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Confirming your payment…</p>
    </div>
  );
}
