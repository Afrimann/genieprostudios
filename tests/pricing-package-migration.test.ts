import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0044_pricing_package_plan.sql"),
  "utf8",
);

describe("approved pricing/package migration", () => {
  it("renames the existing Virtual package to Stereo Recording Session", () => {
    expect(migration).toContain("title = 'Stereo Recording Session'");
    expect(migration).toContain("'Stereo Recording Session — Day'");
    expect(migration).toContain("'Stereo Recording Session — Night'");
    expect(migration).not.toContain("video_livestream_day");
  });

  it("keeps the existing per-song offers separate at the exact supplied prices", () => {
    expect(migration).toContain("title = 'Mix and Master Bundle'");
    expect(migration).toContain("price_kobo = 15000000");
    expect(migration).toContain("title = 'Post-Production Add-ons'");
    expect(migration).toContain("price_kobo = 8000000");
    expect(migration).toContain("category = 'post_production_addons'");
    expect(migration).toContain("id <> v_bundle_id");
    expect(migration).toContain("expected at most one existing Post-Production Add-on service");
    expect(migration).toMatch(
      /values\s*\(\s*'post_production_addons',\s*'Mixing & Mastering \(per song\)',\s*0,\s*8000000,\s*true,\s*true\s*\);/,
    );
  });

  it("adds Digital Production at exactly ₦250,000 per track with mixing/mastering", () => {
    expect(migration).toContain("'Digital Production'");
    expect(migration).toContain("including mixing and mastering");
    expect(migration).toContain("'Digital Production (per track)'");
    expect(migration).toMatch(
      /insert into public\.services\s*\(\s*category,\s*label,\s*duration_hours,\s*price_kobo,\s*is_addon,\s*active\s*\)\s*select\s*'digital_production',\s*'Digital Production \(per track\)',\s*0,\s*25000000,\s*true,\s*true/,
    );
  });

  it("defers Video Shoot rates to the additive 0045 migration", () => {
    expect(migration).toContain("0045_video_shoot_extra_curricular_rates.sql");
  });
});
