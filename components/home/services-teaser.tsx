"use client";

import Link from "next/link";

import { useServiceCatalog } from "@/lib/hooks/use-service-catalog";
import { packageDetailsHref } from "@/lib/services/package-details";
import { formatKobo } from "@/lib/utils/money";
import { Reveal } from "@/components/ui/reveal";

// Client-side hook keeps data access behind Component → Hook → Service → Repository.
export function ServicesTeaser() {
  const { catalog, loading } = useServiceCatalog();
  const categories = catalog.packages.flatMap((pkg) =>
    pkg.categories
      .filter((category) => category.active && category.services.some((service) => service.active))
      .map((category) => {
        const services = category.services.filter((service) => service.active);
        const cheapest = services.reduce((current, service) =>
          service.price_kobo < current.price_kobo ? service : current,
        );
        return {
          category: category.category,
          label: category.label,
          slug: pkg.slug,
          fromKobo: cheapest.price_kobo,
          unit: cheapest.is_addon
            ? cheapest.category === "digital_production" ? "/track" : "/song"
            : "",
        };
      }),
  );

  return (
    <section className="border-t border-border bg-background">
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Services &amp; packages
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            What&apos;s on the rack
          </h2>
        </div>

        <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4">
          {loading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading service rates…</p>
          ) : categories.map((entry) => (
            <div
              key={entry.category}
              className="flex w-56 shrink-0 snap-start flex-col gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-end gap-1" aria-hidden="true">
                {[40, 65, 50, 80, 55].map((height, i) => (
                  <span
                    key={i}
                    style={{ height }}
                    className="w-1.5 rounded-none bg-[var(--amber-glow)]/70"
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {entry.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  from {formatKobo(entry.fromKobo)}{entry.unit}
                </p>
              </div>
              <Link
                href={packageDetailsHref(entry.slug, entry.category)}
                className="mt-auto text-xs font-medium text-[var(--amber-glow)] underline underline-offset-4"
              >
                Learn more
              </Link>
            </div>
          ))}

          <Link
            href="/services"
            className="flex w-56 shrink-0 snap-start flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-border p-5 text-sm font-medium text-foreground transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)]"
          >
            <span>See full pricing</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
