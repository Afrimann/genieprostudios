import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";
import { VideoEmbedFacade } from "@/components/portfolio/video-embed-facade";
import { Reveal } from "@/components/ui/reveal";

// The two clips we deliberately lead with here, shown side by side. Falls
// back to the next available entries by display_order if either is ever
// unpublished/removed, so this section never breaks because a single entry
// goes away.
const FEATURED_VIDEO_URL_PRIMARY = "https://youtu.be/5Oeoje1o3-k";
const FEATURED_VIDEO_URL_SECONDARY = "https://youtu.be/aHrukNCriHw";

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

  const primary =
    entries.find((entry) => entry.video_id_or_url === FEATURED_VIDEO_URL_PRIMARY) ?? entries[0];
  const secondary =
    entries.find((entry) => entry.video_id_or_url === FEATURED_VIDEO_URL_SECONDARY) ??
    entries.find((entry) => entry.id !== primary.id) ??
    primary;

  return (
    <section className="border-t border-border bg-background">
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Hear it before you book it
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Straight out of the room
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
          {[primary, secondary].map((entry) => (
            <div key={entry.id}>
              <VideoEmbedFacade
                platform={entry.platform}
                videoIdOrUrl={entry.video_id_or_url}
                thumbnailUrl={entry.thumbnail_url}
                title={entry.title}
              />
              <p className="mt-2 text-sm text-muted-foreground">{entry.title}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
