"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Lock, RefreshCw } from "lucide-react";

import { TRIUMPH_PROJECT_STATUS_LABELS, type TriumphProjectStatus } from "@/lib/validation/triumph-update";
import { TRIUMPH_PAYMENT_STATUS_LABELS, type TriumphPaymentStatus } from "@/lib/validation/triumph-payment";
import { EmailVerificationGate } from "@/components/triumph/email-verification-gate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Approximates "real time" with polling rather than Supabase Realtime —
// Realtime needs an RLS policy that grants the subscriber's role SELECT on
// the table, and this table deliberately has no anon-reachable policy at
// all (see 0023_triumph_projects.sql). Polling while the tab is visible,
// paused on visibilitychange, is the right trade-off for a status page
// with no sub-30-second urgency.
const POLL_INTERVAL_MS = 25_000;

// Ordered work-progress steps for the stepper below — deliberately excludes
// "cancelled", which isn't a step along this path but a separate terminal
// state rendered as its own banner.
const PROGRESS_STEPS: TriumphProjectStatus[] = ["new", "in_progress", "review", "completed"];

export type TimelineUpdate = {
  id: string;
  body: string;
  statusAfter: TriumphProjectStatus | null;
  fileName: string | null;
  createdAt: string;
};

type StatusResponse = {
  status: TriumphProjectStatus;
  paymentStatus: TriumphPaymentStatus;
  verified: boolean;
  updates: TimelineUpdate[];
};

export function ProjectStatusTimeline({
  projectCode,
  initialStatus,
  initialPaymentStatus,
  initialVerified,
  initialUpdates,
}: {
  projectCode: string;
  initialStatus: TriumphProjectStatus;
  initialPaymentStatus: TriumphPaymentStatus;
  initialVerified: boolean;
  initialUpdates: TimelineUpdate[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [verified, setVerified] = useState(initialVerified);
  const [updates, setUpdates] = useState(initialUpdates);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shared by the poll tick and the manual refresh button below — one fetch
  // path, not two copies of the same request/parse logic.
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/triumph/track/${projectCode}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      setPaymentStatus(data.paymentStatus);
      // Only ever moves false -> true here; the "verified" action itself
      // already flips local state immediately (see onVerified below) —
      // this just keeps a second tab/reload in sync.
      setVerified((prev) => prev || data.verified);
      setUpdates(data.updates);
    } catch {
      // Silent — a background refresh failing isn't a user-facing error;
      // the next tick (or a manual retry) just tries again.
    }
  }, [projectCode]);

  useEffect(() => {
    function startPolling() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchStatus();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStatus]);

  async function handleManualRefresh() {
    setIsRefreshing(true);
    await fetchStatus();
    setIsRefreshing(false);
  }

  const hasDeliverable = updates.some((update) => update.fileName);
  const stepIndex = PROGRESS_STEPS.indexOf(status);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              aria-label="Refresh status"
              className="flex size-8 items-center justify-center rounded-none border border-border text-muted-foreground transition-colors hover:border-[#22e6c8] hover:text-[#22e6c8] disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Status + payment summary */}
      <div className="flex flex-col divide-y divide-border border border-border sm:flex-row sm:divide-x sm:divide-y-0">
        <div className="flex flex-1 items-center justify-between gap-3 p-4">
          <span className="text-xs text-muted-foreground">Project status</span>
          <span className="text-sm font-medium text-[#22e6c8]">{TRIUMPH_PROJECT_STATUS_LABELS[status]}</span>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 p-4">
          <span className="text-xs text-muted-foreground">Payment</span>
          <span className="text-sm font-medium text-[#22e6c8]">
            {TRIUMPH_PAYMENT_STATUS_LABELS[paymentStatus]}
          </span>
        </div>
      </div>

      {/* Progress stepper */}
      {status === "cancelled" ? (
        <div className="border border-destructive/30 p-4">
          <p className="text-sm text-foreground">This project has been cancelled.</p>
        </div>
      ) : (
        <ol className="flex items-center">
          {PROGRESS_STEPS.map((step, i) => {
            const reached = i <= stepIndex;
            const isLast = i === PROGRESS_STEPS.length - 1;
            return (
              <li key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`size-2 rounded-full transition-colors ${
                      reached ? "bg-[#22e6c8]" : "bg-border"
                    }`}
                  />
                  <span
                    className={`hidden text-center text-[10px] tracking-wide uppercase sm:block ${
                      reached ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {TRIUMPH_PROJECT_STATUS_LABELS[step]}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={`mx-2 h-px flex-1 transition-colors ${
                      i < stepIndex ? "bg-[#22e6c8]" : "bg-border"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {hasDeliverable && !verified && (
        <EmailVerificationGate projectCode={projectCode} onVerified={() => setVerified(true)} />
      )}

      {/* Timeline */}
      {updates.length === 0 ? (
        <p className="border border-border p-6 text-sm text-muted-foreground">
          We&apos;ve received your project. We&apos;ll post updates here as work begins.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-5">
          <div className="absolute top-1 bottom-1 left-[3px] w-px bg-border" aria-hidden="true" />
          {updates.map((update) => (
            <li key={update.id} className="relative flex gap-4 pl-7">
              <span className="absolute top-1.5 left-0 size-[7px] rounded-full bg-[#22e6c8]" aria-hidden="true" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(update.createdAt).toLocaleString()}</span>
                  {update.statusAfter && (
                    <>
                      <span className="text-border">·</span>
                      <span className="font-medium text-foreground">
                        {TRIUMPH_PROJECT_STATUS_LABELS[update.statusAfter]}
                      </span>
                    </>
                  )}
                </div>
                {update.body && <p className="mt-1.5 text-sm text-foreground">{update.body}</p>}
                {update.fileName && verified && (
                  <a
                    href={`/triumph/track/${projectCode}/download/${update.id}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#22e6c8] underline-offset-4 hover:underline"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Download {update.fileName}
                  </a>
                )}
                {update.fileName && !verified && (
                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden="true" />
                    {update.fileName} — verify your email above to download
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
