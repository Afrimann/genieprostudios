import type { Service, ServiceCatalog, ServicePackage } from "@/lib/repositories/service-repository";

export type ServiceRateGroup = {
  category: string;
  label: string;
  services: Service[];
};

export type PricedPackage = {
  content: ServicePackage;
  rateGroups: ServiceRateGroup[];
  minPriceKobo: number;
};

/**
 * Groups active service rates by their owner-managed package and category.
 * Categories with no active rates are omitted; packages without bookable
 * rates are not shown.
 */
export function buildPackageCatalog(catalog: ServiceCatalog): PricedPackage[] {
  return catalog.packages.flatMap((content) => {
    if (!content.active) return [];

    const rateGroups = content.categories
      .filter((category) => category.active)
      .map((category) => ({
        category: category.category,
        label: category.label,
        services: category.services.filter((service) => service.active),
      }))
      .filter((group) => group.services.length > 0);

    const rates = rateGroups.flatMap((group) => group.services);
    if (rates.length === 0) return [];

    return [{
      content,
      rateGroups,
      minPriceKobo: Math.min(...rates.map((service) => service.price_kobo)),
    }];
  });
}
