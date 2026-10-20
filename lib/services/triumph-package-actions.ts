"use server";

// Server Action boundary between the Triumph admin Client Component and the
// triumph-package repository (which uses createClient() from
// lib/supabase/server.ts and therefore can only run server-side). Mirrors
// equipment-actions.ts's pattern: thin wrappers, never throw for expected
// failures, always return a typed result the UI can branch on.

import {
  getActiveTriumphPackages,
  getAllTriumphPackages,
  createTriumphPackage,
  updateTriumphPackage,
  deleteTriumphPackage,
  type TriumphPackage,
  type CreateTriumphPackageInput,
  type UpdateTriumphPackageInput,
} from "@/lib/repositories/triumph-package-repository";

export type FetchTriumphPackagesResult =
  | { success: true; packages: TriumphPackage[] }
  | { success: false; message: string };

/** Public: active pricing tiers only, for the /triumph pricing section. */
export async function fetchActiveTriumphPackages(): Promise<FetchTriumphPackagesResult> {
  try {
    const packages = await getActiveTriumphPackages();
    return { success: true, packages };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load pricing.";
    return { success: false, message };
  }
}

/** Admin-only: every tier, including inactive ones. */
export async function fetchAllTriumphPackages(): Promise<FetchTriumphPackagesResult> {
  try {
    const packages = await getAllTriumphPackages();
    return { success: true, packages };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load packages.";
    return { success: false, message };
  }
}

export type CreateTriumphPackageResult =
  | { success: true; item: TriumphPackage }
  | { success: false; message: string };

/** Admin-only: creates a new pricing tier, appended to the end of the display order. */
export async function createTriumphPackageAction(
  input: Omit<CreateTriumphPackageInput, "displayOrder">,
): Promise<CreateTriumphPackageResult> {
  try {
    const existing = await getAllTriumphPackages();
    const nextOrder = existing.reduce((max, p) => Math.max(max, p.display_order), -1) + 1;

    const item = await createTriumphPackage({ ...input, displayOrder: nextOrder });
    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create this package.";
    return { success: false, message };
  }
}

export type UpdateTriumphPackageResult =
  | { success: true; item: TriumphPackage }
  | { success: false; message: string };

/** Admin-only: updates an existing pricing tier (price, copy, featured, active, order). */
export async function updateTriumphPackageAction(
  id: string,
  input: UpdateTriumphPackageInput,
): Promise<UpdateTriumphPackageResult> {
  try {
    const item = await updateTriumphPackage(id, input);

    if (!item) {
      return { success: false, message: "This package could not be found." };
    }

    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update this package.";
    return { success: false, message };
  }
}

export type DeleteTriumphPackageResult =
  | { success: true }
  | { success: false; message: string };

/** Admin-only: deletes a pricing tier. */
export async function deleteTriumphPackageAction(id: string): Promise<DeleteTriumphPackageResult> {
  try {
    const removed = await deleteTriumphPackage(id);

    if (!removed) {
      return { success: false, message: "This package could not be found." };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete this package.";
    return { success: false, message };
  }
}
