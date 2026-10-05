"use client";

import { motion } from "framer-motion";
import { ConciergeBell, LogOut } from "lucide-react";

import { signOut } from "@/lib/services/auth-service";
import { useNow } from "@/lib/hooks/use-now";

/**
 * Chrome for /frontdesk. Deliberately much lighter than AdminShell: there is
 * no nav, because there is exactly one screen. A receptionist mid-shift with
 * a customer standing in front of them should not be able to get lost, and
 * every link that isn't the board is a way to get lost.
 *
 * Built for a tablet propped at reception: the Lagos clock is the largest
 * thing in the header because staff cross-check it against the session times
 * all day, generous tap targets, and no hover-dependent affordances. A faint
 * grain sits on the header only (bg-grain, same texture as the public site
 * and the two login screens) — enough to keep the one piece of chrome this
 * surface has from reading as a flat system bar, without putting it under
 * the board itself where it would compete with the cards all day.
 */
export function FrontdeskShell({
  staffEmail,
  children,
}: {
  staffEmail: string;
  children: React.ReactNode;
}) {
  async function handleSignOut() {
    await signOut("/frontdesk/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-grain sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-4 border-b border-[var(--amber-glow)]/15 bg-card px-5 py-4 sm:px-8">
        <div className="relative z-[1] flex items-center gap-2.5">
          <ConciergeBell className="size-6 shrink-0 text-[var(--amber-glow)]" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-heading text-base leading-none font-medium text-foreground">
              Front Desk
            </span>
            <span className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Genie Pro Studios
            </span>
          </div>
        </div>

        {/* order-3 + basis-full drops the clock to its own full-width row
            below logo/sign-out on a phone, where the three together don't
            fit one line — sm:order-none/basis-auto restores it to its
            natural spot between them on tablet and up. */}
        <div className="relative z-[1] order-3 basis-full sm:order-none sm:basis-auto">
          <LagosClock />
        </div>

        <div className="relative z-[1] ml-auto flex items-center gap-2 sm:gap-4">
          <span
            className="hidden max-w-[18ch] truncate text-xs text-muted-foreground sm:inline"
            title={staffEmail}
          >
            {staffEmail}
          </span>
          <form action={handleSignOut}>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              type="submit"
              aria-label="Sign out"
              className="flex min-h-11 items-center gap-2 border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-[var(--amber-glow)]/40 hover:bg-secondary hover:text-foreground sm:px-3"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </motion.button>
          </form>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

/**
 * Lagos wall-clock time and date, ticking. Pinned to Africa/Lagos rather than
 * the device clock on purpose: the session times on the board are Lagos times,
 * so a tablet with a misconfigured timezone would otherwise display a clock
 * that silently disagrees with every card next to it.
 *
 * Renders nothing until mounted — the server has no business rendering a wall
 * clock that would be stale by hydration and would mismatch anyway.
 */
function LagosClock() {
  const now = useNow(1_000);

  // Fixed-width placeholder so the header doesn't reflow once the clock starts
  // after hydration. See lib/hooks/use-now.ts. The date line is part of the
  // reserved box too, hence the explicit height rather than just a width.
  if (now === null) {
    return (
      <span
        className="mt-2 inline-block h-[2.4rem] w-[8ch] border-t border-border pt-2 sm:mt-0 sm:h-[2.85rem] sm:w-[8.5ch] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5"
        aria-hidden="true"
      />
    );
  }

  const date = new Date(now);
  // Split on the colons so they can blink independently of the digits — a
  // small, deliberately old-fashioned digital-clock detail that also does
  // real work: a blinking separator is the fastest way to tell at a glance
  // that this clock is live, not a frozen screenshot of one.
  const [hh, mm, ss] = date
    .toLocaleTimeString("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .split(":");

  return (
    <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2 sm:mt-0 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
      <span className="font-mono text-2xl leading-none tabular-nums text-foreground sm:text-3xl">
        {hh}
        <span className="animate-opacity-pulse text-[var(--amber-glow)]" style={{ animationDuration: "1s" }}>
          :
        </span>
        {mm}
        <span className="animate-opacity-pulse text-[var(--amber-glow)]" style={{ animationDuration: "1s" }}>
          :
        </span>
        {ss}
      </span>
      {/* The date was missing entirely before. It matters for the session that
          started at 22:00 and is still running after midnight — the board tags
          that card "Yesterday", which only means anything if the desk can see
          what today is. */}
      <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {date.toLocaleDateString("en-GB", {
          timeZone: "Africa/Lagos",
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </span>
    </div>
  );
}
