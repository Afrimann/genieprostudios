"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SCROLL_AMOUNT = 360;

/**
 * Wraps the sessions-reel card row with a scroll ref + left/right arrow
 * buttons. Split out as a client component because SessionsReel itself is
 * an async server component (fetches portfolio entries) and can't hold the
 * onClick handlers directly.
 */
export function SessionsCarousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-SCROLL_AMOUNT)}
        aria-label="Scroll left"
        className="absolute top-1/2 left-0 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] md:flex"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-6 flex gap-6 overflow-x-auto px-6 py-6"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(SCROLL_AMOUNT)}
        aria-label="Scroll right"
        className="absolute top-1/2 right-0 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] md:flex"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
