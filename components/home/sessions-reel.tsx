import Link from "next/link";

import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";
import { VideoEmbedFacade } from "@/components/portfolio/video-embed-facade";
import { Reveal } from "@/components/ui/reveal";
import { SessionsCarousel } from "@/components/home/sessions-carousel";

// The same two led with in FeaturedSession — excluded here so the two
// sections never show the exact same clips twice on one page load.
const FEATURED_VIDEO_URLS = [
  "https://youtu.be/5Oeoje1o3-k",
  "https://youtu.be/aHrukNCriHw",
];

// Alternating tilt per card — "photos pinned to a corkboard" rather than a
// flat repeated grid, per the "fun and graphical" direction. Cycles rather
// than being data-driven since it's purely a visual rhythm, not meaningful
// per-entry.
const ROTATIONS = [
  "-rotate-2",
  "rotate-3",
  "-rotate-3",
  "rotate-2",
  "-rotate-1",
  "rotate-1",
];

const SELECTION_SIZE = 6;

/**
 * Curated, playful showcase of a handful of portfolio entries — distinct
 * from both the plain "rack unit" cards in components/home/services-teaser.tsx
 * and the /work grid's formal, filterable layout. Every card plays inline on
 * click via VideoEmbedFacade (no external link, no seek bar), same as
 * FeaturedSession above.
 */
export async function SessionsReel() {
  const entries = await getPublishedPortfolioEntries();
  const selection = entries
    .filter((entry) => !FEATURED_VIDEO_URLS.includes(entry.video_id_or_url))
    .slice(0, SELECTION_SIZE);

  if (selection.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border bg-card">
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            More from the sessions
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Pull up a chair
          </h2>
        </div>

        <SessionsCarousel>
          {selection.map((entry, i) => (
            <div
              key={entry.id}
              className={`w-60 shrink-0 transition-transform duration-300 ease-out hover:z-10 hover:scale-105 hover:rotate-0 sm:w-64 ${ROTATIONS[i % ROTATIONS.length]}`}
            >
              <VideoEmbedFacade
                platform={entry.platform}
                videoIdOrUrl={entry.video_id_or_url}
                thumbnailUrl={entry.thumbnail_url}
                title={entry.title}
              />
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.title}</p>
            </div>
          ))}

          <Link
            href="/work"
            className="flex w-60 shrink-0 rotate-1 flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-border bg-background p-5 text-sm font-medium text-foreground transition-transform duration-300 ease-out hover:rotate-0 hover:scale-105 hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] sm:w-64"
            style={{ aspectRatio: "16 / 9" }}
          >
            <span>See all the work</span>
            <span aria-hidden="true">→</span>
          </Link>
        </SessionsCarousel>
      </Reveal>
    </section>
  );
}
