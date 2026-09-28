"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createOrResumeTicketAction, sendTicketMessageAction } from "@/lib/services/support-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Customer-facing "start a conversation" form — creates (or resumes, per
 * the one-open-ticket-at-a-time rule, 0021_support_tickets.sql) a ticket,
 * sends the first message, then router.refresh()es so the parent Server
 * Component page re-fetches getMyOpenTicket() and swaps this form for the
 * live TicketThread.
 */
export function StartConversationForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const ticketResult = await createOrResumeTicketAction(subject);

    if (!ticketResult.success) {
      setSubmitting(false);
      setError(ticketResult.message);
      return;
    }

    const messageResult = await sendTicketMessageAction(ticketResult.ticket.id, message);
    setSubmitting(false);

    if (!messageResult.success) {
      setError(messageResult.message);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject">What&apos;s this about?</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Question about my booking"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's up…"
          rows={4}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={submitting}
        className="h-10 self-start rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
      >
        {submitting ? "Sending…" : "Start conversation"}
      </Button>
    </form>
  );
}
