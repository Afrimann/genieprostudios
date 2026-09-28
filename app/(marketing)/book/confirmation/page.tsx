import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getBookingDetailForCustomer } from "@/lib/repositories/booking-repository";
import { formatKobo } from "@/lib/utils/money";
import { ConfirmationPoller } from "@/components/booking/confirmation-poller";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ConfirmationSearchParams = Promise<{ reference?: string; trxref?: string }>;

// Reads cookies (createClient) inside an async Server Component rendered in
// a Suspense boundary right here on the page — same reasoning as
// app/(marketing)/dashboard/page.tsx's instant=false (see that file's
// comment): without opting out, Cache Components can leave the Suspense
// fallback stuck on some navigation paths. Always needs a live session
// anyway, so it could never be meaningfully prerendered.
export const instant = false;

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function NoReferenceCard({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No payment reference found</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/dashboard" className="text-sm underline underline-offset-2">
          Go to your dashboard
        </Link>
      </CardContent>
    </Card>
  );
}

/** The "order successful" page — a real booking summary, not just a status line. */
async function OrderSuccess({ bookingId }: { bookingId: string }) {
  const booking = await getBookingDetailForCustomer(bookingId);

  if (!booking) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment confirmed</CardTitle>
          <CardDescription>Thanks — your payment went through successfully.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm underline underline-offset-2">
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const remainingKobo = booking.totalPriceKobo - booking.amountPaidKobo;
  const hasSession = Boolean(
    booking.sessionDate && booking.sessionStartTime && booking.sessionEndTime,
  );

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-none bg-[var(--amber-glow)]/15">
        <CheckCircle2 className="size-9 text-[var(--amber-glow)]" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium text-foreground">Booking confirmed!</h1>
        <p className="text-sm text-muted-foreground">
          {hasSession
            ? `You're booked in for ${booking.service.label} on ${booking.sessionDate}.`
            : `Your ${booking.service.label} order is confirmed and queued.`}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Package</span>
          <span className="font-medium text-foreground">{booking.service.label}</span>
        </div>
        {hasSession ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">{booking.sessionDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-foreground">
                {formatTimeRange(booking.sessionStartTime!, booking.sessionEndTime!)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Studio time</span>
              <span className="font-medium text-foreground">Not applicable — per-song add-on</span>
            </div>
            {booking.tracks.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Songs</span>
                <ul className="flex flex-col gap-0.5">
                  {booking.tracks.map((track, index) => (
                    <li key={`${track.title}-${index}`} className="font-medium text-foreground">
                      {index + 1}. {track.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-muted-foreground">Amount paid</span>
          <span className="font-mono font-semibold text-foreground">
            {formatKobo(booking.amountPaidKobo)}
          </span>
        </div>
        {remainingKobo > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Balance remaining</span>
            <span className="font-mono font-semibold text-foreground">
              {formatKobo(remainingKobo)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
        >
          <Link href={`/dashboard/${booking.id}`}>View your booking</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-none px-6 text-sm font-medium">
          <Link href="/book">Book another session</Link>
        </Button>
      </div>
    </div>
  );
}

function OrderFailed({ bookingId }: { bookingId: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-none bg-destructive/15">
        <XCircle className="size-9 text-destructive" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium text-foreground">
          This payment didn&apos;t go through
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {bookingId
            ? "No charge was made. Since this booking never had a successful payment, its time slot has been released — but you can pick up right where you left off and pay again."
            : "No charge was made. You can start a new booking whenever you're ready."}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
        >
          <Link href={bookingId ? `/dashboard/${bookingId}` : "/book"}>
            {bookingId ? "Review and retry" : "Start a new booking"}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-none px-6 text-sm font-medium">
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

// Paystack appends both `reference` and `trxref` (a legacy alias of the
// same value) to the callback URL — only `reference` is read here.
async function ConfirmationContent({
  searchParams,
}: {
  searchParams: ConfirmationSearchParams;
}) {
  const { reference } = await searchParams;

  if (!reference) {
    return <NoReferenceCard message="We couldn't find a payment reference on this link." />;
  }

  // RLS-scoped read (payments_select_own, 0010_rls_policies.sql) — the
  // customer can only ever see a payment tied to one of their own bookings.
  // A first, simple read of the current state; the poller below is what
  // actually watches for a pending -> success/failed transition, since
  // arriving at this URL is never itself proof of payment.
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("status, booking_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment) {
    return <NoReferenceCard message="We couldn't find a payment matching this reference." />;
  }

  if (payment.status === "success") {
    return <OrderSuccess bookingId={payment.booking_id} />;
  }

  if (payment.status === "failed") {
    return <OrderFailed bookingId={payment.booking_id ?? null} />;
  }

  // status === "pending" — hand off to the client-side poller, which is the
  // only thing that actually watches for the pending -> success/failed
  // transition (webhook-driven, or its own verifyPaymentWithPaystack
  // fallback).
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirming your payment</CardTitle>
        <CardDescription>
          This usually only takes a few seconds — please don&apos;t close this page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmationPoller reference={reference} />
      </CardContent>
    </Card>
  );
}

export default function ConfirmationPage({
  searchParams,
}: {
  searchParams: ConfirmationSearchParams;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Confirming your payment</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <ConfirmationContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
