import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0045_video_shoot_extra_curricular_rates.sql"),
  "utf8",
);

describe("Video Shoot / Extra-Curricular Activities pricing migration", () => {
  it("adds a public package and booking category with stable identifiers", () => {
    expect(migration).toContain("'video-shoot-extra-curricular-activities'");
    expect(migration).toContain("'video_shoot_extra_curricular_activities'");
    expect(migration).toContain("'Video Shoot / Extra-Curricular Activities'");
    expect(migration).toMatch(/on conflict \(slug\) do update/i);
    expect(migration).toMatch(/on conflict \(category\) do update/i);
  });

  it("seeds all six owner-supplied hourly prices in kobo as bookable sessions", () => {
    const rates = [
      [1, 3_000_000],
      [2, 6_000_000],
      [3, 8_000_000],
      [4, 10_000_000],
      [5, 12_500_000],
      [6, 15_000_000],
    ];

    const serviceInsert = migration.match(
      /insert into public\.services\s*\(([\s\S]*?)\)\s*select([\s\S]*?)\s*from\s+\(values([\s\S]*?)\)\s+as seed\s*\(duration_hours,\s*price_kobo\)/i,
    );

    expect(serviceInsert).not.toBeNull();
    expect(serviceInsert?.[1].split(",").map((column) => column.trim().toLowerCase())).toEqual([
      "category",
      "label",
      "duration_hours",
      "price_kobo",
      "is_addon",
      "active",
    ]);

    for (const [hours, priceKobo] of rates) {
      expect(serviceInsert?.[3]).toMatch(
        new RegExp(`\\(\\s*${hours}::numeric\\s*,\\s*${priceKobo}::bigint\\s*\\)`),
      );
    }

    expect(serviceInsert?.[2]).toMatch(
      /\bseed\.duration_hours\s*,\s*seed\.price_kobo\s*,\s*false\s*,\s*true\b/i,
    );
    expect(migration).toContain("s.duration_hours = seed.duration_hours");
  });

  it("checks for missing, duplicate, or incorrectly priced tiers", () => {
    expect(migration).toContain("count(s.id) <> 1");
    expect(migration).toContain("min(s.price_kobo) is distinct from expected.price_kobo");
    expect(migration).toContain("must contain exactly six hourly service rates");
  });
});
