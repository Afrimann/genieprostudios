import Link from "next/link";

import { Reveal } from "@/components/ui/reveal";

// Cross-promotes Triumph Music Global (the engineer's standalone remote
// mixing/mastering service, app/triumph/*) from the Genie Pro marketing
// site — replaces the old BrandToggleBar nav affordance (removed per
// client request) with real marketing content instead of a persistent nav
// toggle. Deliberately styled with Triumph's own dark/teal palette rather
// than Genie Pro's amber, so it reads as "a different, related service"
// rather than blending into the rest of the page.
export function TriumphTeaser() {
  return (
    <section className="border-t border-border bg-[#0b0712]">
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Remote mixing &amp; mastering
          </span>
          <h2 className="font-heading text-2xl font-medium text-white sm:text-3xl">
            Need your song mixed or mastered — no studio time required?
          </h2>
          <p className="max-w-xl text-sm text-white/60">
            Triumph Music Global is our dedicated remote mixing &amp; mastering service — send your
            tracks in, get a radio-ready master back, wherever you are.
          </p>
        </div>
        <Link
          href="/triumph"
          className="shrink-0 border border-[#22e6c8] bg-[#22e6c8] px-6 py-3 text-sm font-medium whitespace-nowrap text-[#0b0712] transition-colors hover:bg-transparent hover:text-[#22e6c8]"
        >
          Check out Triumph Music Global →
        </Link>
      </Reveal>
    </section>
  );
}
