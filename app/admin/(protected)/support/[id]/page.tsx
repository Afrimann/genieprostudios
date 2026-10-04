import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getTicketForAdmin, getTicketMessagesForAdmin } from "@/lib/repositories/admin-support-repository";
import { Badge } from "@/components/ui/badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";

// Same reasoning as every other admin page — behind the live session+admin
// check in app/admin/(protected)/layout.tsx, can never be meaningfully prerendered.
export const instant = false;

async function TicketDetail({ id }: { id: string }) {
  const ticket = await getTicketForAdmin(id);

  if (!ticket) {
    notFound();
  }

  const messages = await getTicketMessagesForAdmin(id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-medium text-foreground">{ticket.subject}</p>
          <p className="text-sm text-muted-foreground">
            {ticket.customerName ?? "Unknown customer"} · {ticket.customerEmail ?? "—"}
          </p>
        </div>
        <Badge variant={ticket.status === "open" ? "secondary" : "outline"}>
          {ticket.status === "open" ? "Open" : "Closed"}
        </Badge>
      </div>

      <TicketThread
        ticketId={ticket.id}
        initialMessages={messages}
        initialStatus={ticket.status}
        viewerRole="admin"
      />
    </div>
  );
}

function DetailFallback() {
  return <div className="h-64 w-full animate-pulse rounded-2xl border border-border bg-muted" />;
}

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher
        channelName={`admin-support-ticket-${id}`}
        tables={[{ table: "support_tickets", filter: `id=eq.${id}` }]}
      />
      <Link
        href="/admin/support"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to conversations
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <TicketDetail id={id} />
      </Suspense>
    </main>
  );
}
