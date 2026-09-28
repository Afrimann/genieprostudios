import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Presentational only — the signed-in check happens once in
// header-auth-links.tsx and is threaded down as `visible`, rather than each
// header icon link independently reading cookies()/auth.getUser() (that
// used to run 2-3 concurrent session reads per page load once this and
// support-icon-link.tsx both existed, which reproducibly hung one of the
// Suspense boundaries — see header-auth-links.tsx's comment).
export function BookingsIconLink({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard"
          aria-label="View your bookings"
          className="inline-flex size-9 items-center justify-center rounded-none text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
        >
          <CalendarCheck className="size-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>View your bookings</TooltipContent>
    </Tooltip>
  );
}
