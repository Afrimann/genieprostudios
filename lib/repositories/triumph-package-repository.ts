import { createClient } from "@/lib/supabase/server";

// Mirrors public.triumph_packages (see
// supabase/migrations/0041_triumph_packages.sql). Pure data access, no
// business rules — same "dumb CRUD" convention as equipment-repository.ts.
export type TriumphPackage = {
  id: string;
  slug: string;
  name: string;
  price_usd: number;
  unit: string;
  description: string;
  turnaround: string;
  featured: boolean;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Active tiers only, ordered for display — what the public /triumph pricing
 * section renders. Relies on the triumph_packages_select_public RLS policy
 * (0041), which only exposes active=true rows to anon+authenticated.
 */
export async function getActiveTriumphPackages(): Promise<TriumphPackage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_packages")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`getActiveTriumphPackages: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Every tier, including inactive ones — for the admin manager. Relies on
 * the triumph_packages_select_admin RLS policy (0041), gated on
 * public.is_admin().
 */
export async function getAllTriumphPackages(): Promise<TriumphPackage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_packages")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`getAllTriumphPackages: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Looks up a tier's display name by slug — the single source of truth for
 * "what does this triumph_projects.service_id actually mean," replacing
 * every former `TRIUMPH_PRICING_TIERS.find((tier) => tier.id === ...)`
 * call site. Pass in a list already fetched with getAllTriumphPackages()
 * (not just the active ones) so a project referencing a since-hidden tier
 * still resolves to a real name instead of falling back to the raw slug.
 */
export function packageLabelForSlug(packages: TriumphPackage[], slug: string): string {
  return packages.find((p) => p.slug === slug)?.name ?? slug;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "package"
  );
}

export type CreateTriumphPackageInput = {
  name: string;
  priceUsd: number;
  unit: string;
  description: string;
  turnaround: string;
  featured: boolean;
  displayOrder: number;
};

/**
 * Admin-only: inserts a new pricing tier. Relies on the
 * triumph_packages_insert_admin RLS policy (0041). Slug is derived from
 * `name` and never exposed for editing — see the column comment in
 * 0041_triumph_packages.sql on why it must stay stable once a project has
 * potentially referenced it.
 */
export async function createTriumphPackage(
  input: CreateTriumphPackageInput,
): Promise<TriumphPackage> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("triumph_packages")
    .select("slug");

  if (existingError) {
    throw new Error(`createTriumphPackage: ${existingError.message}`);
  }

  const existingSlugs = new Set((existing ?? []).map((row) => row.slug as string));
  const base = slugify(input.name);
  let slug = base;
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabase
    .from("triumph_packages")
    .insert({
      slug,
      name: input.name,
      price_usd: input.priceUsd,
      unit: input.unit,
      description: input.description,
      turnaround: input.turnaround,
      featured: input.featured,
      display_order: input.displayOrder,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createTriumphPackage: ${error.message}`);
  }

  return data;
}

export type UpdateTriumphPackageInput = {
  name?: string;
  priceUsd?: number;
  unit?: string;
  description?: string;
  turnaround?: string;
  featured?: boolean;
  displayOrder?: number;
  active?: boolean;
};

/**
 * Admin-only: updates an existing pricing tier. Relies on the
 * triumph_packages_update_admin RLS policy (0041). Returns null (not a
 * throw) if the id doesn't exist, same "not found is not an error"
 * convention as updateEquipmentItem.
 */
export async function updateTriumphPackage(
  id: string,
  input: UpdateTriumphPackageInput,
): Promise<TriumphPackage | null> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.priceUsd !== undefined) patch.price_usd = input.priceUsd;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.description !== undefined) patch.description = input.description;
  if (input.turnaround !== undefined) patch.turnaround = input.turnaround;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await supabase
    .from("triumph_packages")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`updateTriumphPackage: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Admin-only: deletes a pricing tier. Relies on the
 * triumph_packages_delete_admin RLS policy (0041). Returns true if a row
 * was actually deleted, false if no row matched.
 */
export async function deleteTriumphPackage(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_packages")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`deleteTriumphPackage: ${error.message}`);
  }

  return data !== null;
}
