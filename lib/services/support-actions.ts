"use server";

// Server Action boundary for the "front desk" support chat, used by both
// the customer's and the admin's UI — one shared file since all three
// actions are thin RPC passthroughs and the RPCs themselves enforce
// customer-vs-admin authorization (see 0021_support_tickets.sql), so
// splitting into separate customer/admin action files here would just be
// indirection. Mirrors booking-flow-actions.ts's role: keeps the hook/page
// layer only ever importing from "use server" files, never
// services/repositories directly.

import {
  closeTicket,
  createOrResumeTicket,
  sendTicketMessage,
  type CloseTicketResult,
  type CreateTicketResult,
  type SendMessageResult,
} from "@/lib/services/support-service";

export async function createOrResumeTicketAction(subject: string): Promise<CreateTicketResult> {
  return createOrResumeTicket(subject);
}

export async function sendTicketMessageAction(ticketId: string, body: string): Promise<SendMessageResult> {
  return sendTicketMessage(ticketId, body);
}

export async function closeTicketAction(ticketId: string): Promise<CloseTicketResult> {
  return closeTicket(ticketId);
}
