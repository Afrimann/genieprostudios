import { describe, expect, it } from "vitest";

import type {
  ServiceCatalog,
  ServicePackage,
  ServiceCategory,
} from "@/lib/repositories/service-repository";
import { buildPackageCatalog, serviceRateUnitLabel } from "@/lib/services/package-catalog";
import {
  findPackageDetails,
  packageDetailsHref,
  serviceBookingHref,
} from "@/lib/services/package-details";

type CategorySeed = {
  category: string;
  label: string;
  description?: string;
  rates: Array<[number, number, boolean?]>;
};

function packageSeed(
  slug: string,
  title: string,
  categorySeeds: CategorySeed[],
  featureLabels: string[] = [],
): ServicePackage {
  const categories: ServiceCategory[] = categorySeeds.map((seed, categoryIndex) => ({
    category: seed.category,
    package_id: slug,
    label: seed.label,
    description: seed.description ?? "",
    display_order: categoryIndex,
    active: true,
    services: seed.rates.map(([duration, price, isAddon], rateIndex) => ({
      id: `${seed.category}-${rateIndex + 1}`,
      category: seed.category,
      label: `${seed.label} — ${duration}${duration === 1 ? "hr" : "hrs"}`,
      duration_hours: duration,
      price_kobo: price,
      is_addon: isAddon ?? false,
      active: true,
    })),
  }));
  const features = featureLabels.map((label, index) => ({
    id: `${slug}-feature-${index}`,
    package_id: slug,
    label,
    included: true,
    highlight: false,
    display_order: index,
  }));

  return {
    id: slug,
    slug,
    title,
    subtitle: null,
    display_order: 0,
    active: true,
    categories,
    features,
  };
}

const rehearsal = [
  [1, 3_000_000], [2, 6_000_000], [3, 8_000_000],
  [4, 10_000_000], [5, 12_500_000], [6, 15_000_000],
] as Array<[number, number]>;
const multiTrack = [
  [2, 10_000_000], [3, 15_000_000], [4, 18_000_000],
  [5, 22_000_000], [6, 25_000_000],
] as Array<[number, number]>;
const stereo = [
  [1, 4_000_000], [2, 8_000_000], [3, 10_000_000],
  [4, 14_000_000], [5, 18_000_000], [6, 20_000_000],
] as Array<[number, number]>;
const stereoStreaming = [
  [1, 7_000_000], [2, 13_000_000], [3, 15_000_000],
  [4, 15_000_000], [5, 20_000_000], [6, 20_000_000],
] as Array<[number, number]>;
const videoShoot = [
  [1, 3_000_000], [2, 6_000_000], [3, 8_000_000],
  [4, 10_000_000], [5, 12_500_000], [6, 15_000_000],
] as Array<[number, number]>;

const catalog: ServiceCatalog = {
  packages: [
    packageSeed("rehearsal", "Rehearsal Sessions", [
      { category: "rehearsal_day", label: "Rehearsal Day", rates: rehearsal },
      { category: "rehearsal_night", label: "Rehearsal Night", rates: [[4, 8_000_000], [6, 10_000_000]] },
    ]),
    packageSeed("multitrack", "Multi-track Recording", [
      { category: "multitrack_day", label: "Multi-track Day", rates: multiTrack },
      { category: "multitrack_night", label: "Multi-track Night", rates: multiTrack },
    ]),
    packageSeed("virtual-session", "Stereo Recording Session", [
      { category: "virtual_package_day", label: "Stereo Recording Session Day", rates: stereo },
      { category: "virtual_package_night", label: "Stereo Recording Session Night", rates: stereo },
    ]),
    packageSeed("stereo-recording-streaming", "Stereo Recording Session + 1-Camera Streaming", [
      { category: "stereo_recording_streaming_day", label: "Stereo Recording + Streaming Day", rates: stereoStreaming },
      { category: "stereo_recording_streaming_night", label: "Stereo Recording + Streaming Night", rates: stereoStreaming },
    ], ["Stereo recording", "One-camera streaming", "All listed hourly prices are exact combined totals"]),
    packageSeed("acoustic-spontaneous-live-studio-cover", "Acoustic / Spontaneous Live Studio Cover Session", [{
      category: "acoustic_spontaneous_live_studio_cover",
      label: "Acoustic / Spontaneous Live Studio Cover Session",
      description: "Includes mix and master, clean iPhone video, and a 10–15 minute mixed audio/video output.",
      rates: [[1, 10_000_000]],
    }], ["Mix and master included", "Clean iPhone video included", "10–15 minute mixed audio/video output included"]),
    packageSeed("digital-acoustic-spontaneous-session", "Digital Acoustic / Spontaneous Session", [{
      category: "digital_acoustic_spontaneous",
      label: "Digital Acoustic / Spontaneous Session",
      description: "Includes mix and master, clean iPhone video, and a 10–15 minute mixed audio/video output.",
      rates: [[1, 5_000_000]],
    }], ["Mix and master included", "Clean iPhone video included", "10–15 minute mixed audio/video output included"]),
    packageSeed("worship-medley-multitrack", "Worship Medley Multitrack", [{
      category: "worship_medley_multitrack",
      label: "Worship Medley Multitrack",
      description: "Includes mix and master and clean iPhone video.",
      rates: [[1, 20_000_000]],
    }], ["Multitrack recording", "Mix and master included", "Clean iPhone video included"]),
    packageSeed("video-shoot-extra-curricular-activities", "Video Shoot / Extra-Curricular Activities", [{
      category: "video_shoot_extra_curricular_activities",
      label: "Video Shoot / Extra-Curricular Activities",
      rates: videoShoot,
    }]),
    packageSeed("digital-production", "Digital Production", [{
      category: "digital_production",
      label: "Digital Production",
      rates: [[0, 25_000_000, true]],
    }]),
    packageSeed("mix-master-bundle", "Mix and Master Bundle", [{
      category: "post_production",
      label: "Mix and Master Bundle",
      rates: [[0, 15_000_000, true]],
    }]),
    packageSeed("post-production-addon", "Post-Production Add-ons", [{
      category: "post_production_addons",
      label: "Post-Production Add-ons",
      rates: [[0, 8_000_000, true]],
    }]),
    packageSeed("video-livestream", "Video Livestream", [{
      category: "video_livestream_day",
      label: "Video Livestream",
      rates: [[1, 5_000_000], [2, 8_000_000]],
    }]),
  ],
};

describe("approved service catalog frontend integration", () => {
  it("exposes every approved category and exact rates in the catalog and booking selector", () => {
    const packages = buildPackageCatalog(catalog);
    const categoryKeys = packages.flatMap((pkg) => pkg.rateGroups.map((group) => group.category));

    expect(categoryKeys).toEqual([
      "rehearsal_day", "rehearsal_night",
      "multitrack_day", "multitrack_night",
      "virtual_package_day", "virtual_package_night",
      "stereo_recording_streaming_day", "stereo_recording_streaming_night",
      "acoustic_spontaneous_live_studio_cover", "digital_acoustic_spontaneous",
      "worship_medley_multitrack", "video_shoot_extra_curricular_activities",
      "digital_production", "post_production", "post_production_addons",
      "video_livestream_day",
    ]);

    const pricesByCategory = Object.fromEntries(
      packages.flatMap((pkg) => pkg.rateGroups.map((group) => [
        group.category,
        group.services.map((service) => [service.duration_hours, service.price_kobo, service.is_addon]),
      ])),
    );
    const sessionRates = (rates: Array<[number, number]>) => rates.map(([hours, price]) => [hours, price, false]);

    expect(pricesByCategory).toEqual({
      rehearsal_day: sessionRates(rehearsal),
      rehearsal_night: sessionRates([[4, 8_000_000], [6, 10_000_000]]),
      multitrack_day: sessionRates(multiTrack),
      multitrack_night: sessionRates(multiTrack),
      virtual_package_day: sessionRates(stereo),
      virtual_package_night: sessionRates(stereo),
      stereo_recording_streaming_day: sessionRates(stereoStreaming),
      stereo_recording_streaming_night: sessionRates(stereoStreaming),
      acoustic_spontaneous_live_studio_cover: [[1, 10_000_000, false]],
      digital_acoustic_spontaneous: [[1, 5_000_000, false]],
      worship_medley_multitrack: [[1, 20_000_000, false]],
      video_shoot_extra_curricular_activities: sessionRates(videoShoot),
      digital_production: [[0, 25_000_000, true]],
      post_production: [[0, 15_000_000, true]],
      post_production_addons: [[0, 8_000_000, true]],
      video_livestream_day: [[1, 5_000_000, false], [2, 8_000_000, false]],
    });

    expect(packages.find((pkg) => pkg.content.slug === "virtual-session")?.content.title)
      .toBe("Stereo Recording Session");
  });

  it("links each category to its exact details and every rate CTA to its own service", () => {
    const packages = buildPackageCatalog(catalog);

    for (const pkg of packages) {
      for (const group of pkg.rateGroups) {
        const details = findPackageDetails(catalog, pkg.content.slug, group.category);
        expect(details?.category.category).toBe(group.category);
        expect(packageDetailsHref(pkg.content.slug, group.category))
          .toBe(`/services/${pkg.content.slug}?category=${group.category}`);
        expect(group.services.map((service) => serviceBookingHref(service.id)))
          .toEqual(group.services.map((service) => `/book?service=${service.id}`));
      }
    }

    expect(serviceRateUnitLabel(catalog.packages[8].categories[0].services[0])).toBe("per track");
    expect(serviceRateUnitLabel(catalog.packages[9].categories[0].services[0])).toBe("per song");
    expect(serviceRateUnitLabel(catalog.packages[0].categories[0].services[0])).toBe("1 hour");
  });

  it("shows only the approved known inclusions for the fixed-session offers", () => {
    const streaming = findPackageDetails(
      catalog,
      "stereo-recording-streaming",
      "stereo_recording_streaming_day",
    );
    expect(streaming?.pkg.features.map((feature) => feature.label)).toEqual([
      "Stereo recording",
      "One-camera streaming",
      "All listed hourly prices are exact combined totals",
    ]);

    const knownDetails = [
      ["acoustic-spontaneous-live-studio-cover", "acoustic_spontaneous_live_studio_cover", [
        "Mix and master included", "Clean iPhone video included",
        "10–15 minute mixed audio/video output included",
      ]],
      ["digital-acoustic-spontaneous-session", "digital_acoustic_spontaneous", [
        "Mix and master included", "Clean iPhone video included",
        "10–15 minute mixed audio/video output included",
      ]],
      ["worship-medley-multitrack", "worship_medley_multitrack", [
        "Multitrack recording", "Mix and master included", "Clean iPhone video included",
      ]],
    ] as const;

    for (const [slug, category, inclusions] of knownDetails) {
      const details = findPackageDetails(catalog, slug, category);
      expect(details?.pkg.features.map((feature) => feature.label)).toEqual(inclusions);
      expect(details?.category.services).toHaveLength(1);
      expect(details?.category.services[0].duration_hours).toBe(1);
    }
  });
});
