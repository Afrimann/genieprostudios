"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateTriumphProjectPaymentStatusAction } from "@/lib/services/triumph-admin-actions";
import {
  TRIUMPH_PAYMENT_STATUSES,
  TRIUMPH_PAYMENT_STATUS_LABELS,
  type TriumphPaymentStatus,
} from "@/lib/validation/triumph-payment";

// Segmented toggle, not a <select> — requested explicitly (2026-10-01),
// mirroring the squared two-segment control language already used by
// components/layout/brand-toggle-bar.tsx. Independent of the work-status
// dropdown in project-update-form.tsx — this is a standalone admin flag,
// not a timeline entry, so it has its own Server Action and RPC
// (update_triumph_project_payment_status, 0024). Text-only segments, no
// per-option icon — the label alone is enough, and matching icons to
// three payment states doesn't add real information.
export function PaymentStatusToggle({
  projectId,
  currentStatus,
}: {
  projectId: string;
  currentStatus: TriumphPaymentStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<TriumphPaymentStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSelect(nextStatus: TriumphPaymentStatus) {
    if (nextStatus === currentStatus || pending) return;

    setErrorMessage(null);
    setPending(nextStatus);

    const result = await updateTriumphProjectPaymentStatusAction({
      projectId,
      paymentStatus: nextStatus,
    });

    setPending(null);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Payment status</span>
      <div className="inline-flex w-fit overflow-hidden border border-border">
        {TRIUMPH_PAYMENT_STATUSES.map((s, index) => {
          const isActive = s === currentStatus;
          const isLast = index === TRIUMPH_PAYMENT_STATUSES.length - 1;

          return (
            <button
              key={s}
              type="button"
              disabled={pending !== null}
              onClick={() => handleSelect(s)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                isLast ? "" : "border-r border-border"
              } ${
                isActive
                  ? "bg-[#22e6c8] text-[#04211c]"
                  : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {pending === s ? "Saving…" : TRIUMPH_PAYMENT_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
