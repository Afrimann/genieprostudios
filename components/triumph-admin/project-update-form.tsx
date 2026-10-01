"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useTriumphAdminUpdate } from "@/lib/hooks/use-triumph-admin-update";
import {
  TRIUMPH_PROJECT_STATUSES,
  TRIUMPH_PROJECT_STATUS_LABELS,
  type TriumphProjectStatus,
} from "@/lib/validation/triumph-update";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// One combined form for a status change, a plain note, and/or a deliverable
// upload — all the same underlying "update" primitive (see
// create_triumph_project_update in 0023_triumph_projects.sql). After a
// successful post, router.refresh() re-fetches the Server Component page
// so the timeline below shows the new entry without a full reload.
//
// "Completed" is special-cased (0026): the RPC itself rejects it unless a
// deliverable has been sent — either attached here or to some earlier
// update for this project (hasDeliverable, computed by the parent page
// from the existing timeline). This client-side check is just a faster,
// friendlier version of that same rule — the RPC remains the actual
// authority if this is ever out of sync (e.g. a stale page).
export function ProjectUpdateForm({
  projectId,
  currentStatus,
  hasDeliverable,
}: {
  projectId: string;
  currentStatus: TriumphProjectStatus;
  hasDeliverable: boolean;
}) {
  const router = useRouter();
  const { status, errorMessage, submit } = useTriumphAdminUpdate(projectId);
  const [body, setBody] = useState("");
  const [statusAfter, setStatusAfter] = useState<TriumphProjectStatus | "">("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status === "uploading" || status === "saving";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    const file = fileInputRef.current?.files?.[0] ?? null;

    if (statusAfter === "completed" && !hasDeliverable && !file) {
      setClientError(
        "This project can't be marked Completed until a deliverable has been sent — attach a file below, or send one first.",
      );
      return;
    }

    const ok = await submit({
      body,
      statusAfter: statusAfter === "" ? null : statusAfter,
      file,
    });

    if (ok) {
      setBody("");
      setStatusAfter("");
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-sm font-medium text-foreground">Post an update</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="statusAfter">Change status (optional)</Label>
        <select
          id="statusAfter"
          value={statusAfter}
          onChange={(e) => {
            setClientError(null);
            setStatusAfter(e.target.value as TriumphProjectStatus | "");
          }}
          className="h-11 rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-[#22e6c8] focus-visible:ring-3 focus-visible:ring-[#22e6c8]/40"
        >
          <option value="">No change ({TRIUMPH_PROJECT_STATUS_LABELS[currentStatus]})</option>
          {TRIUMPH_PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRIUMPH_PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {statusAfter === "completed" && !hasDeliverable && !selectedFileName && (
          <p className="text-xs text-muted-foreground">
            No deliverable has been sent yet — attach one below to mark this project Completed.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Note (optional)</Label>
        <Textarea
          id="body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Started mixing — first draft ready by Friday. Leave blank for a pure status change."
          className="rounded-xl text-sm focus-visible:ring-[#22e6c8]/40 focus-visible:border-[#22e6c8]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">Attach a deliverable (optional, .wav, .mp3, or .mp4)</Label>
        <label
          htmlFor="file"
          className="flex cursor-pointer items-center border border-input px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[#22e6c8] hover:text-foreground"
        >
          {selectedFileName ?? "Choose a file…"}
        </label>
        <input
          id="file"
          type="file"
          accept=".wav,.mp3,.mp4,audio/wav,audio/mpeg,video/mp4"
          ref={fileInputRef}
          onChange={(e) => {
            setClientError(null);
            setSelectedFileName(e.target.files?.[0]?.name ?? null);
          }}
          className="sr-only"
        />
      </div>

      {(clientError ?? errorMessage) && (
        <p className="text-sm text-destructive">{clientError ?? errorMessage}</p>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="mt-1 h-11 w-fit rounded-none bg-[#22e6c8] text-sm font-medium text-background hover:bg-[#1cc9ae]"
      >
        {status === "uploading" ? "Uploading…" : status === "saving" ? "Posting…" : "Post update"}
      </Button>
    </form>
  );
}
