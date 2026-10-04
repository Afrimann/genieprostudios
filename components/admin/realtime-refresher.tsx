"use client";

import { useRouter } from "next/navigation";

import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";

type RealtimeTable = { table: string; schema?: string; filter?: string };

/**
 * Invisible — drops into a Server Component admin page to keep its data
 * fresh without a manual reload. `router.refresh()` re-runs the page's
 * server data fetch in place (no scroll position or client state lost),
 * which is the right primitive for pages that fetch directly in a Server
 * Component. Pages whose data instead lives in a client component's own
 * state (e.g. components/admin/portfolio-manager.tsx) call
 * useRealtimeRefresh() directly with their own refetch function instead of
 * rendering this.
 */
export function RealtimeRefresher({
  channelName,
  tables,
  pollMs,
}: {
  channelName: string;
  tables: RealtimeTable[];
  pollMs?: number;
}) {
  const router = useRouter();

  useRealtimeRefresh({
    channelName,
    tables,
    onRefresh: () => router.refresh(),
    pollMs,
  });

  return null;
}
