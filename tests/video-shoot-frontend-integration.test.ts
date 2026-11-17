import { describe, expect, it } from "vitest";

import type { ServiceCatalog } from "@/lib/repositories/service-repository";
import { buildPackageCatalog } from "@/lib/services/package-catalog";
import {
  findPackageDetails,
  packageDetailsHref,
  serviceBookingHref,
} from "@/lib/services/package-details";
import { formatKobo } from "@/lib/utils/money";

const rates = [
  { id: "video-1hr", hours: 1, priceKobo: 3_000_000, displayPrice: "₦30,000" },
  { id: "video-2hr", hours: 2, priceKobo: 6_000_000, displayPrice: "₦60,000" },
  { id: "video-3hr", hours: 3, priceKobo: 8_000_000, displayPrice: "₦80,000" },
  { id: "video-4hr", hours: 4, priceKobo: 10_000_000, displayPrice: "₦100,000" },
  { id: "video-5hr", hours: 5, priceKobo: 12_500_000, displayPrice: "₦125,000" },
  { id: "video-6hr", hours: 6, priceKobo: 15_000_000, displayPrice: "₦150,000" },
];

const catalog: ServiceCatalog = {
  packages: [{
    id: "video-package",
    slug: "video-shoot-extra-curricular-activities",
    title: "Video Shoot / Extra-Curricular Activities",
    subtitle: "Hourly video shoot and extra-curricular activity sessions",
    display_order: 7,
    active: true,
    features: [],
    categories: [{
      category: "video_shoot_extra_curricular_activities",
      package_id: "video-package",
      label: "Video Shoot / Extra-Curricular Activities",
      description: "Hourly video shoot and extra-curricular activity sessions.",
      display_order: 0,
      active: true,
      services: rates.map(({ id, hours, priceKobo }) => ({
        id,
        category: "video_shoot_extra_curricular_activities",
        label: `Video Shoot / Extra-Curricular Activities — ${hours}hr`,
        duration_hours: hours,
        price_kobo: priceKobo,
        is_addon: false,
        active: true,
      })),
    }],
  }],
};

describe("Video Shoot / Extra-Curricular Activities frontend integration", () => {
  it("shows the active package and all six exact session rates in the booking selector", () => {
    const [videoPackage] = buildPackageCatalog(catalog);

    expect(videoPackage.content.slug).toBe("video-shoot-extra-curricular-activities");
    expect(videoPackage.rateGroups.map((group) => group.category)).toEqual([
      "video_shoot_extra_curricular_activities",
    ]);
    expect(videoPackage.rateGroups[0].services.map((service) => ({
      hours: service.duration_hours,
      price: formatKobo(service.price_kobo),
      addon: service.is_addon,
    }))).toEqual(rates.map(({ hours, displayPrice }) => ({
      hours,
      price: displayPrice,
      addon: false,
    })));
    expect(videoPackage.minPriceKobo).toBe(3_000_000);
  });

  it("shows every tier on package details with catalog-only inclusions and a booking CTA", () => {
    const details = findPackageDetails(
      catalog,
      "video-shoot-extra-curricular-activities",
      "video_shoot_extra_curricular_activities",
    );

    expect(details).not.toBeNull();
    if (!details) throw new Error("Expected the active Video Shoot package details.");

    expect(details.category.services.map((service) => service.label)).toEqual(
      rates.map(({ hours }) => `Video Shoot / Extra-Curricular Activities — ${hours}hr`),
    );
    expect(details.category.services.map((service) => formatKobo(service.price_kobo))).toEqual(
      rates.map(({ displayPrice }) => displayPrice),
    );
    expect(details.category.description).toBe(
      "Hourly video shoot and extra-curricular activity sessions.",
    );
    expect(details.pkg.features).toEqual([]);
    expect(packageDetailsHref(details.pkg.slug, details.category.category)).toBe(
      "/services/video-shoot-extra-curricular-activities?category=video_shoot_extra_curricular_activities",
    );
    expect(details.category.services.map((service) => serviceBookingHref(service.id))).toEqual(
      rates.map(({ id }) => `/book?service=${id}`),
    );
  });

  it("keeps the hourly options on the timed-session booking path, not the add-on path", () => {
    const services = buildPackageCatalog(catalog)[0].rateGroups[0].services;

    expect(services.every((service) => !service.is_addon && service.duration_hours > 0)).toBe(true);
  });
});
