import { createClient } from "@/lib/supabase/server";

// Mirrors public.services (see supabase/migrations/0002_services.sql).
// price_kobo/duration_hours come back from PostgREST as string/number
// depending on driver config — typed loosely here (number) to match
// @supabase/supabase-js's default bigint-as-number behavior; if this ever
// needs to represent values beyond Number.MAX_SAFE_INTEGER, revisit as
// string and parse with BigInt() at the call site instead.
export type Service = {
  id: string;
  category: string;
  label: string;
  duration_hours: number;
  price_kobo: number;
  is_addon: boolean;
  active: boolean;
};

export type ServicePackageFeature = {
  id: string;
  package_id: string;
  label: string;
  included: boolean;
  highlight: boolean;
  display_order: number;
};

export type ServiceCategory = {
  category: string;
  package_id: string;
  label: string;
  description: string;
  display_order: number;
  active: boolean;
  services: Service[];
};

export type ServicePackage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  display_order: number;
  active: boolean;
  categories: ServiceCategory[];
  features: ServicePackageFeature[];
};

export type ServiceCatalog = {
  packages: ServicePackage[];
};

export type CreateServicePackageInput = {
  title: string;
  subtitle: string;
};

export type UpdateServicePackageInput = Partial<CreateServicePackageInput> & {
  displayOrder?: number;
  active?: boolean;
};

export type CreateServiceCategoryInput = {
  packageId: string;
  category: string;
  label: string;
  description: string;
};

export type UpdateServiceCategoryInput = {
  label?: string;
  description?: string;
  displayOrder?: number;
  active?: boolean;
};

export type CreateServiceFeatureInput = {
  packageId: string;
  label: string;
  included: boolean;
  highlight: boolean;
};

export type UpdateServiceFeatureInput = Partial<Omit<CreateServiceFeatureInput, "packageId">> & {
  displayOrder?: number;
};

export type CreateServiceRateInput = {
  category: string;
  label: string;
  durationHours: number;
  priceKobo: number;
  isAddon: boolean;
};

export type UpdateServiceRateInput = Partial<Omit<CreateServiceRateInput, "category">> & {
  active?: boolean;
};

type CatalogOptions = {
  includeInactive?: boolean;
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function createServicePackage(
  input: CreateServicePackageInput,
): Promise<ServicePackage> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("service_packages")
    .select("slug, display_order");
  if (existingError) throw new Error(`createServicePackage: ${existingError.message}`);

  const existingSlugs = new Set((existing ?? []).map((row) => row.slug as string));
  const base = slugify(input.title) || "service-package";
  let slug = base;
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  const displayOrder = Math.max(
    -1,
    ...((existing ?? []).map((row) => row.display_order as number | undefined).filter(
      (order): order is number => order !== undefined,
    )),
  ) + 1;

  const { data, error } = await supabase
    .from("service_packages")
    .insert({ slug, title: input.title, subtitle: input.subtitle || null, display_order: displayOrder })
    .select("*")
    .single();
  if (error) throw new Error(`createServicePackage: ${error.message}`);

  return { ...data, categories: [], features: [] };
}

export async function updateServicePackage(
  id: string,
  input: UpdateServicePackageInput,
): Promise<boolean> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle || null;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await supabase
    .from("service_packages")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`updateServicePackage: ${error.message}`);
  return data !== null;
}

export async function createServiceCategory(
  input: CreateServiceCategoryInput,
): Promise<ServiceCategory> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("service_categories")
    .select("display_order")
    .eq("package_id", input.packageId);
  if (existingError) throw new Error(`createServiceCategory: ${existingError.message}`);
  const displayOrder = Math.max(-1, ...(existing ?? []).map((row) => row.display_order)) + 1;

  const { data, error } = await supabase
    .from("service_categories")
    .insert({
      category: input.category,
      package_id: input.packageId,
      label: input.label,
      description: input.description,
      display_order: displayOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createServiceCategory: ${error.message}`);
  return { ...data, services: [] };
}

export async function updateServiceCategory(
  category: string,
  input: UpdateServiceCategoryInput,
): Promise<boolean> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.description !== undefined) patch.description = input.description;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await supabase
    .from("service_categories")
    .update(patch)
    .eq("category", category)
    .select("category")
    .maybeSingle();
  if (error) throw new Error(`updateServiceCategory: ${error.message}`);
  return data !== null;
}

export async function createServiceFeature(
  input: CreateServiceFeatureInput,
): Promise<ServicePackageFeature> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("service_package_features")
    .select("display_order")
    .eq("package_id", input.packageId);
  if (existingError) throw new Error(`createServiceFeature: ${existingError.message}`);
  const displayOrder = Math.max(-1, ...(existing ?? []).map((row) => row.display_order)) + 1;

  const { data, error } = await supabase
    .from("service_package_features")
    .insert({
      package_id: input.packageId,
      label: input.label,
      included: input.included,
      highlight: input.highlight,
      display_order: displayOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createServiceFeature: ${error.message}`);
  return data;
}

export async function updateServiceFeature(
  id: string,
  input: UpdateServiceFeatureInput,
): Promise<boolean> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.included !== undefined) patch.included = input.included;
  if (input.highlight !== undefined) patch.highlight = input.highlight;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;

  const { data, error } = await supabase
    .from("service_package_features")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`updateServiceFeature: ${error.message}`);
  return data !== null;
}

export async function deleteServiceFeature(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_package_features")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`deleteServiceFeature: ${error.message}`);
  return data !== null;
}

export async function createServiceRate(input: CreateServiceRateInput): Promise<Service> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      category: input.category,
      label: input.label,
      duration_hours: input.durationHours,
      price_kobo: input.priceKobo,
      is_addon: input.isAddon,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createServiceRate: ${error.message}`);
  return data;
}

export async function updateServiceRate(
  id: string,
  input: UpdateServiceRateInput,
): Promise<boolean> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.durationHours !== undefined) patch.duration_hours = input.durationHours;
  if (input.priceKobo !== undefined) patch.price_kobo = input.priceKobo;
  if (input.isAddon !== undefined) patch.is_addon = input.isAddon;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await supabase
    .from("services")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`updateServiceRate: ${error.message}`);
  return data !== null;
}

/**
 * Reads package presentation data, category groupings, features, and their
 * service rates from the managed catalog. Public callers see active records
 * through RLS; admin callers can request inactive rows as well.
 */
export async function getServiceCatalog(
  { includeInactive = false }: CatalogOptions = {},
): Promise<ServiceCatalog> {
  const supabase = await createClient();

  const [packageResult, categoryResult, featureResult, serviceResult] = await Promise.all([
    supabase.from("service_packages").select("*").order("display_order", { ascending: true }),
    supabase.from("service_categories").select("*").order("display_order", { ascending: true }),
    supabase
      .from("service_package_features")
      .select("*")
      .order("display_order", { ascending: true }),
    supabase.from("services").select("*").order("duration_hours", { ascending: true }),
  ]);

  if (packageResult.error) {
    throw new Error(`getServiceCatalog: ${packageResult.error.message}`);
  }
  if (categoryResult.error) {
    throw new Error(`getServiceCatalog: ${categoryResult.error.message}`);
  }
  if (featureResult.error) {
    throw new Error(`getServiceCatalog: ${featureResult.error.message}`);
  }
  if (serviceResult.error) {
    throw new Error(`getServiceCatalog: ${serviceResult.error.message}`);
  }

  const categoriesByPackage = new Map<string, ServiceCategory[]>();
  for (const row of categoryResult.data ?? []) {
    if (!includeInactive && !row.active) continue;
    const category: ServiceCategory = {
      category: row.category,
      package_id: row.package_id,
      label: row.label,
      description: row.description,
      display_order: row.display_order,
      active: row.active,
      services: (serviceResult.data ?? []).filter(
        (service) =>
          service.category === row.category &&
          (includeInactive || service.active),
      ),
    };
    const categories = categoriesByPackage.get(row.package_id) ?? [];
    categories.push(category);
    categoriesByPackage.set(row.package_id, categories);
  }

  const featuresByPackage = new Map<string, ServicePackageFeature[]>();
  for (const feature of featureResult.data ?? []) {
    const features = featuresByPackage.get(feature.package_id) ?? [];
    features.push(feature);
    featuresByPackage.set(feature.package_id, features);
  }

  return {
    packages: (packageResult.data ?? [])
      .filter((pkg) => includeInactive || pkg.active)
      .map((pkg) => ({
        ...pkg,
        categories: categoriesByPackage.get(pkg.id) ?? [],
        features: featuresByPackage.get(pkg.id) ?? [],
      })),
  };
}

/**
 * Reads active service rates from active package/category records, ordered
 * by category then duration for the booking and customer pricing lists.
 */
export async function getActiveServices(): Promise<Service[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, category, label, duration_hours, price_kobo, is_addon, active, service_categories!inner(active, service_packages!inner(active))",
    )
    .eq("active", true)
    .eq("service_categories.active", true)
    .eq("service_categories.service_packages.active", true)
    .order("category", { ascending: true })
    .order("duration_hours", { ascending: true });

  if (error) throw new Error(`getActiveServices: ${error.message}`);

  return (data ?? []).map(({ id, category, label, duration_hours, price_kobo, is_addon, active }) => ({
    id,
    category,
    label,
    duration_hours,
    price_kobo,
    is_addon,
    active,
  }));
}

/**
 * Reads a service only when its rate, category, and parent package are all
 * active. Returns null for missing, archived, or stale service IDs.
 */
export async function getServiceById(serviceId: string): Promise<Service | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, category, label, duration_hours, price_kobo, is_addon, active, service_categories!inner(active, service_packages!inner(active))",
    )
    .eq("id", serviceId)
    .eq("active", true)
    .eq("service_categories.active", true)
    .eq("service_categories.service_packages.active", true)
    .maybeSingle();

  if (error) throw new Error(`getServiceById: ${error.message}`);
  if (!data) return null;
  const { id, category, label, duration_hours, price_kobo, is_addon, active } = data;
  return { id, category, label, duration_hours, price_kobo, is_addon, active };
}
