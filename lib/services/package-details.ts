import type { ServiceCatalog } from "@/lib/repositories/service-repository";

export function packageDetailsHref(slug: string, category?: string): string {
  const path = `/services/${encodeURIComponent(slug)}`;
  return category ? `${path}?category=${encodeURIComponent(category)}` : path;
}

export function serviceBookingHref(serviceId: string): string {
  return `/book?service=${encodeURIComponent(serviceId)}`;
}

export function findPackageDetails(
  catalog: ServiceCatalog,
  slug: string,
  category?: string,
) {
  const pkg = catalog.packages.find((item) => item.active && item.slug === slug);
  if (!pkg) return null;

  const categories = pkg.categories.filter((item) => item.active && item.services.some((rate) => rate.active));
  const selectedCategory = category
    ? categories.find((item) => item.category === category)
    : categories[0];

  if (!selectedCategory) return null;
  return { pkg, category: selectedCategory, categories };
}
