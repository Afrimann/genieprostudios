// TEMPORARY design-preview route — delete after screenshotting.
// Renders the real FrontdeskShell + FrontdeskBoard against hardcoded mock
// sessions so the layout can be inspected without a front-desk login.
import type { FrontdeskSession } from "@/lib/repositories/frontdesk-repository";
import { FrontdeskBoard } from "@/components/frontdesk/frontdesk-board";
import { FrontdeskShell } from "@/components/frontdesk/frontdesk-shell";

export const dynamic = "force-dynamic";

const MINUTE = 60_000;

function lagosParts(ms: number) {
  const d = new Date(ms);
  return {
    date: d.toLocaleDateString("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: d.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

function make(
  now: number,
  o: {
    id: string;
    startOffsetMin: number;
    durationMin: number;
    state: FrontdeskSession["state"];
    name: string | null;
    phone: string | null;
    service: string;
    balanceKobo?: number;
    clockedInOffsetMin?: number;
    clockInBalanceKobo?: number | null;
    carriedOver?: boolean;
  },
): FrontdeskSession {
  const startMs = now + o.startOffsetMin * MINUTE;
  const endMs = startMs + o.durationMin * MINUTE;
  const start = lagosParts(startMs);
  const end = lagosParts(endMs);

  return {
    bookingId: o.id,
    customerName: o.name,
    customerPhone: o.phone,
    serviceLabel: o.service,
    sessionDate: start.date,
    sessionStartTime: start.time,
    sessionEndTime: end.time,
    startAtIso: new Date(startMs).toISOString(),
    endAtIso: new Date(endMs).toISOString(),
    balanceKobo: o.balanceKobo ?? 0,
    state: o.state,
    clockedInAtIso:
      o.clockedInOffsetMin === undefined
        ? null
        : new Date(now + o.clockedInOffsetMin * MINUTE).toISOString(),
    clockedOutAtIso: o.state === "completed" ? new Date(now - 30 * MINUTE).toISOString() : null,
    noShowAtIso: o.state === "no_show" ? new Date(now - 40 * MINUTE).toISOString() : null,
    clockInBalanceKobo: o.clockInBalanceKobo ?? null,
    note: null,
    isCarriedOver: o.carriedOver ?? false,
  };
}

export default function FrontdeskPreviewPage() {
  const now = Date.now();

  const sessions: FrontdeskSession[] = [
    make(now, {
      id: "a",
      startOffsetMin: -12,
      durationMin: 120,
      state: "awaiting",
      name: "Chidera Okonkwo",
      phone: "+2348031234567",
      service: "Recording session",
      balanceKobo: 4_500_000,
    }),
    make(now, {
      id: "b",
      startOffsetMin: -3,
      durationMin: 60,
      state: "awaiting",
      name: "Ada Eze",
      phone: "+2348099887766",
      service: "Rehearsal room",
    }),
    make(now, {
      id: "c",
      startOffsetMin: -47,
      durationMin: 180,
      state: "in_progress",
      name: "Tunde Bakare",
      phone: "+2347012345678",
      service: "Production session",
      clockedInOffsetMin: -47,
      clockInBalanceKobo: 2_000_000,
    }),
    make(now, {
      id: "d",
      startOffsetMin: -200,
      durationMin: 180,
      state: "in_progress",
      name: "Sade Adeyemi",
      phone: null,
      service: "Recording session",
      clockedInOffsetMin: -195,
      carriedOver: true,
    }),
    make(now, {
      id: "e",
      startOffsetMin: 88,
      durationMin: 120,
      state: "awaiting",
      name: "Kelechi Obi",
      phone: "+2348055554444",
      service: "Mixing & mastering",
      balanceKobo: 1_200_000,
    }),
    make(now, {
      id: "f",
      startOffsetMin: 208,
      durationMin: 60,
      state: "awaiting",
      name: "Grace Aniekwe",
      phone: null,
      service: "Recording session",
    }),
    make(now, {
      id: "g",
      startOffsetMin: 328,
      durationMin: 120,
      state: "awaiting",
      name: "Emeka Nwosu",
      phone: null,
      service: "Video shoot",
    }),
    make(now, {
      id: "h",
      startOffsetMin: -300,
      durationMin: 120,
      state: "completed",
      name: "Blessing Idowu",
      phone: null,
      service: "Rehearsal room",
    }),
    make(now, {
      id: "i",
      startOffsetMin: -420,
      durationMin: 60,
      state: "completed",
      name: "Femi Alabi",
      phone: null,
      service: "Recording session",
    }),
    make(now, {
      id: "j",
      startOffsetMin: -180,
      durationMin: 60,
      state: "no_show",
      name: "Ngozi Chukwu",
      phone: "+2348011112222",
      service: "Mixing & mastering",
      balanceKobo: 3_000_000,
    }),
  ];

  return (
    <FrontdeskShell staffEmail="desk@genieprostudios.com">
      <FrontdeskBoard sessions={sessions} serverNowIso={new Date(now).toISOString()} />
    </FrontdeskShell>
  );
}
