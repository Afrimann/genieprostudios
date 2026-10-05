"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, LogIn, LogOut, Phone, UserX } from "lucide-react";

import type { FrontdeskSession } from "@/lib/repositories/frontdesk-repository";
import { formatDuration, toDisplayTime } from "@/lib/utils/lagos-time";
import { formatKobo } from "@/lib/utils/money";

// Two presentations of the same session, because the board asks two different
// questions of it:
//
//   SessionCard — "deal with this person now". Wide, name-led, with a full
//   action row. Used for the two lanes the desk acts on.
//   SessionRow  — "this exists, don't forget it". One dense line. Used for
//   the reference lanes, where a stack of full cards would bury the lanes
//   that actually need attention.
//
// Both derive their state label from the same sessionStatus() below, so the
// compact row and the full card can never disagree about a session. Both are
// motion components (motion.article / motion.li) so frontdesk-board.tsx can
// wrap their lane lists in AnimatePresence — a session moving from "Needs you
// now" to "In the booth" after a clock-in fades out of one lane and into the
// other instead of the list just snapping to a new shape underneath it.

export type SessionTone = "alert" | "live" | "neutral" | "done";

/**
 * The single "where is this session right now" label. Order matters: a
 * clocked-out session is finished regardless of the clock, and an overrunning
 * session is more urgent than a running one.
 */
export function sessionStatus(
  session: FrontdeskSession,
  now: number,
): { label: string; tone: SessionTone } {
  const startAt = new Date(session.startAtIso).getTime();
  const endAt = new Date(session.endAtIso).getTime();

  if (session.state === "completed") {
    return { label: "Completed", tone: "done" };
  }

  if (session.state === "no_show") {
    return { label: "No show", tone: "alert" };
  }

  if (session.state === "in_progress") {
    if (now > endAt) {
      return { label: `Over by ${formatDuration(now - endAt)}`, tone: "alert" };
    }

    // Elapsed is measured from the actual clock-in, not the scheduled start —
    // a customer who arrived 40 minutes late has not been in the booth for
    // 40 minutes, and the desk needs the real figure.
    const clockedInAt = session.clockedInAtIso
      ? new Date(session.clockedInAtIso).getTime()
      : null;

    return {
      label: `Running ${formatDuration(clockedInAt === null ? 0 : now - clockedInAt)}`,
      tone: "live",
    };
  }

  if (now >= startAt) {
    return { label: `Due ${formatDuration(now - startAt)} ago`, tone: "alert" };
  }

  return { label: `In ${formatDuration(startAt - now)}`, tone: "neutral" };
}

// A 3px bar down the left edge of every card and row carries the state
// colour instead of tinting the whole surface — at a desk the board is read
// peripherally, and an edge marker stays legible from across the room
// without several different card fills fighting each other up close.
// "neutral" (an upcoming session, not yet due) gets the brand's violet
// rather than plain grey — this is the one place in the UI two accent
// colors ever appear side by side, so it has to earn it: amber reads as
// "this needs you", violet reads as "this is just information", and a
// receptionist learns that split in about one shift.
const ACCENT: Record<SessionTone, string> = {
  alert: "bg-destructive",
  live: "bg-[var(--amber-glow)]",
  neutral: "bg-[var(--moss)]",
  done: "bg-border",
};

const CHIP: Record<SessionTone, string> = {
  alert: "bg-destructive/15 text-destructive",
  live: "bg-[var(--amber-glow)]/15 text-[var(--amber-glow)]",
  neutral: "bg-[var(--moss)]/15 text-[var(--moss)]",
  done: "bg-secondary text-muted-foreground",
};

// Tactile press feedback shared by every button on the board — a tablet has
// no hover state to lean on, so the "did that register" signal has to live
// entirely in the press itself. Lift on hover (mouse/trackpad testing),
// compress on tap (the actual on-device interaction), spring rather than a
// linear tween so it reads as a physical button rather than a fade.
const PRESS = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.95, y: 0 },
  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
};

// Touch targets sized for a tablet at a reception desk, not a mouse. The
// shared Button's largest size is h-9, which is fine in the admin area but too
// small to hit reliably while holding a conversation — hence the bespoke
// classes here rather than <Button size="lg">.
const ACTION_BASE =
  "flex items-center justify-center gap-2 px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

const PRIMARY_ACTION = `${ACTION_BASE} min-h-14 flex-1 basis-40 bg-[var(--amber-glow)] text-background shadow-[0_8px_24px_-8px_var(--amber-glow)] hover:bg-[var(--amber-glow)]/90 hover:shadow-[0_12px_32px_-6px_var(--amber-glow)]`;
const SECONDARY_ACTION = `${ACTION_BASE} min-h-14 border border-border bg-background text-muted-foreground hover:border-[var(--amber-glow)]/40 hover:bg-secondary hover:text-foreground`;
// Reference lanes still need their one action (an early arrival clocking in, a
// no-show who turned up) — just not at full card weight. Still 44px, the
// smallest target that survives a fingertip.
const ROW_ACTION = `${ACTION_BASE} min-h-11 shrink-0 border border-border bg-background px-3 text-sm text-foreground hover:border-[var(--amber-glow)]/40 hover:bg-secondary`;

function CarriedOverTag() {
  return (
    // isCarriedOver only survives getFrontdeskBoard's filter while a session
    // is still in progress, i.e. the 22:00–02:00 case. Without this the card
    // reads "22:00 → 02:00" at 1am with nothing saying it began yesterday.
    <span className="border border-border px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
      Yesterday
    </span>
  );
}

function BalanceWarning({ amountKobo }: { amountKobo: number }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-destructive">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      {formatKobo(amountKobo)} outstanding
    </p>
  );
}

function ActionError({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {message}
    </motion.p>
  );
}

/** A small breathing dot for a state that is currently live — the one piece of real motion that should never stop while it's true. */
function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--amber-glow)] opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-[var(--amber-glow)]" />
    </span>
  );
}

interface SessionActionProps {
  /** Ticking clock from the board, so every card agrees on "now". */
  now: number;
  pending: boolean;
  error: string | null;
  onClockIn: () => void;
  onClockOut: () => void;
  onNoShow: () => void;
}

/**
 * Full-weight card for the lanes the desk acts on. Two zones separated by a
 * rule — read the top, press the bottom — with the customer's name as the
 * largest element on it. That ordering is deliberate: the receptionist's task
 * is matching a human standing in front of them to a row, which is a
 * name-matching task, not a time-matching one.
 */
export function SessionCard({
  session,
  now,
  pending,
  error,
  onClockIn,
  onClockOut,
  onNoShow,
}: { session: FrontdeskSession } & SessionActionProps) {
  const status = sessionStatus(session, now);
  const startAt = new Date(session.startAtIso).getTime();
  const endAt = new Date(session.endAtIso).getTime();
  const isOverdue = session.state === "awaiting" && now >= startAt;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative overflow-hidden border bg-card shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] ${
        status.tone === "alert"
          ? "border-destructive/30"
          : status.tone === "live"
            ? "border-[var(--amber-glow)]/30"
            : "border-border"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT[status.tone]}`}
      />

      <div className="flex flex-col gap-3 p-4 pl-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl tabular-nums text-foreground">
              {toDisplayTime(session.sessionStartTime)}
            </span>
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              →
            </span>
            <span className="font-mono text-xl tabular-nums text-foreground">
              {toDisplayTime(session.sessionEndTime)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(endAt - startAt)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {session.isCarriedOver && <CarriedOverTag />}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium tabular-nums ${CHIP[status.tone]}`}
            >
              {status.tone === "live" && <LiveDot />}
              {status.label}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-2xl leading-tight font-medium text-foreground">
            {session.customerName ?? "Unknown customer"}
          </h3>
          <p className="text-sm text-muted-foreground">{session.serviceLabel}</p>
        </div>

        {session.balanceKobo > 0 && session.state !== "completed" && (
          <BalanceWarning amountKobo={session.balanceKobo} />
        )}

        {/* The frozen balance from clock-in, shown only once the live balance
            has since been settled — otherwise the line above already says it
            and repeating it twice on one card is just noise. */}
        {session.clockInBalanceKobo !== null &&
          session.clockInBalanceKobo > 0 &&
          session.balanceKobo === 0 && (
            <p className="text-xs text-muted-foreground">
              Clocked in with {formatKobo(session.clockInBalanceKobo)} owing (since paid).
            </p>
          )}

        {error && <ActionError message={error} />}
      </div>

      {/* Action zone. The phone number lives here rather than as body text:
          for a late customer, ringing them IS the action the desk takes, so it
          belongs beside the other actions at the same tap size. The primary
          button is flex-1 so it is always the largest target on the card, and
          wraps to its own full-width row when the column is narrow. */}
      <div className="flex flex-wrap gap-2 border-t border-border bg-background/40 p-3 pl-4">
        {session.customerPhone && (
          <motion.a
            {...PRESS}
            href={`tel:${session.customerPhone}`}
            className={SECONDARY_ACTION}
            aria-label={`Call ${session.customerName ?? "customer"} on ${session.customerPhone}`}
          >
            <Phone className="size-5" aria-hidden="true" />
            Call
          </motion.a>
        )}

        {/* No-show is only offered once the session is actually late —
            frontdesk_mark_no_show() rejects it before then anyway, and a
            button that always errors is worse than no button. */}
        {isOverdue && (
          <motion.button
            {...PRESS}
            type="button"
            className={SECONDARY_ACTION}
            onClick={onNoShow}
            disabled={pending}
          >
            <UserX className="size-5" aria-hidden="true" />
            No show
          </motion.button>
        )}

        {session.state === "in_progress" ? (
          <motion.button
            {...PRESS}
            type="button"
            className={PRIMARY_ACTION}
            onClick={onClockOut}
            disabled={pending}
          >
            <LogOut className="size-5" aria-hidden="true" />
            Clock out
          </motion.button>
        ) : (
          <motion.button
            {...PRESS}
            type="button"
            className={PRIMARY_ACTION}
            onClick={onClockIn}
            disabled={pending}
          >
            <LogIn className="size-5" aria-hidden="true" />
            Clock in
          </motion.button>
        )}
      </div>
    </motion.article>
  );
}

/**
 * One-line presentation for the reference lanes. Costs roughly a fifth of the
 * vertical space of a full card, which is the whole point: "Done" accumulates
 * every finished session in the day and must not be able to push the lane that
 * needs attention off the screen.
 */
export function SessionRow({
  session,
  now,
  pending,
  error,
  onClockIn,
}: { session: FrontdeskSession } & Pick<
  SessionActionProps,
  "now" | "pending" | "error" | "onClockIn"
>) {
  const status = sessionStatus(session, now);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="border-b border-border last:border-b-0"
    >
      {/* flex-wrap, with the status+action group below forced onto its own
          line on a phone (basis-full) and folded back into this same row on
          tablet/desktop (sm:contents, which drops the wrapper's own box so
          its children rejoin this flex row exactly as before). A phone-width
          single line had the status text and button fighting the name for
          space, which is the one real layout problem a narrow screen adds
          here — everything else in this row already truncates cleanly. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pr-3">
        <span aria-hidden="true" className={`h-9 w-[3px] shrink-0 ${ACCENT[status.tone]}`} />

        <span className="shrink-0 font-mono text-base tabular-nums text-foreground">
          {toDisplayTime(session.sessionStartTime)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            {session.state === "completed" && (
              <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {session.customerName ?? "Unknown customer"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session.serviceLabel}
            {session.balanceKobo > 0 && session.state !== "completed" && (
              <span className="text-destructive">
                {" · "}
                {formatKobo(session.balanceKobo)} owing
              </span>
            )}
          </p>
        </div>

        <div className="flex basis-full items-center justify-between gap-3 pl-4 sm:contents sm:pl-0">
          <span
            className={`shrink-0 text-xs tabular-nums ${
              status.tone === "alert" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {status.label}
          </span>

          {/* An early arrival still has to be clockable from here, and a
              no-show is reversible by design — see frontdesk_clock_in(),
              which clears no_show_at on the way through. */}
          {(session.state === "awaiting" || session.state === "no_show") && (
            <motion.button
              {...PRESS}
              type="button"
              className={ROW_ACTION}
              onClick={onClockIn}
              disabled={pending}
            >
              <LogIn className="size-4" aria-hidden="true" />
              {session.state === "no_show" ? "Arrived" : "Clock in"}
            </motion.button>
          )}
        </div>
      </div>

      {error && (
        <div className="pb-2.5 pl-6 pr-3">
          <ActionError message={error} />
        </div>
      )}
    </motion.li>
  );
}
