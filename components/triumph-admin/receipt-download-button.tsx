"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { getTriumphReceiptDownloadUrlAction } from "@/lib/services/triumph-admin-actions";

/**
 * Mirrors components/admin/track-download-button.tsx — a fresh signed URL
 * per click, since the link only stays valid for 60 seconds. Shows a fixed
 * "Receipt" label rather than the real file name — receipts are often named
 * after a long bank transaction reference (e.g. "Transaction
 * #28541641195519783-....pdf"), which broke the revenue table's row layout
 * when rendered inline. The real name is still there as a title tooltip.
 */
export function ReceiptDownloadButton({ filePath, fileName }: { filePath: string; fileName: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    const result = await getTriumphReceiptDownloadUrlAction(filePath);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={handleDownload}
        title={fileName ?? undefined}
        className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#22e6c8] underline-offset-4 hover:underline disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-3" aria-hidden="true" />
        )}
        Receipt
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
