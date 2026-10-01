import { z } from "zod";

// Mirrors public.triumph_payment_status (0024_triumph_payment_status.sql).
// Separate from triumph-update.ts's work-status enum — payment status is a
// standalone admin-set flag, not a timeline entry.
export const TRIUMPH_PAYMENT_STATUSES = ["pending", "deposit_paid", "paid_in_full"] as const;

export type TriumphPaymentStatus = (typeof TRIUMPH_PAYMENT_STATUSES)[number];

export const TRIUMPH_PAYMENT_STATUS_LABELS: Record<TriumphPaymentStatus, string> = {
  pending: "Payment Pending",
  deposit_paid: "Deposit Paid",
  paid_in_full: "Fully Paid",
};

export const triumphPaymentStatusUpdateSchema = z.object({
  projectId: z.string().uuid(),
  paymentStatus: z.enum(TRIUMPH_PAYMENT_STATUSES),
});

export type TriumphPaymentStatusUpdateInput = z.infer<typeof triumphPaymentStatusUpdateSchema>;
