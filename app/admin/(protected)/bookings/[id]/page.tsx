import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  getBookingDetailForAdmin,
  getUnresolvedPastSessions,
} from "@/lib/repositories/admin-booking-repository";
import { formatKobo } from "@/lib/utils/money";
import { Badge } from "@/components/ui/badge";
import { BookingDetailActions } from "@/components/admin/booking-detail-actions";
import { TrackDownloadButton } from "@/components/admin/track-download-button";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning as
// every other admin page.
export const instant = false;

const STATUS_LABELS: Record<string, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_deposit: "outline",
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
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
  const [booking, unresolved] = await Promise.all([
    getBookingDetailForAdmin(id),
    getUnresolvedPastSessions(),
  ]);

  if (!booking) {
    notFound();
  }

  const remainingKobo = booking.totalPriceKobo - booking.amountPaidKobo;
  const canMarkStale = unresolved.some((b) => b.id === booking.id) && booking.status === "deposited";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            #{booking.id.slice(0, 8)}
          </span>
          <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Created {formatDateTime(booking.createdAt)} · Updated {formatDateTime(booking.updatedAt)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title="Customer">
          <Field label="Name" value={booking.customer.name ?? "Unknown"} />
          <Field label="Email" value={booking.customer.email ?? "—"} />
          <Field label="Phone" value={booking.customer.phone ?? "—"} />
        </DetailCard>

        <DetailCard title="Session">
          <Field label="Service" value={booking.service.label} />
          <Field
            label="Duration"
            value={
              booking.service.isAddon
                ? "Priced per song"
                : `${booking.service.durationHours} hour${booking.service.durationHours === 1 ? "" : "s"}`
            }
          />
          {booking.sessionDate && booking.sessionStartTime && booking.sessionEndTime ? (
            <>
              <Field label="Date" value={booking.sessionDate} />
              <Field
                label="Time"
                value={formatTimeRange(booking.sessionStartTime, booking.sessionEndTime)}
              />
            </>
          ) : (
            <Field label="Studio time" value="Not applicable — per-song add-on" />
          )}
          {booking.window && (
            <Field
              label="Window"
              value={`${formatTimeRange(booking.window.startTime, booking.window.endTime)} (${booking.window.status})`}
            />
          )}
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

        <DetailCard title="Terms & conditions">
          {booking.tcAcceptance ? (
            <>
              <Field label="Version accepted" value={booking.tcAcceptance.termsVersion} />
              <Field label="Accepted at" value={formatDateTime(booking.tcAcceptance.acceptedAt)} />
              <Field label="IP address" value={booking.tcAcceptance.ipAddress ?? "—"} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not yet accepted.</p>
          )}
        </DetailCard>
      </div>

      {booking.tracks.length > 0 && (
        <DetailCard title="Songs">
          {(booking.contactName || booking.contactEmail) && (
            <div className="flex flex-col gap-2 border-b border-border pb-3">
              <Field label="Contact name" value={booking.contactName ?? "—"} />
              <Field label="Contact email" value={booking.contactEmail ?? "—"} />
            </div>
          )}
          <div className="flex flex-col divide-y divide-border">
            {booking.tracks.map((track, index) => (
              <div key={track.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {index + 1}. {track.title}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{track.fileName}</span>
                </div>
                <TrackDownloadButton filePath={track.filePath} />
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
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">
                    {payment.paystackReference}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {payment.verifiedAt ? formatDateTime(payment.verifiedAt) : formatDateTime(payment.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{payment.type === "deposit" ? "Deposit" : "Balance"}</Badge>
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

      <BookingDetailActions
        bookingId={booking.id}
        serviceId={booking.service.id}
        status={booking.status}
        canMarkStale={canMarkStale}
        hasSession={Boolean(booking.sessionDate)}
      />
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher
        channelName={`admin-booking-${id}`}
        tables={[
          { table: "bookings", filter: `id=eq.${id}` },
          { table: "payments", filter: `booking_id=eq.${id}` },
        ]}
      />
      <Link
        href="/admin/bookings"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to bookings
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <BookingDetail id={id} />
      </Suspense>
    </main>
  );
}
