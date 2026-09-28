import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getTicketById, getTicketMessages } from "@/lib/repositories/support-repository";
import { TicketThread } from "@/components/support/ticket-thread";

// Same reasoning as the parent support/page.tsx's instant=false.
export const instant = false;

async function TicketDetail({ id }: { id: string }) {
  const ticket = await getTicketById(id);

  if (!ticket) {
    notFound();
  }

  const messages = await getTicketMessages(id);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-lg font-medium text-foreground">{ticket.subject}</p>
      <TicketThread
        ticketId={ticket.id}
        initialMessages={messages}
        initialStatus={ticket.status}
        viewerRole="customer"
      />
    </div>
  );
}

function DetailFallback() {
  return <div className="h-64 w-full animate-pulse rounded-2xl border border-border bg-muted" />;
}

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link
        href="/dashboard/support"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to front desk
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <TicketDetail id={id} />
      </Suspense>
    </main>
  );
}
