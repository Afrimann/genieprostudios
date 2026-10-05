"use client";

import { useSyncExternalStore } from "react";

// A ticking "now", shared between the front desk header clock and the board's
// lane split / elapsed counters.
//
// WHY useSyncExternalStore RATHER THAN useState + setInterval
// Two problems with the obvious version, both of which this primitive exists
// to solve:
//
//   1. Hydration. `useState(() => Date.now())` evaluates once on the server
//      and again on the client, so a session sitting right on a minute
//      boundary renders "Due 3m ago" in the SSR HTML and "Due 4m ago" on
//      hydration — a mismatch React warns about. getServerSnapshot lets the
//      server and the hydrating client agree on "no live clock yet", and
//      React swaps in the real value immediately after hydration.
//   2. The react-hooks/set-state-in-effect rule. Seeding the first value with
//      a setState in an effect body is exactly the cascading-render pattern
//      that rule exists to catch; a clock is an external system, which is
//      what useSyncExternalStore is for.
//
// Returns null until mounted. Callers either render a placeholder (the header
// clock) or fall back to a server-supplied timestamp (the board), so the
// first paint is never wrong — just not yet live.

type Clock = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => number;
};

// One timer per distinct interval, shared across every component asking for
// it, rather than one per component. getSnapshot must return a referentially
// stable value between ticks or React re-renders forever — hence the cached
// `snapshot` rather than calling Date.now() inside it.
const clocks = new Map<number, Clock>();

function getClock(intervalMs: number): Clock {
  const existing = clocks.get(intervalMs);
  if (existing) return existing;

  let snapshot = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const clock: Clock = {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);

      if (timer === null) {
        // Re-seed on first subscribe: this module may have been evaluated
        // long before anything mounted, which would otherwise leave the
        // first render showing a stale time for up to intervalMs.
        snapshot = Date.now();
        timer = setInterval(() => {
          snapshot = Date.now();
          for (const listener of listeners) listener();
        }, intervalMs);
      }

      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => snapshot,
  };

  clocks.set(intervalMs, clock);
  return clock;
}

const getServerSnapshot = () => null;

/** Current epoch ms, re-rendering every `intervalMs`. Null until mounted — see the note above. */
export function useNow(intervalMs: number): number | null {
  const clock = getClock(intervalMs);

  return useSyncExternalStore<number | null>(
    clock.subscribe,
    clock.getSnapshot,
    getServerSnapshot,
  );
}
