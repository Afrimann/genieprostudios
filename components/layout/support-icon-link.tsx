import Link from "next/link";
import { MessageCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Presentational only — see bookings-icon-link.tsx's comment: the signed-in
// check happens once in header-auth-links.tsx and is threaded down here.
export function SupportIconLink({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard/support"
          aria-label="Message the front desk"
          className="inline-flex size-9 items-center justify-center rounded-none text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="size-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>Message the front desk</TooltipContent>
    </Tooltip>
  );
}
