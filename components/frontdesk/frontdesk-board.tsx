"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CalendarClock, CheckCircle2, Disc3 } from "lucide-react";

import type { FrontdeskSession } from "@/lib/repositories/frontdesk-repository";
import {
  clockInSession,
  clockOutSession,
  markSessionNoShow,
  type FrontdeskActionResult,
} from "@/lib/services/frontdesk-actions";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
import { useNow } from "@/lib/hooks/use-now";
import { formatKobo } from "@/lib/utils/money";
import { SessionCard, SessionRow } from "@/components/frontdesk/session-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REALTIME_TABLES = [{ table: "session_attendance" }, { table: "bookings" }];

// Lane membership and the "due 12m ago" counters depend on the current time,
// so the board re-renders on a timer. Ten seconds, not one: everything on
// screen is displayed at minute resolution, and this tablet is left open all
// day. The live clock in the header ticks per-second separately — that one
// is a single cheap node, this would re-render every card.
const TICK_MS = 10_000;

type PendingState = { bookingId: string } | null;
type ErrorState = { bookingId: string; message: string } | null;
type ConfirmState = { session: FrontdeskSession } | null;

/**
 * The reception board: every session the desk has to deal with today, split
 * into the four states a receptionist actually thinks in — who's late, who's
 * in, who's coming, who's done.
 *
 * WHY THIS ISN'T FOUR EQUAL COLUMNS
 * A kanban board gives every lane the same width, which reads as "these
 * matter equally". Reception work isn't like that — it's strictly ordered:
 * deal with whoever is late, keep half an eye on the booth, glance at what's
 * next, ignore what's finished. Four equal columns inverted that, because
 * "Done" accumulates every session of the day while "Due now" is usually
 * one card or none, so the archive got the most pixels and the only lane
 * needing action got a quarter width of mostly empty space.
 *
 * So: the two lanes with actions get a wide left column and full cards; the
 * two reference lanes get a narrow right column of one-line rows. The split
 * lands at lg (1024px) rather than the old xl (1280px) because the device
 * this runs on is a tablet — the previous four-column layout only ever
 * appeared on a desktop monitor, and an iPad in landscape fell back to two
 * columns while portrait got a single stack of full-height cards.
 *
 * Every lane's children sit inside AnimatePresence (SessionCard/SessionRow
 * in components/frontdesk/session-card.tsx own their enter/exit motion) — a
 * session moving lane after a clock-in fades out of the old one and into the
 * new one instead of the grid just snapping to its new shape underneath it.
 *
 * Reads its data from the Server Component page and calls router.refresh()
 * after every action rather than keeping a local mutable copy. That matters
 * here more than usual: two staff on two tablets are a normal Saturday, and
 * a local optimistic copy would quietly diverge from whatever the other
 * person just did. Realtime on session_attendance pushes their changes here
 * within a second or so; the poll in useRealtimeRefresh covers a dropped
 * channel on studio wifi.
 */
export function FrontdeskBoard({
  sessions,
  serverNowIso,
}: {
  sessions: FrontdeskSession[];
  serverNowIso: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState>(null);
  const [error, setError] = useState<ErrorState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [, startTransition] = useTransition();

  // useNow is null until mounted, so the server render and the hydrating
  // client render both fall back to the server's own timestamp — identical on
  // both sides, which is what keeps the lane split and the "due 3m ago"
  // counters out of hydration-mismatch territory. The real clock takes over
  // a moment later. See lib/hooks/use-now.ts.
  const liveNow = useNow(TICK_MS);
  const now = liveNow ?? new Date(serverNowIso).getTime();

  useRealtimeRefresh({
    channelName: "frontdesk-board",
    tables: REALTIME_TABLES,
    onRefresh: () => router.refresh(),
  });

  const lanes = useMemo(() => {
    const dueNow: FrontdeskSession[] = [];
    const inProgress: FrontdeskSession[] = [];
    const upcoming: FrontdeskSession[] = [];
    const done: FrontdeskSession[] = [];

    for (const session of sessions) {
      if (session.state === "in_progress") {
        inProgress.push(session);
      } else if (session.state === "completed" || session.state === "no_show") {
        done.push(session);
      } else if (now >= new Date(session.startAtIso).getTime()) {
        dueNow.push(session);
      } else {
        upcoming.push(session);
      }
    }

    return { dueNow, inProgress, upcoming, done };
  }, [sessions, now]);

  /**
   * Every action funnels through here so the pending/error bookkeeping and
   * the post-action refresh exist in exactly one place. `balance_outstanding`
   * is intercepted rather than displayed: it is the server telling us to ask
   * the staff member to confirm, not a failure.
   */
  function runAction(session: FrontdeskSession, action: () => Promise<FrontdeskActionResult>) {
    setPending({ bookingId: session.bookingId });
    setError(null);

    startTransition(async () => {
      const result = await action();

      setPending(null);

      if (!result.success) {
        if (result.code === "balance_outstanding") {
          setConfirm({ session });
          return;
        }

        setError({ bookingId: session.bookingId, message: result.message });

        // A stale board is the most likely cause of already_clocked_in /
        // booking_not_active, so pull fresh data behind the error message —
        // by the time the receptionist has read it, the card is correct.
        if (result.code === "already_clocked_in" || result.code === "already_clocked_out") {
          router.refresh();
        }
        return;
      }

      router.refresh();
    });
  }

  function handleConfirmUnpaid() {
    const session = confirm?.session;
    setConfirm(null);
    if (!session) return;

    runAction(session, () => clockInSession(session.bookingId, true));
  }

  // Split rather than one shared builder: SessionRow genuinely has no
  // clock-out or no-show affordance, and handing it those callbacks anyway
  // would leave the next reader unsure whether the row is supposed to grow
  // them later.
  function commonProps(session: FrontdeskSession) {
    return {
      session,
      now,
      pending: pending?.bookingId === session.bookingId,
      error: error?.bookingId === session.bookingId ? error.message : null,
      onClockIn: () => runAction(session, () => clockInSession(session.bookingId)),
    };
  }

  function cardProps(session: FrontdeskSession) {
    return {
      ...commonProps(session),
      onClockOut: () => runAction(session, () => clockOutSession(session.bookingId)),
      onNoShow: () => runAction(session, () => markSessionNoShow(session.bookingId)),
    };
  }

  const nothingAtAll = sessions.length === 0;

  return (
    <>
      {/* The two-metre read. A receptionist glancing up from a conversation
          has exactly one question — "is anything waiting on me?" — and the
          old layout answered it only by scanning four column headers and
          counting the cards under each. Cascades in once on mount only
          (staggerChildren, keyed by nothing that changes on a refresh) —
          this board is left open all day, not a page that should replay its
          entrance animation every ten seconds. */}
      {/* A clean 2x2 grid below sm (640px) rather than relying on flex-wrap,
          which would split 4 similarly-sized tiles unevenly depending on
          exact label widths. From sm up there's room for all four in a row. */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 border-b border-border bg-card sm:flex sm:flex-wrap"
      >
        <SummaryCell index={0} label="Waiting" count={lanes.dueNow.length} tone="alert" icon={BellRing} />
        <SummaryCell
          index={1}
          label="In the booth"
          count={lanes.inProgress.length}
          tone="live"
          icon={Disc3}
        />
        <SummaryCell
          index={2}
          label="Later today"
          count={lanes.upcoming.length}
          tone="neutral"
          icon={CalendarClock}
        />
        <SummaryCell
          index={3}
          label="Done"
          count={lanes.done.length}
          tone="neutral"
          icon={CheckCircle2}
        />
      </motion.div>

      {nothingAtAll ? (
        <p className="m-5 border border-dashed border-border px-6 py-16 text-center text-base text-muted-foreground sm:m-8">
          Nothing booked today. The board fills itself as sessions are booked.
        </p>
      ) : (
        <div className="grid gap-x-8 gap-y-10 p-5 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: the lanes with buttons on them. */}
          <div className="flex flex-col gap-10">
            <ActionLane
              title="Needs you now"
              count={lanes.dueNow.length}
              icon={BellRing}
              alert
              empty="Nobody waiting."
            >
              <AnimatePresence initial={false}>
                {lanes.dueNow.map((session) => (
                  <SessionCard key={session.bookingId} {...cardProps(session)} />
                ))}
              </AnimatePresence>
            </ActionLane>

            <ActionLane
              title="In the booth"
              count={lanes.inProgress.length}
              icon={Disc3}
              empty="No session running."
            >
              <AnimatePresence initial={false}>
                {lanes.inProgress.map((session) => (
                  <SessionCard key={session.bookingId} {...cardProps(session)} />
                ))}
              </AnimatePresence>
            </ActionLane>
          </div>

          {/* Right: reference only. One line per session. */}
          <div className="flex flex-col gap-10">
            <ReferenceLane
              title="Later today"
              count={lanes.upcoming.length}
              icon={CalendarClock}
              empty="Nothing else booked today."
            >
              <AnimatePresence initial={false}>
                {lanes.upcoming.map((session) => (
                  <SessionRow key={session.bookingId} {...commonProps(session)} />
                ))}
              </AnimatePresence>
            </ReferenceLane>

            <ReferenceLane
              title="Done"
              count={lanes.done.length}
              icon={CheckCircle2}
              empty="Nothing finished yet."
            >
              <AnimatePresence initial={false}>
                {lanes.done.map((session) => (
                  <SessionRow key={session.bookingId} {...commonProps(session)} />
                ))}
              </AnimatePresence>
            </ReferenceLane>
          </div>
        </div>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Balance still outstanding</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-3 text-left">
                <p>
                  {confirm?.session.customerName ?? "This customer"} still owes{" "}
                  <strong className="text-destructive">
                    {confirm ? formatKobo(confirm.session.balanceKobo) : ""}
                  </strong>{" "}
                  on this session.
                </p>
                <p>
                  You can start the session anyway, but it will be recorded against your
                  account with the amount owing.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setConfirm(null)}
              className="min-h-12 border border-border px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleConfirmUnpaid}
              className="min-h-12 bg-[var(--amber-glow)] px-5 text-sm font-medium text-background shadow-[0_8px_24px_-8px_var(--amber-glow)] transition-colors hover:bg-[var(--amber-glow)]/90"
            >
              Clock in anyway
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type LaneIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/**
 * One count in the summary strip. Goes loud only when it is both non-zero and
 * a lane that wants attention — a quiet "0 waiting" is the normal state of a
 * well-run desk and shouldn't look like an alert. The value itself remounts
 * (key={count}) on every change so it plays a small drop-in rather than just
 * flashing to a new digit — enough motion to catch a peripheral glance when
 * a new session becomes due, not enough to be distracting.
 */
function SummaryCell({
  index,
  label,
  count,
  tone,
  icon: Icon,
}: {
  /** Position in the 4-cell strip — drives the border logic for the 2x2 mobile grid vs. the single sm+ row (see the comment below). */
  index: 0 | 1 | 2 | 3;
  label: string;
  count: number;
  tone: "alert" | "live" | "neutral";
  icon: LaneIcon;
}) {
  const lit = count > 0 && tone !== "neutral";

  // The left rule marks "start of a visual row". On the mobile 2x2 grid
  // that's index 0 and 2 (each row's first column); on the sm+ single row
  // it's only index 0. Index 2 therefore needs the rule suppressed on
  // mobile but restored at sm. A bottom rule separates the two mobile rows
  // (index 0/1) and disappears once everything is back on one line.
  const leftRuleClass =
    index === 0
      ? "border-l-0"
      : index === 2
        ? "border-l-0 sm:border-l-[3px]"
        : "border-l-[3px]";
  const bottomRuleClass = index < 2 ? "border-b border-border sm:border-b-0" : "";

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex items-center gap-3 px-4 py-3 sm:min-w-[7.5rem] sm:flex-1 ${leftRuleClass} ${bottomRuleClass} ${
        lit && tone === "alert"
          ? "border-l-destructive bg-destructive/10"
          : lit
            ? "border-l-[var(--amber-glow)] bg-[var(--amber-glow)]/10"
            : "border-l-border"
      }`}
    >
      <Icon
        className={`size-5 shrink-0 ${
          lit && tone === "alert"
            ? "text-destructive"
            : lit
              ? "text-[var(--amber-glow)]"
              : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-0.5">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, position: "absolute" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`font-mono text-3xl leading-none tabular-nums ${
              lit && tone === "alert"
                ? "text-destructive"
                : lit
                  ? "text-[var(--amber-glow)]"
                  : count > 0
                    ? "text-foreground"
                    : "text-muted-foreground"
            }`}
          >
            {count}
          </motion.span>
        </AnimatePresence>
        <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function LaneHeading({
  title,
  count,
  icon: Icon,
  alert,
  large,
}: {
  title: string;
  count: number;
  icon: LaneIcon;
  alert?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border pb-2">
      <Icon
        className={`shrink-0 ${large ? "size-4" : "size-3.5"} ${
          alert && count > 0 ? "text-destructive" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <h2
        className={`font-heading tracking-[0.12em] uppercase ${large ? "text-base" : "text-xs"} ${
          alert && count > 0 ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {title}
      </h2>
      <span className="font-mono text-sm text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function ActionLane({
  title,
  count,
  icon,
  alert,
  empty,
  children,
}: {
  title: string;
  count: number;
  icon: LaneIcon;
  alert?: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <LaneHeading title={title} count={count} icon={icon} alert={alert} large />
      {count === 0 ? (
        <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-4">{children}</div>
      )}
    </section>
  );
}

function ReferenceLane({
  title,
  count,
  icon,
  empty,
  children,
}: {
  title: string;
  count: number;
  icon: LaneIcon;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <LaneHeading title={title} count={count} icon={icon} />
      {count === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </section>
  );
}
