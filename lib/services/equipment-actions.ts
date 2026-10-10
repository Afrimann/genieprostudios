"use server";

// Server Action boundary between admin/customer Client Components and the
// equipment repository (which uses createClient() from
// lib/supabase/server.ts and therefore can only run server-side). Mirrors
// availability-actions.ts's pattern: thin wrappers, never throw for
// expected failures, always return a typed result the UI can branch on.
// No service layer needed beyond these passthroughs — equipment is pure
// data access with no business rules (no buffer/overlap concept), per the
// task brief.

import {
  getEquipmentItems,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  type EquipmentItem,
  type CreateEquipmentItemInput,
  type UpdateEquipmentItemInput,
} from "@/lib/repositories/equipment-repository";

export type FetchEquipmentItemsResult =
  | { success: true; items: EquipmentItem[] }
  | { success: false; message: string };

/** Public: every equipment item. Used by both the customer-facing
 * read-only equipment step and the admin equipment manager. */
export async function fetchEquipmentItems(): Promise<FetchEquipmentItemsResult> {
  try {
    const items = await getEquipmentItems();
    return { success: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load equipment.";
    return { success: false, message };
  }
}

export type CreateEquipmentItemResult =
  | { success: true; item: EquipmentItem }
  | { success: false; message: string };

/** Admin-only: creates a new equipment item. */
export async function createEquipmentItemAction(
  input: CreateEquipmentItemInput,
): Promise<CreateEquipmentItemResult> {
  try {
    const item = await createEquipmentItem(input);
    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create this item.";
    return { success: false, message };
  }
}

export type UpdateEquipmentItemResult =
  | { success: true; item: EquipmentItem }
  | { success: false; message: string };

/** Admin-only: updates an existing equipment item (e.g. inline quantity_available edits). */
export async function updateEquipmentItemAction(
  id: string,
  input: UpdateEquipmentItemInput,
): Promise<UpdateEquipmentItemResult> {
  try {
    const item = await updateEquipmentItem(id, input);

    if (!item) {
      return { success: false, message: "This item could not be found." };
    }

    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update this item.";
    return { success: false, message };
  }
}

export type DeleteEquipmentItemResult =
  | { success: true }
  | { success: false; message: string };

/** Admin-only: deletes an equipment item. */
export async function deleteEquipmentItemAction(id: string): Promise<DeleteEquipmentItemResult> {
  try {
    const removed = await deleteEquipmentItem(id);

    if (!removed) {
      return { success: false, message: "This item could not be found." };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete this item.";
    return { success: false, message };
  }
}
