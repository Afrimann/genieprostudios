import { describe, expect, it } from "vitest";

import type { ServiceCatalog } from "@/lib/repositories/service-repository";
import { findPackageDetails, packageDetailsHref } from "@/lib/services/package-details";

const catalog: ServiceCatalog = {
  packages: [
    {
      id: "digital",
      slug: "digital-production",
      title: "Digital Production",
      subtitle: "Includes mixing and mastering",
      display_order: 0,
      active: true,
      features: [],
      categories: [
        {
          category: "digital_production",
          package_id: "digital",
          label: "Digital Production",
          description: "Includes mixing and mastering, priced per track.",
          display_order: 0,
          active: true,
          services: [{
            id: "track-rate",
            category: "digital_production",
            label: "Digital Production (per track)",
            duration_hours: 0,
            price_kobo: 25_000_000,
            is_addon: true,
            active: true,
          }],
        },
      ],
    },
    {
      id: "video",
      slug: "video-livestream",
      title: "Video Livestream",
      subtitle: null,
      display_order: 1,
      active: true,
      features: [],
      categories: [
        {
          category: "video_livestream_day",
          package_id: "video",
          label: "Video Livestream",
          description: "Standalone livestream.",
          display_order: 0,
          active: true,
          services: [{
            id: "livestream-1hr",
            category: "video_livestream_day",
            label: "Video Livestream — 1hr",
            duration_hours: 1,
            price_kobo: 5_000_000,
            is_addon: false,
            active: true,
          }],
        },
      ],
    },
    {
      id: "mix",
      slug: "mix-master-bundle",
      title: "Mix and Master Bundle",
      subtitle: "Per-song mix and master",
      display_order: 2,
      active: true,
      features: [],
      categories: [{
        category: "post_production",
        package_id: "mix",
        label: "Mix and Master Bundle",
        description: "Per-song mix and master bundle.",
        display_order: 0,
        active: true,
        services: [{
          id: "mix-rate",
          category: "post_production",
          label: "Mix and Master Bundle (per song)",
          duration_hours: 0,
          price_kobo: 15_000_000,
          is_addon: true,
          active: true,
        }],
      }],
    },
    {
      id: "post",
      slug: "post-production-addon",
      title: "Post-Production Add-ons",
      subtitle: "Per-song mixing and mastering",
      display_order: 3,
      active: true,
      features: [],
      categories: [{
        category: "post_production_addons",
        package_id: "post",
        label: "Post-Production Add-ons",
        description: "Mixing and mastering for songs recorded here or sent in remotely.",
        display_order: 0,
        active: true,
        services: [{
          id: "post-rate",
          category: "post_production_addons",
          label: "Mixing & Mastering (per song)",
          duration_hours: 0,
          price_kobo: 8_000_000,
          is_addon: true,
          active: true,
        }],
      }],
    },
  ],
};

describe("package detail navigation and selection", () => {
  it("builds category-specific detail links", () => {
    expect(packageDetailsHref("video-livestream", "video_livestream_day"))
      .toBe("/services/video-livestream?category=video_livestream_day");
    expect(packageDetailsHref("service name", "a&b"))
      .toBe("/services/service%20name?category=a%26b");
  });

  it("selects only the requested active package/category and keeps its exact rate", () => {
    const details = findPackageDetails(catalog, "digital-production", "digital_production");

    expect(details?.pkg.title).toBe("Digital Production");
    expect(details?.category.services[0].price_kobo).toBe(25_000_000);
    expect(details?.category.description).toContain("mixing and mastering");
    expect(findPackageDetails(catalog, "video-livestream", "video_livestream_day")
      ?.category.services[0].price_kobo).toBe(5_000_000);
    expect(findPackageDetails(catalog, "mix-master-bundle")?.category.services[0].price_kobo)
      .toBe(15_000_000);
    expect(findPackageDetails(catalog, "post-production-addon")?.category.services[0].price_kobo)
      .toBe(8_000_000);
    expect(findPackageDetails(catalog, "unknown")).toBeNull();
  });
});
