"use client";

import { useRef, useState } from "react";

import { useTriumphPaymentRecord } from "@/lib/hooks/use-triumph-payment-record";
import { TRIUMPH_PAYMENT_STATUS_LABELS, type MoneyPaymentStatus } from "@/lib/validation/triumph-payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Live thousands-separator formatting for the amount field — ₦200000
// reads as ₦200,000 while typing, not just on submit. Keeps the raw digits
// as the source of truth (parseAmountInput below) and reformats on every
// keystroke; a trailing "." or trailing zeros after it are preserved as
// typed so "200000.5" doesn't get mangled mid-entry into "200000.50" before
// the admin has finished typing the second digit.
function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");
  const integerPart = firstDotIndex === -1 ? cleaned : cleaned.slice(0, firstDotIndex);
  const decimalPart = firstDotIndex === -1 ? "" : cleaned.slice(firstDotIndex + 1, firstDotIndex + 3);

  const integerFormatted = integerPart === "" ? "" : Number(integerPart).toLocaleString("en-NG");

  if (firstDotIndex === -1) return integerFormatted;
  return `${integerFormatted}.${decimalPart}`;
}

function parseAmountInput(formatted: string): number {
  return Number(formatted.replace(/,/g, ""));
}

// Gated path for moving payment_status to deposit_paid/paid_in_full
// (2026-10-03 client request) — a confirmation code (team-known PIN, see
// triumph-admin-actions.ts's isCorrectConfirmationCode) plus an amount and
// optional receipt, so an account being logged in isn't by itself enough to
// mark money as received. Reverting to "Payment Pending" skips this modal
// entirely (see payment-status-toggle.tsx) — that's not a money event.
export function RecordPaymentModal({
  open,
  projectId,
  targetStatus,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  projectId: string;
  targetStatus: MoneyPaymentStatus | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}) {
  const { status, errorMessage, submit, reset } = useTriumphPaymentRecord(projectId);
  const [amount, setAmount] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status === "uploading" || status === "saving";

  function handleOpenChange(next: boolean) {
    if (busy) return; // Never let a close happen mid-submit.
    if (!next) {
      setAmount("");
      setConfirmationCode("");
      setReceiptFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      reset();
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStatus) return;

    const amountNaira = parseAmountInput(amount);
    const ok = await submit({
      paymentStatus: targetStatus,
      amountNaira,
      confirmationCode,
      receiptFile: fileInputRef.current?.files?.[0] ?? null,
    });

    if (ok) {
      handleOpenChange(false);
      onRecorded();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              Confirm: {targetStatus ? TRIUMPH_PAYMENT_STATUS_LABELS[targetStatus] : ""}
            </DialogTitle>
            <DialogDescription>
              Recording a payment requires the team confirmation code — this prevents the status from being
              changed by anyone who only has account access.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount received (₦)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              placeholder="e.g. 150,000"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receipt">Receipt (optional, .jpg, .png, .webp, or .pdf)</Label>
            <label
              htmlFor="receipt"
              className="flex cursor-pointer items-center border border-input px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[#22e6c8] hover:text-foreground"
            >
              {receiptFileName ?? "Choose a file…"}
            </label>
            <input
              id="receipt"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              ref={fileInputRef}
              onChange={(e) => setReceiptFileName(e.target.files?.[0]?.name ?? null)}
              className="sr-only"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmationCode">Confirmation code</Label>
            <Input
              id="confirmationCode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="Team code"
            />
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="rounded-none bg-[#22e6c8] text-background hover:bg-[#1cc9ae]"
            >
              {status === "uploading" ? "Uploading…" : status === "saving" ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
