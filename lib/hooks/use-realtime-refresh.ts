"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

type RealtimeTable = { table: string; schema?: string; filter?: string };

const DEFAULT_POLL_MS = 30_000;

/**
 * Realtime is the primary signal here; polling is a silent fallback for the
 * rare case a channel drops without the browser ever firing an error (lost
 * wifi, a server restart, etc.) — same visibilitychange-paused discipline
 * already used for the public tracking page's own poll loop (see
 * components/triumph/project-status-timeline.tsx), just driven by Postgres
 * changes instead of a status endpoint. `onRefresh` is called on every
 * matching postgres_changes event AND on every poll tick — callers decide
 * what "refresh" means (router.refresh() for a Server Component page, or a
 * local refetch function for a client component that manages its own data).
 *
 * `tables` can be a fresh array literal every render — subscription
 * identity is keyed off its serialized content (`tablesKey` below), not
 * object reference. That matters specifically for callers rendered as a
 * Server Component's client child (e.g. RealtimeRefresher): every
 * router.refresh() re-serializes props across the RSC boundary into a brand
 * new array object even when a module-level constant was passed in on the
 * server side, so reference equality would resubscribe the channel (and
 * restart the poll fallback) on every single refresh.
 */
export function useRealtimeRefresh({
  channelName,
  tables,
  onRefresh,
  pollMs = DEFAULT_POLL_MS,
}: {
  channelName: string;
  tables: RealtimeTable[];
  onRefresh: () => void;
  pollMs?: number;
}): void {
  const onRefreshRef = useRef(onRefresh);
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channelName);

    // `tables` (not a ref) is fine to read here: this effect only re-runs
    // when tablesKey's serialized content actually changes, so the `tables`
    // value closed over by this particular effect run is always the one
    // that produced the tablesKey it was keyed on.
    for (const { table, schema = "public", filter } of tables) {
      channel.on(
        "postgres_changes",
        filter ? { event: "*", schema, table, filter } : { event: "*", schema, table },
        () => onRefreshRef.current(),
      );
    }
    channel.subscribe();

    const intervalRef: { current: ReturnType<typeof setInterval> | null } = { current: null };

    function startPolling() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => onRefreshRef.current(), pollMs);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
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
      supabase.removeChannel(channel);
    };
  }, [channelName, pollMs, tablesKey]);
}
