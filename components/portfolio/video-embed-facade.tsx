"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

import { resolveEmbedUrl } from "@/lib/services/portfolio-service";
import type { PortfolioPlatform } from "@/lib/validation/portfolio";

interface VideoEmbedFacadeProps {
  platform: PortfolioPlatform;
  videoIdOrUrl: string;
  thumbnailUrl: string | null;
  title: string;
}

// maxresdefault (the 1280x720 HD thumbnail resolveThumbnailUrl now derives)
// 404s for a minority of older/low-resolution source videos — this swaps
// down to hqdefault (480x360, always generated) exactly once on load
// failure, rather than showing a broken image. The `data-fallback` guard
// stops it from retrying forever if hqdefault somehow fails too.
function handleThumbnailError(event: React.SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "true";
  img.src = img.src.replace("/maxresdefault.jpg", "/hqdefault.jpg");
}

// Zero-iframe-until-clicked facade for the /work/[id] detail page (the /work
// grid never renders this — it only links to the detail page per the
// no-inline-expand correction in work-page-design-brief.md). Keeping the
// resolveEmbedUrl() call client-side and deferred to the click handler
// (rather than resolving eagerly) is the whole point of the facade: no
// iframe request/embed handshake happens until the viewer opts in.
export function VideoEmbedFacade({
  platform,
  videoIdOrUrl,
  thumbnailUrl,
  title,
}: VideoEmbedFacadeProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePlay() {
    const result = resolveEmbedUrl(platform, videoIdOrUrl);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setError(null);
    setEmbedUrl(result.embedUrl);
  }

  if (embedUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
        />
        {/* The embed itself deliberately ships with no controls (see
            resolveEmbedUrl's controls=0/disablekb=1) — no seek bar, no
            fast-forward, "just the video". This is the only affordance to
            stop it early; it resets back to the thumbnail rather than
            trying to reach into the iframe (cross-origin, not controllable
            from here). */}
        <button
          type="button"
          onClick={() => setEmbedUrl(null)}
          aria-label="Stop video"
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 text-center">
        <p className="text-sm font-medium text-foreground">Video unavailable</p>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-card"
      aria-label={`Play ${title}`}
    >
      {thumbnailUrl ? (
        // External YouTube/Instagram-hosted thumbnails, not local/optimizable assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          onError={handleThumbnailError}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
          No thumbnail available
        </div>
      )}

      <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />

      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--amber-glow)] text-[var(--primary-foreground)] shadow-lg transition-transform group-hover:scale-110">
          <Play className="h-7 w-7 fill-current" />
        </span>
      </span>
    </button>
  );
}
