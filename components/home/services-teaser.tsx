import Link from "next/link";

import { getActiveServices } from "@/lib/repositories/service-repository";
import { formatKobo } from "@/lib/utils/money";

// Horizontal scroll-snap row of "rack units" — each category reads like a
// module in an equipment rack rather than a repeated SaaS-style pricing
// card grid. Real data (getActiveServices), grouped by category, showing
// the cheapest line item per category as "from ₦X" — the full breakdown
// stays on /services, this is a teaser.
async function getCategorySummaries() {
  const services = await getActiveServices();
  const byCategory = new Map<string, number>();

  for (const service of services) {
    const current = byCategory.get(service.category);
    if (current === undefined || service.price_kobo < current) {
      byCategory.set(service.category, service.price_kobo);
    }
  }

  return Array.from(byCategory.entries()).map(([category, fromKobo]) => ({
    category,
    fromKobo,
  }));
}

export async function ServicesTeaser() {
  const categories = await getCategorySummaries();

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Services &amp; packages
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            What&apos;s on the rack
          </h2>
        </div>

        <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4">
          {categories.map((entry) => (
            <div
              key={entry.category}
              className="flex w-56 shrink-0 snap-start flex-col gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-end gap-1" aria-hidden="true">
                {[40, 65, 50, 80, 55].map((height, i) => (
                  <span
                    key={i}
                    style={{ height }}
                    className="w-1.5 rounded-full bg-[var(--amber-glow)]/70"
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{entry.category}</p>
                <p className="text-xs text-muted-foreground">
                  from {formatKobo(entry.fromKobo)}
                </p>
              </div>
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
      </div>
    </section>
  );
}
