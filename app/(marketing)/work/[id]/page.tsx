
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPortfolioEntryById } from "@/lib/repositories/portfolio-repository";
import { resolveThumbnailUrl } from "@/lib/services/portfolio-service";
import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/validation/portfolio";
import { VideoEmbedFacade } from "@/components/portfolio/video-embed-facade";
import { Badge } from "@/components/ui/badge";

// Dynamic route param + a Supabase read — both need the Suspense-wrap
// treatment under cacheComponents (AGENTS.md fix #1), same as the /work
// grid but with a param on top.
export const instant = false;

async function WorkDetailContent({ id }: { id: string }) {
  const entry = await getPortfolioEntryById(id);

  if (!entry) {
    return (
      <div className="flex flex-col items-start gap-4 py-10">
        <p className="text-sm text-muted-foreground">
          This piece of work couldn&apos;t be found — it may have been unpublished or the
          link is outdated.
        </p>
        <Link
          href="/work"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--amber-glow)] hover:text-[var(--amber-dim)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to work
        </Link>
      </div>
    );
  }

  const thumbnailUrl = resolveThumbnailUrl(
    entry.platform,
    entry.video_id_or_url,
    entry.thumbnail_url,
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/work"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to work
      </Link>

      <VideoEmbedFacade
        platform={entry.platform}
        videoIdOrUrl={entry.video_id_or_url}
        thumbnailUrl={thumbnailUrl}
        title={entry.title}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{PORTFOLIO_CATEGORY_LABELS[entry.category]}</Badge>
          <Badge variant="secondary">
            {entry.platform === "youtube" ? "YouTube" : "Instagram"}
          </Badge>
        </div>

        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {entry.title}
        </h1>

        {entry.description && (
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {entry.description}
          </p>
        )}
      </div>
    </div>
  );
}

function WorkDetailFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex flex-col bg-background">
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <Suspense fallback={<WorkDetailFallback />}>
          <WorkDetailContent id={id} />
        </Suspense>
      </div>
    </main>
  );
}
