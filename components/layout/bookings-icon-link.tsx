import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Represents the bookings view as an icon + tooltip in the header, not a
// text nav link — per the site's own auth-invisible-until-needed rule (see
// sitemap.md), this only ever renders for a signed-in customer; logged-out
// visitors see nothing here, not even a placeholder, since there is
// deliberately no Sign Up/Login CTA anywhere in the public nav.
export async function BookingsIconLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard"
          aria-label="View your bookings"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
        >
          <CalendarCheck className="size-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>View your bookings</TooltipContent>
    </Tooltip>
  );
}
