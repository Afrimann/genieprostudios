import { Suspense } from "react";
import Link from "next/link";

import { getAllTicketsForAdmin } from "@/lib/repositories/admin-support-repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as every other admin page (e.g. app/admin/(protected)/bookings/page.tsx).
export const instant = false;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Every ticket, open (awaiting-reply first) then closed — mirrors AllBookingsTable's "order admin" style. */
async function TicketsTable() {
  const tickets = await getAllTicketsForAdmin();

  if (tickets.length === 0) {
    return <p className="text-sm text-muted-foreground">No conversations yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {tickets.map((ticket) => {
        const awaitingReply = ticket.status === "open" && ticket.last_message_role === "customer";

        return (
          <Link
            key={ticket.id}
            href={`/admin/support/${ticket.id}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground">
                {ticket.customerName ?? ticket.customerEmail ?? "Unknown customer"}
              </span>
              <span className="truncate text-xs text-muted-foreground">{ticket.subject}</span>
            </div>

            <div className="flex items-center gap-3">
              {ticket.last_message_at && (
                <span className="text-xs text-muted-foreground">{formatDate(ticket.last_message_at)}</span>
              )}
              {awaitingReply && <Badge variant="destructive">Awaiting reply</Badge>}
              <Badge variant={ticket.status === "open" ? "secondary" : "outline"}>
                {ticket.status === "open" ? "Open" : "Closed"}
              </Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function TicketsTableFallback() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">Front desk conversations with customers.</p>

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TicketsTableFallback />}>
            <TicketsTable />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
