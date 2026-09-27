import type { PortfolioPlatform } from "@/lib/validation/portfolio";

// ---------------------------------------------------------------------------
// YouTube video ID extraction. Admins may paste a bare 11-char video ID, a
// full "watch?v=" URL, a "youtu.be/" short URL, or (less commonly) a
// "/shorts/" or "/embed/" URL — this normalizes all of them to just the ID
// so both the thumbnail derivation below and the embed URL construction
// further down work regardless of what was pasted.
// ---------------------------------------------------------------------------

// YouTube video IDs are always exactly 11 characters from this alphabet.
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts a bare YouTube video ID from either a full URL (any common
 * shape: watch?v=, youtu.be/, /embed/, /shorts/) or an already-bare ID.
 * Returns null if nothing that looks like a valid 11-character video ID
 * can be found, rather than throwing — callers decide how to handle a
 * malformed/unrecognized value (e.g. skip thumbnail derivation, surface a
 * validation error in the admin form).
 */
export function extractYouTubeVideoId(videoIdOrUrl: string): string | null {
  const trimmed = videoIdOrUrl.trim();

  if (YOUTUBE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not a valid URL and not a bare ID — give up rather than guessing.
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // youtu.be/{id}
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    // youtube.com/watch?v={id}
    const vParam = url.searchParams.get("v");
    if (vParam && YOUTUBE_ID_PATTERN.test(vParam)) {
      return vParam;
    }

    // youtube.com/embed/{id}, youtube.com/shorts/{id}, youtube.com/v/{id}
    const segments = url.pathname.split("/").filter(Boolean);
    const knownPrefixes = ["embed", "shorts", "v", "live"];
    const prefixIndex = segments.findIndex((segment) => knownPrefixes.includes(segment));
    if (prefixIndex !== -1 && segments[prefixIndex + 1]) {
      const id = segments[prefixIndex + 1];
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Instagram shortcode extraction. Instagram post/reel URLs are shaped
// "instagram.com/p/{shortcode}/..." or "instagram.com/reel/{shortcode}/...".
// There is no public thumbnail API for Instagram (unlike YouTube's
// img.youtube.com), so this is only used for embed URL construction, never
// for thumbnail derivation.
// ---------------------------------------------------------------------------

/**
 * Extracts the shortcode from an Instagram post/reel URL (either "/p/" or
 * "/reel/" form). Returns null if the URL doesn't match a recognized shape
 * — callers decide how to handle it (e.g. surface a validation error rather
 * than construct a broken embed src).
 */
export function extractInstagramShortcode(videoIdOrUrl: string): string | null {
  const trimmed = videoIdOrUrl.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Instagram shortcodes aren't meaningfully "bare" the way YouTube IDs
    // are commonly pasted — if it's not a URL, there's nothing to extract.
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const prefixIndex = segments.findIndex((segment) => segment === "p" || segment === "reel");

  if (prefixIndex === -1 || !segments[prefixIndex + 1]) {
    return null;
  }

  return segments[prefixIndex + 1];
}

// ---------------------------------------------------------------------------
// Thumbnail resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the thumbnail URL to store/display for a portfolio entry.
 * - If an explicit thumbnailUrl is already supplied (admin-uploaded or
 *   otherwise provided), it always wins — this function never overrides an
 *   explicit value.
 * - If platform is "youtube" and no explicit thumbnail was supplied, derives
 *   one from img.youtube.com using the extracted video ID. Returns null if
 *   the ID can't be extracted (malformed video_id_or_url) rather than
 *   constructing a broken URL.
 * - If platform is "instagram", there is no public thumbnail API — returns
 *   the explicit thumbnailUrl (possibly null/undefined) as-is. A missing
 *   Instagram thumbnail is a data-entry gap for the admin to fill in, not
 *   something this layer can derive; the frontend decides the fallback
 *   rendering.
 */
export function resolveThumbnailUrl(
  platform: PortfolioPlatform,
  videoIdOrUrl: string,
  explicitThumbnailUrl?: string | null,
): string | null {
  if (explicitThumbnailUrl) {
    return explicitThumbnailUrl;
  }

  if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(videoIdOrUrl);
    if (!videoId) {
      return null;
    }
    // maxresdefault is the true 1280x720 HD thumbnail (vs. hqdefault's
    // 480x360) — YouTube only generates it for videos uploaded at
    // sufficient source resolution, so it 404s for a minority of older/
    // low-res videos. The frontend (VideoEmbedFacade's onError) falls back
    // to hqdefault when that happens, so this is safe to request by
    // default rather than the lower-resolution one.
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Instagram: no derivation possible, just pass through whatever (nothing)
  // was supplied.
  return explicitThumbnailUrl ?? null;
}

// ---------------------------------------------------------------------------
// Embed URL construction — consumed by the frontend's embed-facade
// component (Phase 5 frontend work) when a viewer clicks play on a
// portfolio entry's detail page.
// ---------------------------------------------------------------------------

export type ResolveEmbedUrlResult =
  | { success: true; embedUrl: string }
  | { success: false; error: "unrecognized_reference"; message: string };

/**
 * Given a stored video_id_or_url + platform, produces the actual iframe src
 * to use when a viewer clicks play:
 * - YouTube: https://www.youtube.com/embed/{id}
 * - Instagram: https://www.instagram.com/p/{shortcode}/embed
 *
 * Returns a typed failure (never throws) when the reference can't be parsed
 * into a usable id/shortcode, so the frontend can render a friendly
 * "video unavailable" state instead of a broken iframe.
 */
// Query params applied to every YouTube embed, per the "every play stays on
// the page, no external links, no fast-forward controls, just the video"
// rule: controls=0 strips the entire control bar (no seek/scrub bar),
// disablekb=1 blocks keyboard-driven seeking too, modestbranding=1 shrinks
// the YouTube logo (YouTube's embed terms don't allow removing it
// entirely), rel=0 stops other channels' videos from showing at the end,
// and autoplay=1 is safe specifically because the iframe is only ever
// created in direct response to the facade's own click (a real user
// gesture) — that's what lets browsers allow unmuted autoplay here.
const YOUTUBE_EMBED_PARAMS =
  "autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&playsinline=1";

export function resolveEmbedUrl(
  platform: PortfolioPlatform,
  videoIdOrUrl: string,
): ResolveEmbedUrlResult {
  if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(videoIdOrUrl);
    if (!videoId) {
      return {
        success: false,
        error: "unrecognized_reference",
        message: "Could not determine a YouTube video ID from the stored reference.",
      };
    }
    return {
      success: true,
      embedUrl: `https://www.youtube.com/embed/${videoId}?${YOUTUBE_EMBED_PARAMS}`,
    };
  }

  const shortcode = extractInstagramShortcode(videoIdOrUrl);
  if (!shortcode) {
    return {
      success: false,
      error: "unrecognized_reference",
      message: "Could not determine an Instagram shortcode from the stored reference.",
    };
  }
  return { success: true, embedUrl: `https://www.instagram.com/p/${shortcode}/embed` };
}
