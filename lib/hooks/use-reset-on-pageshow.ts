"use client";

import { useEffect, useRef } from "react";

/**
 * Fixes a real bug hit during a Paystack checkout: a "Redirecting…" submit
 * button sets local `submitting` state, then navigates away via
 * `window.location.href = authorizationUrl`. If the customer closes
 * Paystack's tab/taps back instead of completing payment, some browsers
 * restore the page from the back/forward cache (bfcache) rather than doing
 * a fresh reload — which means React's in-memory state is frozen exactly as
 * it was at navigation time, so `submitting` is still `true` and the button
 * stays permanently disabled with no way to retry.
 *
 * `pageshow`'s `event.persisted` flag is true precisely when a page was
 * restored from bfcache (never fires on a normal first load, where a fresh
 * component mount already starts with clean state anyway) — calling
 * `reset()` there clears whatever local submitting/error state the caller
 * owns. Uses a ref so callers can pass an inline closure every render
 * without re-subscribing the listener each time.
 */
export function useResetOnPageShow(reset: () => void): void {
  const resetRef = useRef(reset);

  useEffect(() => {
    resetRef.current = reset;
  });

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        resetRef.current();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
}
