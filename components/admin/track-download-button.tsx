"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { getTrackDownloadUrlAction } from "@/lib/services/admin-booking-actions";
import { Button } from "@/components/ui/button";

/**
 * Generates a short-lived signed URL (getTrackDownloadUrl,
 * booking-tracks-repository.ts) on click and opens it — done on demand
 * rather than at page-load time since the URL only stays valid for 60
 * seconds (see createSignedUrl's ttl there).
 */
export function TrackDownloadButton({ filePath }: { filePath: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    const result = await getTrackDownloadUrlAction(filePath);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleDownload}>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-3.5" aria-hidden="true" />
        )}
        Download
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
