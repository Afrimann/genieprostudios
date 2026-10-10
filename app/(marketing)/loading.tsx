import { Loader2 } from "lucide-react";

// Root-of-the-group fallback: every page in this route group reads cookies()
// for the auth-aware header (and some, like /book, gate the whole layout on
// a live session check), which forces that content fully dynamic — see the
// instant=false note in app/(marketing)/layout.tsx. Without a loading.tsx
// here, Next has nothing to render while that check resolves, so clicking
// "Book a session" (or any other link into this group) looked unresponsive:
// the page just sat still until the server round-trip finished. This file
// wraps every nested page/layout below it (not the (marketing) layout
// itself, which is why SiteHeader/SiteFooter stay mounted and the click
// target remains visible) in a Suspense boundary, so navigation now shows
// immediate feedback instead of a dead pause.
export default function MarketingLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-32">
      <Loader2
        className="size-6 animate-spin text-[var(--amber-glow)]"
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
