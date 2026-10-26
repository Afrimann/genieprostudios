import { describe, expect, it } from "vitest";

import type { ServiceCatalog } from "@/lib/repositories/service-repository";
import { buildPackageCatalog } from "@/lib/services/package-catalog";
import {
  createServiceCategorySchema,
  createServiceRateSchema,
} from "@/lib/validation/service-catalog";

const catalog: ServiceCatalog = {
  packages: [
    {
      id: "package-1",
      slug: "recording",
      title: "Recording",
      subtitle: null,
      display_order: 0,
      active: true,
      features: [
        {
          id: "feature-1",
          package_id: "package-1",
          label: "Stereo recording",
          included: true,
          highlight: false,
          display_order: 0,
        },
      ],
      categories: [
        {
          category: "recording_day",
          package_id: "package-1",
          label: "Day",
          description: "",
          display_order: 0,
          active: true,
          services: [
            {
              id: "service-1",
              category: "recording_day",
              label: "Two hours",
              duration_hours: 2,
              price_kobo: 100_000,
              is_addon: false,
              active: true,
            },
            {
              id: "service-2",
              category: "recording_day",
              label: "Four hours",
              duration_hours: 4,
              price_kobo: 200_000,
              is_addon: false,
              active: true,
            },
          ],
        },
        {
          category: "recording_night",
          package_id: "package-1",
          label: "Night",
          description: "",
          display_order: 1,
          active: true,
          services: [
            {
              id: "service-3",
              category: "recording_night",
              label: "Night session",
              duration_hours: 4,
              price_kobo: 150_000,
              is_addon: false,
              active: true,
            },
          ],
        },
      ],
    },
    {
      id: "package-2",
      slug: "archived",
      title: "Archived",
      subtitle: null,
      display_order: 1,
      active: false,
      categories: [],
      features: [],
    },
  ],
};

describe("buildPackageCatalog", () => {
  it("groups active service rates by managed package and category", () => {
    const result = buildPackageCatalog(catalog);

    expect(result).toHaveLength(1);
    expect(result[0].content.title).toBe("Recording");
    expect(result[0].rateGroups.map((group) => group.label)).toEqual(["Day", "Night"]);
    expect(result[0].minPriceKobo).toBe(100_000);
  });

  it("omits categories without rates and packages without active rates", () => {
    const emptyCatalog: ServiceCatalog = {
      packages: [{
        ...catalog.packages[0],
        categories: [{
          ...catalog.packages[0].categories[0],
          services: [],
        }],
      }],
    };

    expect(buildPackageCatalog(emptyCatalog)).toEqual([]);
  });

  it("does not make archived packages bookable", () => {
    expect(buildPackageCatalog({
      packages: [{ ...catalog.packages[0], active: false }],
    })).toEqual([]);
  });
});

describe("service catalog validation", () => {
  it("accepts a new category with a stable lowercase key", () => {
    expect(
      createServiceCategorySchema.safeParse({
        packageId: "11111111-1111-4111-8111-111111111111",
        category: "weekend_rehearsal",
        label: "Weekend Rehearsal",
        description: "",
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe category keys", () => {
    expect(
      createServiceCategorySchema.safeParse({
        packageId: "11111111-1111-4111-8111-111111111111",
        category: "Weekend Rehearsal",
        label: "Weekend Rehearsal",
        description: "",
      }).success,
    ).toBe(false);
  });

  it("requires a duration for a bookable session and zero duration for per-song add-ons", () => {
    const base = {
      category: "post_production",
      label: "Mixing",
      priceNaira: 12_500,
      isAddon: true,
    };
    expect(createServiceRateSchema.safeParse({ ...base, durationHours: 0 }).success).toBe(true);
    expect(createServiceRateSchema.safeParse({ ...base, durationHours: 1 }).success).toBe(false);
    expect(createServiceRateSchema.safeParse({ ...base, isAddon: false, durationHours: 0 }).success).toBe(false);
  });
});
