import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getBookingDetailForCustomer } from "@/lib/repositories/booking-repository";
import type { BookingStatus } from "@/lib/services/booking-service";
import { formatKobo } from "@/lib/utils/money";
import { Badge } from "@/components/ui/badge";
import { PayBalanceButton } from "@/components/dashboard/pay-balance-button";
import { CompletePaymentButtons } from "@/components/dashboard/complete-payment-buttons";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";

// Behind app/(marketing)/dashboard/layout.tsx's live session check, so this
// can never be meaningfully prerendered either.
export const instant = false;

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending_deposit: "outline",
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-lg font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

async function BookingDetail({ id }: { id: string }) {
  const booking = await getBookingDetailForCustomer(id);

  if (!booking) {
    notFound();
  }

  const remainingKobo = booking.totalPriceKobo - booking.amountPaidKobo;
  const hasSession = Boolean(
    booking.sessionDate && booking.sessionStartTime && booking.sessionEndTime,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium text-foreground">
            {booking.service.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasSession
              ? `${booking.sessionDate} · ${formatTimeRange(booking.sessionStartTime!, booking.sessionEndTime!)}`
              : "Per-song add-on — no studio time reserved"}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[booking.status]}>{STATUS_LABELS[booking.status]}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard title="Session">
          <Field label="Package" value={booking.service.label} />
          <Field
            label="Duration"
            value={
              booking.service.isAddon
                ? "Priced per song"
                : `${booking.service.durationHours} hour${booking.service.durationHours === 1 ? "" : "s"}`
            }
          />
          {hasSession ? (
            <>
              <Field label="Date" value={booking.sessionDate} />
              <Field
                label="Time"
                value={formatTimeRange(booking.sessionStartTime!, booking.sessionEndTime!)}
              />
            </>
          ) : (
            <Field label="Studio time" value="Not applicable — per-song add-on" />
          )}
          <Field label="Booked on" value={formatDateTime(booking.createdAt)} />
        </DetailCard>

        <DetailCard title="Payment summary">
          <Field label="Total price" value={formatKobo(booking.totalPriceKobo)} />
          <Field label="Deposit due" value={formatKobo(booking.depositAmountKobo)} />
          <Field label="Amount paid" value={formatKobo(booking.amountPaidKobo)} />
          <Field
            label="Remaining"
            value={
              <span className={remainingKobo > 0 ? "text-destructive" : ""}>
                {formatKobo(remainingKobo)}
              </span>
            }
          />
        </DetailCard>
      </div>

      {booking.tracks.length > 0 && (
        <DetailCard title="Songs">
          <div className="flex flex-col divide-y divide-border">
            {booking.tracks.map((track, index) => (
              <div key={`${track.title}-${index}`} className="flex items-center gap-2 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium text-foreground">{track.title}</span>
              </div>
            ))}
          </div>
        </DetailCard>
      )}

      <DetailCard title="Payment history">
        {booking.payments.length === 0 && (
          <p className="text-sm text-muted-foreground">No payment attempts recorded yet.</p>
        )}
        {booking.payments.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {booking.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-xs text-muted-foreground">{formatDateTime(payment.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PAYMENT_TYPE_LABELS[payment.type] ?? payment.type}</Badge>
                  <Badge variant={payment.status === "success" ? "default" : "secondary"}>
                    {payment.status}
                  </Badge>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {formatKobo(payment.amountKobo)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailCard>

      {booking.status === "deposited" && remainingKobo > 0 && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-5">
          <PayBalanceButton bookingId={booking.id} remainingKobo={remainingKobo} />
        </div>
      )}

      {booking.status === "pending_deposit" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/40 p-5">
          <p className="text-sm text-muted-foreground">
            This booking isn&apos;t confirmed yet — complete payment to lock in your time slot.
          </p>
          <CompletePaymentButtons
            bookingId={booking.id}
            depositAmountKobo={booking.depositAmountKobo}
            totalPriceKobo={booking.totalPriceKobo}
          />
          <div className="border-t border-border pt-4">
            <CancelBookingButton bookingId={booking.id} redirectTo="/dashboard" />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default async function CustomerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to your bookings
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <BookingDetail id={id} />
      </Suspense>
    </main>
  );
}
