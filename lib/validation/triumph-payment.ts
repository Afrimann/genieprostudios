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

// Subset of TRIUMPH_PAYMENT_STATUSES that represent an actual money event —
// 'pending' is excluded on purpose, see 0029_triumph_payments.sql's own
// check constraint (triumph_payments_status_is_a_money_event). Only these
// two targets go through the gated record-payment modal.
export const MONEY_PAYMENT_STATUSES = ["deposit_paid", "paid_in_full"] as const;

export type MoneyPaymentStatus = (typeof MONEY_PAYMENT_STATUSES)[number];

// Receipt attachments are a photo of a bank slip or a PDF receipt, not
// audio — small files, so a tighter cap than addon-songs.ts's 50MB deliverable
// limit (MAX_FILE_SIZE_BYTES there) makes more sense here.
export const RECEIPT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MAX_FILE_SIZE_LABEL = "10MB";
export const RECEIPT_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * Input for recordTriumphPaymentAction — the gated path behind the modal.
 * confirmationCode is checked server-side against TRIUMPH_PAYMENT_CONFIRMATION_CODE
 * (see triumph-admin-actions.ts); Zod only checks it's present and a
 * plausible shape, never the actual value — that check must happen with
 * crypto.timingSafeEqual, not inside a schema.
 */
export const recordTriumphPaymentSchema = z.object({
  projectId: z.string().uuid(),
  paymentStatus: z.enum(MONEY_PAYMENT_STATUSES),
  amountNaira: z.number().positive("Enter the amount received."),
  confirmationCode: z
    .string()
    .trim()
    .min(1, "Enter the confirmation code."),
  receiptPath: z.string().nullable(),
  receiptName: z.string().nullable(),
});

export type RecordTriumphPaymentInput = z.infer<typeof recordTriumphPaymentSchema>;
