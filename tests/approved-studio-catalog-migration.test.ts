import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0046_approved_studio_catalog.sql"),
  "utf8",
);
const videoShootMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0045_video_shoot_extra_curricular_rates.sql"),
  "utf8",
);
const originalServicesMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0002_services.sql"),
  "utf8",
);

function expectedRates(category: string, rows: Array<[number, number]>) {
  for (const [hours, priceKobo] of rows) {
    expect(migration).toMatch(
      new RegExp(
        `\\('${category}',\\s*'[^']+',\\s*${hours}::numeric,\\s*${priceKobo}::bigint,\\s*(?:false|true)\\)`,
      ),
    );
  }
}

describe("approved studio catalog migration", () => {
  it("defines exact bookable day/night session durations and prices", () => {
    expectedRates("rehearsal_day", [
      [1, 3_000_000], [2, 6_000_000], [3, 8_000_000],
      [4, 10_000_000], [5, 12_500_000], [6, 15_000_000],
    ]);
    expectedRates("rehearsal_night", [[4, 8_000_000], [6, 10_000_000]]);

    const multitrack = [
      [2, 10_000_000], [3, 15_000_000], [4, 18_000_000],
      [5, 22_000_000], [6, 25_000_000],
    ] as Array<[number, number]>;
    expectedRates("multitrack_day", multitrack);
    expectedRates("multitrack_night", multitrack);

    const stereo = [
      [1, 4_000_000], [2, 8_000_000], [3, 10_000_000],
      [4, 14_000_000], [5, 18_000_000], [6, 20_000_000],
    ] as Array<[number, number]>;
    expectedRates("virtual_package_day", stereo);
    expectedRates("virtual_package_night", stereo);

    const streaming = [
      [1, 7_000_000], [2, 13_000_000], [3, 15_000_000],
      [4, 15_000_000], [5, 20_000_000], [6, 20_000_000],
    ] as Array<[number, number]>;
    expectedRates("stereo_recording_streaming_day", streaming);
    expectedRates("stereo_recording_streaming_night", streaming);
  });

  it("sets the fixed-session and post-production prices with the right units", () => {
    expectedRates("acoustic_spontaneous_live_studio_cover", [[1, 10_000_000]]);
    expectedRates("digital_acoustic_spontaneous", [[1, 5_000_000]]);
    expectedRates("worship_medley_multitrack", [[1, 20_000_000]]);
    expectedRates("digital_production", [[0, 25_000_000]]);
    expectedRates("post_production", [[0, 15_000_000]]);
    expectedRates("post_production_addons", [[0, 8_000_000]]);

    expect(migration).toContain("'Digital Production (per track)'");
    expect(migration).toContain("'Mix and Master Bundle (per song)'");
    expect(migration).toContain("'Mixing & Mastering (per song)'");
    expect(migration).toContain("bool_and(s.is_addon) is distinct from expected.is_addon");
    expect(migration).toContain("0::numeric, 25000000::bigint, true");
  });

  it("adds stable active package/category identifiers and required inclusions", () => {
    const packageCategories = [
      ["stereo-recording-streaming", "stereo_recording_streaming_day"],
      ["stereo-recording-streaming", "stereo_recording_streaming_night"],
      ["acoustic-spontaneous-live-studio-cover", "acoustic_spontaneous_live_studio_cover"],
      ["digital-acoustic-spontaneous-session", "digital_acoustic_spontaneous"],
      ["worship-medley-multitrack", "worship_medley_multitrack"],
    ];
    for (const [slug, category] of packageCategories) {
      expect(migration).toContain(`'${slug}'`);
      expect(migration).toContain(`'${category}'`);
    }

    for (const inclusion of [
      "Mix and master included",
      "Clean iPhone video included",
      "10–15 minute mixed audio/video output included",
      "One-camera streaming",
      "All listed hourly prices are exact combined totals",
      "Multitrack recording",
    ]) {
      expect(migration).toContain(inclusion);
    }
    expect(migration).toContain("Prices are exact all-in totals");
    expect(migration).toContain("on conflict (slug) do update");
    expect(migration).toContain("on conflict (category) do update");
    expect(migration).toContain("count(s.id) <> 1");
    expect(migration).toContain("is distinct from expected.price_kobo");
  });

  it("retains the already-approved Video Shoot tiers and never alters standalone Video Livestream", () => {
    for (const [hours, priceKobo] of [
      [1, 3_000_000], [2, 6_000_000], [3, 8_000_000],
      [4, 10_000_000], [5, 12_500_000], [6, 15_000_000],
    ]) {
      expect(videoShootMigration).toMatch(
        new RegExp(`\\(${hours}::numeric,\\s*${priceKobo}::bigint\\)`),
      );
    }

    expect(migration).not.toContain("video_livestream");
    expect(migration).not.toContain("video-livestream");
    expect(originalServicesMigration).toContain(
      "('video_livestream_day', 'Video Livestream Day — 1hr', 1, 5000000, false, true)",
    );
    expect(originalServicesMigration).toContain(
      "('video_livestream_day', 'Video Livestream Day — 2hrs', 2, 8000000, false, true)",
    );
  });
});
