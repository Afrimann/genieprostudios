import { getPublishedPortfolioEntries } from "@/lib/repositories/portfolio-repository";
import { VideoEmbedFacade } from "@/components/portfolio/video-embed-facade";
import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

const SELECTION_SIZE = 6;

// Same alternating-tilt "photos pinned to a corkboard" treatment as
// components/home/sessions-reel.tsx (hover un-tilts + scales) — direct reuse
// of that established pattern for visual consistency, applied to real
// portfolio data rather than fabricated project names.
const ROTATIONS = ["-rotate-2", "rotate-3", "-rotate-3", "rotate-2", "-rotate-1", "rotate-1"];

// Deliberately reuses the SAME real portfolio data Genie Pro's own home
// page shows (components/home/sessions-reel.tsx) rather than a fabricated
// parallel "recent works" list — same engineer, so this is genuinely
// accurate, not invented client/project names standing in for real ones.
export async function TriumphPortfolioTeaser() {
  const entries = await getPublishedPortfolioEntries();
  const selection = entries.slice(0, SELECTION_SIZE);

  if (selection.length === 0) {
    return null;
  }

  return (
    <section id="portfolio" className="relative scroll-mt-16 overflow-hidden border-b border-border bg-background">
      <BrandGlow />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Recent work
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Hear it for yourself.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {selection.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex flex-col gap-2 transition-transform duration-300 ease-out hover:z-10 hover:scale-105 hover:rotate-0 ${ROTATIONS[i % ROTATIONS.length]}`}
            >
              <VideoEmbedFacade
                platform={entry.platform}
                videoIdOrUrl={entry.video_id_or_url}
                thumbnailUrl={entry.thumbnail_url}
                title={entry.title}
              />
              <p className="line-clamp-2 text-xs text-muted-foreground">{entry.title}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
