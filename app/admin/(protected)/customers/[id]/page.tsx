import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";

import { getCustomerDetailForAdmin } from "@/lib/repositories/admin-customer-repository";
import { formatKobo } from "@/lib/utils/money";
import { toWhatsAppLink } from "@/lib/utils/phone";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as every other admin page.
export const instant = false;

// Same label/variant maps as admin-booking-repository.ts's consumers
// (app/admin/(protected)/bookings/page.tsx, bookings/[id]/page.tsx) — kept
// in sync so a booking's status badge reads identically everywhere an admin
// sees it.
const STATUS_LABELS: Record<string, string> = {
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  deposited: "secondary",
  paid_in_full: "default",
  auto_cancelled: "destructive",
  cancelled: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

/**
 * "Oct 10 at 11:00 PM – Oct 11, 2:00 AM" when sessionEndDate differs from
 * sessionDate (an overnight session — see bookings.session_end_date,
 * 0036_blocked_time_ranges.sql), else the plain single-date format — same
 * convention as app/admin/(protected)/bookings/page.tsx's formatSessionLine.
 */
function formatSessionLine(
  sessionDate: string,
  start: string,
  end: string,
  sessionEndDate: string | null,
): string {
  if (sessionEndDate && sessionEndDate !== sessionDate) {
    return `${sessionDate} at ${start.slice(0, 5)} – ${sessionEndDate} at ${end.slice(0, 5)}`;
  }

  return `${sessionDate} at ${formatTimeRange(start, end)}`;
}

async function CustomerDetail({ id }: { id: string }) {
  const customer = await getCustomerDetailForAdmin(id);

  if (!customer) {
    notFound();
  }

  const totalPaidKobo = customer.bookings.reduce((sum, b) => sum + b.amountPaidKobo, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <p className="font-heading text-lg font-medium text-foreground">
              {customer.name ?? "Unknown customer"}
            </p>
            <p className="text-sm text-muted-foreground">
              {customer.email ?? "No email on file"}
              {customer.phone ? ` · ${customer.phone}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {customer.phone && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={toWhatsAppLink(customer.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Chat on WhatsApp
                </a>
              </Button>
            )}
            {customer.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden="true" />
                  Send email
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Bookings</span>
            <span className="font-medium text-foreground">{customer.bookings.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Total paid</span>
            <span className="font-mono font-medium text-foreground">{formatKobo(totalPaidKobo)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <p className="font-heading text-lg font-medium text-foreground">Booking history</p>

        {customer.bookings.length === 0 && (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        )}

        {customer.bookings.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {customer.bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/admin/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">{booking.serviceLabel}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {booking.sessionDate && booking.sessionStartTime && booking.sessionEndTime
                      ? formatSessionLine(
                          booking.sessionDate,
                          booking.sessionStartTime,
                          booking.sessionEndTime,
                          booking.sessionEndDate,
                        )
                      : "Per-song add-on, no studio time"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatKobo(booking.amountPaidKobo)} / {formatKobo(booking.totalPriceKobo)}
                  </span>
                  <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"}>
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted" />
    </div>
  );
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher
        channelName={`admin-customer-${id}`}
        tables={[{ table: "bookings", filter: `customer_id=eq.${id}` }]}
      />
      <Link
        href="/admin/customers"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to customers
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <CustomerDetail id={id} />
      </Suspense>
    </main>
  );
}
