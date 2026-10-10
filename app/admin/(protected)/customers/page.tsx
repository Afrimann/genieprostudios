import { Suspense } from "react";
import Link from "next/link";

import { getCustomersWithBookings } from "@/lib/repositories/admin-customer-repository";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as every other admin page.
export const instant = false;

const CUSTOMERS_REALTIME_TABLES = [{ table: "bookings" }];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function CustomersTable() {
  const customers = await getCustomersWithBookings();

  if (customers.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers have booked yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {customers.map((customer) => (
        <Link
          key={customer.id}
          href={`/admin/customers/${customer.id}`}
          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-foreground">{customer.name ?? "Unknown customer"}</span>
            <span className="truncate text-xs text-muted-foreground">
              {customer.email ?? "No email"} {customer.phone ? `· ${customer.phone}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {customer.bookingCount} booking{customer.bookingCount === 1 ? "" : "s"}
            </span>
            <span>Last {formatDate(customer.lastBookingAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CustomersTableFallback() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher channelName="admin-customers-list" tables={CUSTOMERS_REALTIME_TABLES} />
      <p className="text-sm text-muted-foreground">
        Everyone who has booked before — tap a customer to see their history and reach out.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<CustomersTableFallback />}>
            <CustomersTable />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
