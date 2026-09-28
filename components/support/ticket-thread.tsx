"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { closeTicketAction, sendTicketMessageAction } from "@/lib/services/support-actions";
import type { SupportMessage } from "@/lib/repositories/support-repository";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TicketThreadProps {
  ticketId: string;
  initialMessages: SupportMessage[];
  initialStatus: "open" | "closed";
  viewerRole: "customer" | "admin";
}

/**
 * Shared message thread for both the customer's and the admin's ticket
 * view — "own" messages (right-aligned) are determined by
 * sender_role === viewerRole, not a specific user id, since "the front
 * desk" is a single collective identity on the admin side (see
 * lib/services/support-service.ts's role-resolution comment).
 *
 * Subscribes to Supabase Realtime (postgres_changes INSERT on
 * support_messages filtered to this ticket) so both sides see new messages
 * without a manual refresh — sends are also appended optimistically from
 * the RPC's own return value, deduped against the realtime echo by id.
 */
export function TicketThread({ ticketId, initialMessages, initialStatus, viewerRole }: TicketThreadProps) {
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const incoming = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);

    const result = await sendTicketMessageAction(ticketId, body);
    setSending(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessages((prev) => (prev.some((m) => m.id === result.message.id) ? prev : [...prev, result.message]));
    setDraft("");
  }

  async function handleClose() {
    setClosing(true);
    setError(null);

    const result = await closeTicketAction(ticketId);
    setClosing(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setStatus("closed");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-[28rem] min-h-[16rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.map((message) => {
          const isOwn = message.sender_role === viewerRole;
          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  isOwn
                    ? "bg-[var(--amber-glow)] text-[var(--primary-foreground)]"
                    : "bg-secondary text-foreground"
                }`}
              >
                {message.body}
              </div>
              <span className="mt-1 text-[10px] text-muted-foreground">
                {message.sender_role === "admin" ? "Front desk" : "You"} · {formatTime(message.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {status === "open" ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            rows={3}
            disabled={sending}
          />
          <div className="flex items-center justify-between gap-2">
            {viewerRole === "admin" ? (
              <Button variant="outline" size="sm" disabled={closing} onClick={handleClose}>
                {closing ? "Closing…" : "Close conversation"}
              </Button>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              disabled={sending || !draft.trim()}
              onClick={handleSend}
              className="bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Send
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center text-sm text-muted-foreground">
          This conversation is closed.
        </p>
      )}
    </div>
  );
}
