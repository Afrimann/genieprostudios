import type { Service } from "@/lib/repositories/service-repository";
import { PACKAGE_GROUPS, type PackageGroupContent } from "@/lib/content/package-details";

// Pure grouping/presentation logic — takes the services the booking flow
// already fetched (lib/services/booking-flow-actions.ts's fetchServices())
// and layers PACKAGE_GROUPS' static content on top. Prices/durations always
// come from the `services` rows passed in, never from PACKAGE_GROUPS itself,
// so a price change in the DB shows up here with no code change.
export type PricedPackage = {
  content: PackageGroupContent;
  dayRows: Service[];
  nightRows: Service[];
  // Populated instead of day/night for matchLabel-based groups (the per-song
  // add-ons), which don't have a day/night split.
  singleRows: Service[];
  minPriceKobo: number;
};

function byDuration(a: Service, b: Service): number {
  return a.duration_hours - b.duration_hours;
}

/**
 * Builds one PricedPackage per PACKAGE_GROUPS entry that has at least one
 * matching active service, in PACKAGE_GROUPS' own order. A group with no
 * matching services (e.g. an admin deactivated every row in it) is silently
 * dropped rather than shown empty.
 */
export function buildPackageCatalog(services: Service[]): PricedPackage[] {
  const packages: PricedPackage[] = [];

  for (const group of PACKAGE_GROUPS) {
    const matched = group.matchLabel
      ? services.filter((s) => s.label === group.matchLabel)
      : services.filter((s) => group.categories?.includes(s.category));

    if (matched.length === 0) continue;

    const dayRows = matched.filter((s) => s.category.endsWith("_day")).sort(byDuration);
    const nightRows = matched.filter((s) => s.category.endsWith("_night")).sort(byDuration);
    const singleRows = group.matchLabel ? matched.sort(byDuration) : [];

    packages.push({
      content: group,
      dayRows,
      nightRows,
      singleRows,
      minPriceKobo: Math.min(...matched.map((s) => s.price_kobo)),
    });
  }

  return packages;
}
