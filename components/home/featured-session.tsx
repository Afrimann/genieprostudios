import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";
import { VideoEmbedFacade } from "@/components/portfolio/video-embed-facade";

// The one "official video" style entry we deliberately lead with here — best
// production value of the catalog, so it's the first thing a visitor sees
// play. Falls back to whatever's first by display_order if it's ever
// unpublished/removed, so this section never breaks because of a single
// entry going away.
const FEATURED_VIDEO_URL = "https://youtu.be/boGA3hV46eo";

/**
 * The "wide video, click to play" section requested for the home page —
 * full-width, thumbnail-first, plays inline via VideoEmbedFacade (no
 * external link, no seek bar — see resolveEmbedUrl's controls=0). Distinct
 * from the /work grid's deliberate "always link to a detail page, never
 * inline-expand" rule (work-page-design-brief.md) — that constraint is
 * specific to the grid; the home page showcase is a different context where
 * true inline playback is exactly what was asked for.
 */
export async function FeaturedSession() {
  const entries = await getPublishedPortfolioEntries();

  if (entries.length === 0) {
    return null;
  }

  const featured =
    entries.find((entry) => entry.video_id_or_url === FEATURED_VIDEO_URL) ?? entries[0];

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Hear it before you book it
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Straight out of the room
          </h2>
        </div>

        <VideoEmbedFacade
          platform={featured.platform}
          videoIdOrUrl={featured.video_id_or_url}
          thumbnailUrl={featured.thumbnail_url}
          title={featured.title}
        />

        <p className="text-sm text-muted-foreground">{featured.title}</p>
      </div>
    </section>
  );
}
