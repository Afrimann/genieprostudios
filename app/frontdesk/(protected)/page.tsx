import { getFrontdeskBoard } from "@/lib/repositories/frontdesk-repository";
import { FrontdeskBoard } from "@/components/frontdesk/frontdesk-board";

// Behind app/frontdesk/(protected)/layout.tsx's live session + role check,
// and showing data that changes by the minute — same reasoning as the other
// two admin areas for opting out of static shell validation.
export const instant = false;

/**
 * The whole front desk product: one board, today's sessions, clock in and
 * clock out. Fetches on the server and hands the result to a Client
 * Component, which owns the ticking clock, the lane split and the realtime
 * subscription.
 */
export default async function FrontdeskPage() {
  const sessions = await getFrontdeskBoard();

  // The board's lanes and counters are time-relative, so the server hands
  // down its own "now" for the first render — see FrontdeskBoard for why
  // deriving it on both sides independently would be a hydration mismatch.
  return <FrontdeskBoard sessions={sessions} serverNowIso={new Date().toISOString()} />;
}
