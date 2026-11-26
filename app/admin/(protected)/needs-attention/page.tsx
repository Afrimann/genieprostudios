import { UnresolvedBookingsManager } from "@/components/admin/unresolved-bookings-manager";

export const instant = false;

export default function NeedsAttentionPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        Review past sessions with an unpaid balance and decide whether to mark them stale or
        reschedule them.
      </p>
      <UnresolvedBookingsManager />
    </main>
  );
}
