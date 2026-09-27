"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

import { resolveThumbnailUrl } from "@/lib/services/portfolio-service";
import {
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CATEGORY_LABELS,
  type PortfolioCategory,
} from "@/lib/validation/portfolio";
import type { PortfolioEntry } from "@/lib/repositories/portfolio-repository";

interface WorkGridProps {
  entries: PortfolioEntry[];
}

const FILTERS: Array<{ value: PortfolioCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  ...PORTFOLIO_CATEGORIES.map((category) => ({
    value: category,
    label: PORTFOLIO_CATEGORY_LABELS[category],
  })),
];

// Client-side filtering over the already-fetched published set — per the
// backend repository's comment, the full published list is unlikely to be
// large enough to need server-side pagination/filtering, so this stays a
// small Client Component wrapping server-fetched data (no ?category=
// searchParam needed, avoids re-triggering the Cache Components Suspense
// boundary on every filter click).
export function WorkGrid({ entries }: WorkGridProps) {
  const [activeFilter, setActiveFilter] = useState<PortfolioCategory | "all">("all");

  const filtered = useMemo(() => {
    if (activeFilter === "all") return entries;
    return entries.filter((entry) => entry.category === activeFilter);
  }, [entries, activeFilter]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveFilter(filter.value)}
            className={
              activeFilter === filter.value
                ? "rounded-full bg-[var(--amber-glow)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors"
                : "rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-[var(--amber-glow)] hover:text-foreground"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No work in this category yet — check back soon.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry) => (
          <WorkCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function WorkCard({ entry }: { entry: PortfolioEntry }) {
  const thumbnailUrl = resolveThumbnailUrl(
    entry.platform,
    entry.video_id_or_url,
    entry.thumbnail_url,
  );

  return (
    <Link
      href={`/work/${entry.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-[var(--amber-glow)]"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
        {thumbnailUrl ? (
          // External YouTube/Instagram-hosted thumbnails, not local/optimizable assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No thumbnail
          </div>
        )}

        <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--amber-glow)] text-[var(--primary-foreground)]">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>

        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          {entry.platform === "youtube" ? "YouTube" : "Instagram"}
        </span>
      </div>

      <div className="flex flex-col gap-1 px-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--amber-glow)]">
          {PORTFOLIO_CATEGORY_LABELS[entry.category]}
        </span>
        <h3 className="font-heading text-base font-medium text-foreground">
          {entry.title}
        </h3>
      </div>
    </Link>
  );
}
