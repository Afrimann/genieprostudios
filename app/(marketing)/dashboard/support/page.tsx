import { Suspense } from "react";
import Link from "next/link";

import { getMyClosedTickets, getMyOpenTicket, getTicketMessages } from "@/lib/repositories/support-repository";
import { TicketThread } from "@/components/support/ticket-thread";
import { StartConversationForm } from "@/components/support/start-conversation-form";

// Same reasoning as app/(marketing)/dashboard/page.tsx's instant=false —
// this reads cookies+DB live inside a Suspense boundary on the page itself,
// and always needs a session, so it can never be meaningfully prerendered.
export const instant = false;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function SupportContent() {
  const openTicket = await getMyOpenTicket();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="font-heading text-lg font-medium text-foreground">
          {openTicket ? openTicket.subject : "Message the front desk"}
        </p>
        {openTicket ? (
          <TicketThread
            ticketId={openTicket.id}
            initialMessages={await getTicketMessages(openTicket.id)}
            initialStatus={openTicket.status}
            viewerRole="customer"
          />
        ) : (
          <StartConversationForm />
        )}
      </div>

      <PastConversations />
    </div>
  );
}

async function PastConversations() {
  const closed = await getMyClosedTickets();

  if (closed.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <p className="font-heading text-sm font-medium text-foreground">Past conversations</p>
      <div className="flex flex-col divide-y divide-border">
        {closed.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/dashboard/support/${ticket.id}`}
            className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-[var(--amber-glow)]"
          >
            <span className="text-foreground">{ticket.subject}</span>
            <span className="text-xs text-muted-foreground">
              {ticket.closed_at ? formatDate(ticket.closed_at) : formatDate(ticket.created_at)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SupportFallback() {
  return <div className="h-64 w-full animate-pulse rounded-2xl border border-border bg-muted" />;
}

export default function SupportPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-14">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Front desk
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Talk to the studio
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ask a question or flag something — we&apos;ll reply here, and you can keep the
            conversation going until it&apos;s resolved.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <Suspense fallback={<SupportFallback />}>
            <SupportContent />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
