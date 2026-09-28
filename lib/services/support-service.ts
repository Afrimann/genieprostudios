import { createClient } from "@/lib/supabase/server";
import type { SupportMessage, SupportTicket } from "@/lib/repositories/support-repository";
import { sendOwnerNewSupportMessageEmail } from "@/lib/services/email-service";

// Business-logic layer for the "front desk" support chat — thin wrappers
// around the SECURITY DEFINER RPCs in 0021_support_tickets.sql, same
// convention as booking-service.ts. One shared sendTicketMessage() serves
// both customer and admin callers: the RPC itself resolves the caller's
// role from is_admin()/ticket ownership, never a client-supplied value.

export type CreateTicketResult =
  | { success: true; ticket: SupportTicket }
  | { success: false; error: "auth_required" | "invalid_subject" | "unknown"; message: string }
  ;

function translateTicketError(error: { message: string }): CreateTicketResult {
  const text = error.message ?? "";

  if (text.includes("auth_required")) {
    return { success: false, error: "auth_required", message: "Please sign in to continue." };
  }

  if (text.includes("invalid_subject")) {
    return { success: false, error: "invalid_subject", message: "Please tell us what this is about." };
  }

  return { success: false, error: "unknown", message: "Something went wrong. Please try again." };
}

export async function createOrResumeTicket(subject: string): Promise<CreateTicketResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_or_resume_support_ticket", {
    p_subject: subject,
  });

  if (error) {
    return translateTicketError(error);
  }

  if (!data) {
    return { success: false, error: "unknown", message: "Could not start a conversation. Please try again." };
  }

  return { success: true, ticket: data as SupportTicket };
}

export type SendMessageResult =
  | { success: true; message: SupportMessage }
  | {
      success: false;
      error: "auth_required" | "invalid_ticket" | "not_authorized" | "ticket_closed" | "invalid_message" | "unknown";
      message: string;
    };

function translateSendMessageError(error: { message: string }): SendMessageResult {
  const text = error.message ?? "";

  if (text.includes("auth_required")) {
    return { success: false, error: "auth_required", message: "Please sign in to continue." };
  }

  if (text.includes("invalid_ticket")) {
    return { success: false, error: "invalid_ticket", message: "This conversation could not be found." };
  }

  if (text.includes("not_authorized")) {
    return { success: false, error: "not_authorized", message: "You don't have access to this conversation." };
  }

  if (text.includes("ticket_closed")) {
    return {
      success: false,
      error: "ticket_closed",
      message: "This conversation is closed. Start a new one to keep talking to us.",
    };
  }

  if (text.includes("invalid_message")) {
    return { success: false, error: "invalid_message", message: "Please enter a message." };
  }

  return { success: false, error: "unknown", message: "Something went wrong. Please try again." };
}

/**
 * Shared by both the customer's and the admin's reply box. After a
 * successful CUSTOMER message (never an admin's own reply), best-effort
 * fires the owner notification email — mirrors payment-confirmation-service.ts's
 * discipline: email failure never changes the outcome reported to the caller.
 */
export async function sendTicketMessage(ticketId: string, body: string): Promise<SendMessageResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("send_support_message", {
    p_ticket_id: ticketId,
    p_body: body,
  });

  if (error) {
    return translateSendMessageError(error);
  }

  if (!data) {
    return { success: false, error: "unknown", message: "Message could not be sent. Please try again." };
  }

  const message = data as SupportMessage;

  if (message.sender_role === "customer") {
    try {
      const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

      if (ownerEmail) {
        const [{ data: ticket }, { data: authResult }] = await Promise.all([
          supabase.from("support_tickets").select("subject").eq("id", ticketId).maybeSingle(),
          supabase.auth.getUser(),
        ]);

        // sender_role === "customer" means the caller IS the ticket's
        // customer (send_support_message resolves role from ticket
        // ownership), so the currently authenticated user is who to notify about.
        const customerId = authResult?.user?.id;
        const { data: customerProfile } = customerId
          ? await supabase.from("profiles").select("full_name, email").eq("id", customerId).maybeSingle()
          : { data: null };

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        await sendOwnerNewSupportMessageEmail({
          ownerEmail,
          customerName: customerProfile?.full_name ?? "Unknown customer",
          customerEmail: customerProfile?.email ?? "unknown",
          subject: ticket?.subject ?? "Front desk message",
          body: message.body,
          ticketUrl: `${siteUrl}/admin/support/${ticketId}`,
        });
      }
    } catch (err) {
      console.error("support-service: owner notification email failed", err);
    }
  }

  return { success: true, message };
}

export type CloseTicketResult =
  | { success: true; ticket: SupportTicket }
  | { success: false; error: "not_admin" | "invalid_ticket" | "unknown"; message: string };

export async function closeTicket(ticketId: string): Promise<CloseTicketResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("close_support_ticket", { p_ticket_id: ticketId });

  if (error) {
    const text = error.message ?? "";

    if (text.includes("not_admin")) {
      return { success: false, error: "not_admin", message: "Only an admin can close a conversation." };
    }

    if (text.includes("invalid_ticket")) {
      return { success: false, error: "invalid_ticket", message: "This conversation could not be found." };
    }

    return { success: false, error: "unknown", message: "Something went wrong. Please try again." };
  }

  if (!data) {
    return { success: false, error: "unknown", message: "Could not close this conversation." };
  }

  return { success: true, ticket: data as SupportTicket };
}
