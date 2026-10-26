"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceCategory,
  createServiceFeature,
  createServicePackage,
  createServiceRate,
  deleteServiceFeature,
  getServiceCatalog,
  updateServiceCategory,
  updateServiceFeature,
  updateServicePackage,
  updateServiceRate,
} from "@/lib/repositories/service-repository";
import {
  createServiceCategorySchema,
  createServiceFeatureSchema,
  createServicePackageSchema,
  createServiceRateSchema,
  updateServiceCategorySchema,
  updateServiceFeatureSchema,
  updateServicePackageSchema,
  updateServiceRateSchema,
} from "@/lib/validation/service-catalog";

export type ServiceCatalogActionResult<T> =
  | { success: true; value: T }
  | { success: false; message: string };

function validationMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the entered values and try again.";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function refreshCatalogPages() {
  revalidatePath("/services");
  revalidatePath("/book");
  revalidatePath("/");
}

async function assertAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sign in with an administrator account to manage services.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    throw new Error("Administrator access is required to manage services.");
  }
}

export async function fetchServiceCatalogAction(includeInactive = false) {
  try {
    if (includeInactive) await assertAdmin();
    return { success: true as const, catalog: await getServiceCatalog({ includeInactive }) };
  } catch (error) {
    return { success: false as const, message: errorMessage(error, "Could not load services.") };
  }
}

export async function createServicePackageAction(input: unknown): Promise<ServiceCatalogActionResult<unknown>> {
  const parsed = createServicePackageSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const value = await createServicePackage(parsed.data);
    refreshCatalogPages();
    return { success: true, value };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not create this package.") };
  }
}

export async function updateServicePackageAction(input: unknown): Promise<ServiceCatalogActionResult<true>> {
  const parsed = updateServicePackageSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const { id, ...patch } = parsed.data;
    if (!(await updateServicePackage(id, patch))) {
      return { success: false, message: "This package could not be found." };
    }
    refreshCatalogPages();
    return { success: true, value: true };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not update this package.") };
  }
}

export async function createServiceCategoryAction(input: unknown): Promise<ServiceCatalogActionResult<unknown>> {
  const parsed = createServiceCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const value = await createServiceCategory(parsed.data);
    refreshCatalogPages();
    return { success: true, value };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not add this category.") };
  }
}

export async function updateServiceCategoryAction(input: unknown): Promise<ServiceCatalogActionResult<true>> {
  const parsed = updateServiceCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const { category, ...patch } = parsed.data;
    if (!(await updateServiceCategory(category, patch))) {
      return { success: false, message: "This category could not be found." };
    }
    refreshCatalogPages();
    return { success: true, value: true };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not update this category.") };
  }
}

export async function createServiceFeatureAction(input: unknown): Promise<ServiceCatalogActionResult<unknown>> {
  const parsed = createServiceFeatureSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const value = await createServiceFeature(parsed.data);
    refreshCatalogPages();
    return { success: true, value };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not add this feature.") };
  }
}

export async function updateServiceFeatureAction(input: unknown): Promise<ServiceCatalogActionResult<true>> {
  const parsed = updateServiceFeatureSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const { id, ...patch } = parsed.data;
    if (!(await updateServiceFeature(id, patch))) {
      return { success: false, message: "This feature could not be found." };
    }
    refreshCatalogPages();
    return { success: true, value: true };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not update this feature.") };
  }
}

export async function deleteServiceFeatureAction(id: string): Promise<ServiceCatalogActionResult<true>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { success: false, message: "Choose a valid feature." };
  }
  try {
    await assertAdmin();
    if (!(await deleteServiceFeature(id))) {
      return { success: false, message: "This feature could not be found." };
    }
    refreshCatalogPages();
    return { success: true, value: true };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not remove this feature.") };
  }
}

export async function createServiceRateAction(input: unknown): Promise<ServiceCatalogActionResult<unknown>> {
  const parsed = createServiceRateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const { priceNaira, ...service } = parsed.data;
    const value = await createServiceRate({ ...service, priceKobo: Math.round(priceNaira * 100) });
    refreshCatalogPages();
    return { success: true, value };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not add this service rate.") };
  }
}

export async function updateServiceRateAction(input: unknown): Promise<ServiceCatalogActionResult<true>> {
  const parsed = updateServiceRateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: validationMessage(parsed.error) };
  try {
    await assertAdmin();
    const { id, priceNaira, ...patch } = parsed.data;
    if (!(await updateServiceRate(
      id,
      priceNaira === undefined ? patch : { ...patch, priceKobo: Math.round(priceNaira * 100) },
    ))) {
      return { success: false, message: "This service rate could not be found." };
    }
    refreshCatalogPages();
    return { success: true, value: true };
  } catch (error) {
    return { success: false, message: errorMessage(error, "Could not update this service rate.") };
  }
}
