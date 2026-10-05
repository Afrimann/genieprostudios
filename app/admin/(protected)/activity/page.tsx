import type { Metadata } from "next";
import { Suspense } from "react";
import { LogIn, LogOut, UserX } from "lucide-react";

import {
  listFrontdeskActivity,
  type FrontdeskActivityEvent,
  type FrontdeskActivityEventType,
} from "@/lib/repositories/frontdesk-activity-repository";
import { formatKobo } from "@/lib/utils/money";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const instant = false;

export const metadata: Metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

// session_attendance (not bookings) — a clock event doesn't change the
// booking row at all, so watching bookings here would miss every one of
// them. Already in the realtime publication, see 0033_session_attendance.sql.
const ACTIVITY_REALTIME_TABLES = [{ table: "session_attendance" }];

const EVENT_COPY: Record<
  FrontdeskActivityEventType,
  { verb: string; icon: typeof LogIn; tone: "live" | "neutral" | "alert" }
> = {
  clock_in: { verb: "clocked in", icon: LogIn, tone: "live" },
  clock_out: { verb: "clocked out", icon: LogOut, tone: "neutral" },
  no_show: { verb: "marked a no-show for", icon: UserX, tone: "alert" },
};

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityRow({ event }: { event: FrontdeskActivityEvent }) {
  const copy = EVENT_COPY[event.type];
  const Icon = copy.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center border ${
          copy.tone === "alert"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : copy.tone === "live"
              ? "border-[var(--amber-glow)]/30 bg-[var(--amber-glow)]/10 text-[var(--amber-glow)]"
              : "border-border bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm text-foreground">
          <span className="font-medium">{event.staffName ?? "Unknown staff"}</span>{" "}
          {copy.verb}{" "}
          <span className="font-medium">{event.customerName ?? "a customer"}</span>
          {event.type === "no_show" ? "" : " for"}
          {event.type !== "no_show" && (
            <>
              {" "}
              <span className="text-muted-foreground">{event.serviceLabel}</span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatEventTime(event.atIso)}
          {event.sessionDate && event.sessionStartTime && (
            <> · session {event.sessionDate} at {event.sessionStartTime.slice(0, 5)}</>
          )}
        </p>
        {event.type === "clock_in" && event.balanceKobo !== null && event.balanceKobo > 0 && (
          <p className="text-xs font-medium text-destructive">
            Clocked in with {formatKobo(event.balanceKobo)} still owing
          </p>
        )}
        {event.note && <p className="text-xs whitespace-pre-line text-muted-foreground">{event.note}</p>}
      </div>
    </div>
  );
}

/**
 * The owner's "what did the front desk do" feed — every clock-in, clock-out
 * and no-show, newest first, with who did it. Nothing here writes anything;
 * it's a read of the same session_attendance rows /frontdesk itself writes,
 * see lib/repositories/frontdesk-activity-repository.ts for how one row
 * becomes up to three log lines.
 */
async function ActivityFeed() {
  const events = await listFrontdeskActivity();

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet — this fills in as front desk staff clock sessions in and out.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {events.map((event) => (
        <ActivityRow key={event.id} event={event} />
      ))}
    </div>
  );
}

function ActivityFeedFallback() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export default function AdminActivityPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <RealtimeRefresher channelName="admin-frontdesk-activity" tables={ACTIVITY_REALTIME_TABLES} />
      <p className="text-sm text-muted-foreground">
        Every clock-in, clock-out and no-show recorded at the front desk, newest first — updates live
        as staff act on the board.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Front desk activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ActivityFeedFallback />}>
            <ActivityFeed />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
