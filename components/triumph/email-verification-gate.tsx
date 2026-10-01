"use client";

import { useState } from "react";

import {
  requestDownloadVerificationCodeAction,
  confirmDownloadVerificationCodeAction,
} from "@/lib/services/triumph-download-verification-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Gates deliverable downloads behind a one-time email code, confirming the
// visitor currently controls the inbox on file — not just that they knew
// the email string (which the base "Find Your Project" lookup already
// required). Rendered once above the timeline whenever an unverified
// visitor has at least one file-bearing update to unlock — see
// project-status-timeline.tsx.
export function EmailVerificationGate({
  projectCode,
  onVerified,
}: {
  projectCode: string;
  onVerified: () => void;
}) {
  const [stage, setStage] = useState<"idle" | "sending" | "sent" | "confirming">("idle");
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendCode() {
    setErrorMessage(null);
    setStage("sending");

    const result = await requestDownloadVerificationCodeAction(projectCode);

    if (!result.success) {
      setErrorMessage(result.message);
      setStage("idle");
      return;
    }

    setStage("sent");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStage("confirming");

    const result = await confirmDownloadVerificationCodeAction(projectCode, code);

    if (!result.success) {
      setErrorMessage(result.message);
      setStage("sent");
      return;
    }

    onVerified();
  }

  if (stage === "idle" || stage === "sending") {
    return (
      <div className="flex flex-col gap-3 border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">Deliverables are ready</p>
          <p className="text-xs text-muted-foreground">Verify your email to unlock downloads.</p>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            onClick={handleSendCode}
            disabled={stage === "sending"}
            className="w-fit shrink-0 rounded-none bg-[#22e6c8] text-sm font-medium text-background hover:bg-[#1cc9ae]"
          >
            {stage === "sending" ? "Sending…" : "Send verification code"}
          </Button>
          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="flex flex-col gap-3 border border-border bg-background p-5">
      <p className="text-sm text-foreground">Enter the 6-digit code we sent to your email.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-11 w-32 rounded-xl text-sm tracking-widest focus-visible:ring-[#22e6c8]/40 focus-visible:border-[#22e6c8]"
        />
        <Button
          type="submit"
          disabled={stage === "confirming" || code.length !== 6}
          className="h-11 rounded-none bg-[#22e6c8] text-sm font-medium text-background hover:bg-[#1cc9ae]"
        >
          {stage === "confirming" ? "Checking…" : "Confirm"}
        </Button>
      </div>
      <button
        type="button"
        onClick={handleSendCode}
        className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Resend code
      </button>
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </form>
  );
}
