"use client";

import { useState } from "react";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  RECEIPT_MAX_FILE_SIZE_BYTES,
  RECEIPT_MAX_FILE_SIZE_LABEL,
  RECEIPT_ALLOWED_MIME_TYPES,
  type MoneyPaymentStatus,
} from "@/lib/validation/triumph-payment";
import { recordTriumphPaymentAction } from "@/lib/services/triumph-admin-actions";

// Direct-to-storage upload for the optional receipt attachment, same
// discipline as use-triumph-admin-update.ts's deliverable upload (60s
// timeout safety net, same withTimeout shape) — just a smaller size cap and
// a different bucket/mime allowlist, since a receipt is a photo or PDF, not
// audio.

const UPLOAD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("upload_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isAllowedReceiptFile(file: File): boolean {
  return RECEIPT_ALLOWED_MIME_TYPES.has(file.type) || /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export type RecordPaymentStatus = "idle" | "uploading" | "saving" | "error" | "success";

export function useTriumphPaymentRecord(projectId: string) {
  const [status, setStatus] = useState<RecordPaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(params: {
    paymentStatus: MoneyPaymentStatus;
    amountNaira: number;
    confirmationCode: string;
    receiptFile: File | null;
  }): Promise<boolean> {
    setErrorMessage(null);

    let receiptPath: string | null = null;
    let receiptName: string | null = null;

    if (params.receiptFile) {
      if (!isAllowedReceiptFile(params.receiptFile)) {
        setStatus("error");
        setErrorMessage("Only .jpg, .png, .webp, or .pdf receipts are accepted.");
        return false;
      }

      if (params.receiptFile.size > RECEIPT_MAX_FILE_SIZE_BYTES) {
        setStatus("error");
        setErrorMessage(`Receipt is too large (max ${RECEIPT_MAX_FILE_SIZE_LABEL}).`);
        return false;
      }

      setStatus("uploading");
      const supabase = createBrowserClient();
      const path = `${projectId}/${Date.now()}-${sanitizeFileName(params.receiptFile.name)}`;

      let uploadError;
      try {
        const result = await withTimeout(
          supabase.storage.from("triumph-receipts").upload(path, params.receiptFile, { upsert: true }),
          UPLOAD_TIMEOUT_MS,
        );
        uploadError = result.error;
      } catch {
        setStatus("error");
        setErrorMessage("Upload timed out — check your connection and try again.");
        return false;
      }

      if (uploadError) {
        // Logged, not shown — the generic message avoids leaking storage
        // internals in the UI, but "please try again" alone is useless for
        // diagnosing a real cause (e.g. the triumph-receipts bucket not
        // existing yet because 0029_triumph_payments.sql hasn't been
        // applied). Check the browser console for the actual message.
        console.error("useTriumphPaymentRecord: receipt upload failed", uploadError);
        setStatus("error");
        setErrorMessage("Receipt upload failed — please try again.");
        return false;
      }

      receiptPath = path;
      receiptName = params.receiptFile.name;
    }

    setStatus("saving");

    const result = await recordTriumphPaymentAction({
      projectId,
      paymentStatus: params.paymentStatus,
      amountNaira: params.amountNaira,
      confirmationCode: params.confirmationCode,
      receiptPath,
      receiptName,
    });

    if (!result.success) {
      setStatus("error");
      setErrorMessage(result.message);
      return false;
    }

    setStatus("success");
    return true;
  }

  function reset() {
    setStatus("idle");
    setErrorMessage(null);
  }

  return { status, errorMessage, submit, reset };
}
