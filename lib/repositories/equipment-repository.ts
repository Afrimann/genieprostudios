import { createClient } from "@/lib/supabase/server";

// Mirrors public.equipment_items (see
// supabase/migrations/0035_equipment_items.sql). Pure data access, no
// business rules — equipment has no buffer/overlap concept like
// availability, same "dumb CRUD" convention as portfolio-repository.ts.
export type EquipmentProvidedBy = "studio" | "client";

export type EquipmentItem = {
  id: string;
  name: string;
  description: string | null;
  provided_by: EquipmentProvidedBy;
  quantity_available: number;
  created_at: string;
  updated_at: string;
};

/**
 * Every equipment item, ordered by name. Relies entirely on the
 * equipment_items_select_public RLS policy (0035), which allows
 * anon+authenticated to read every row — the customer-facing equipment
 * step and the admin equipment manager both call this same read.
 */
export async function getEquipmentItems(): Promise<EquipmentItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_items")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`getEquipmentItems: ${error.message}`);
  }

  return data ?? [];
}

export type CreateEquipmentItemInput = {
  name: string;
  description?: string | null;
  providedBy: EquipmentProvidedBy;
  quantityAvailable: number;
};

/**
 * Admin-only: inserts a new equipment item. Relies on the
 * equipment_items_insert_admin RLS policy (0035) — this repository adds no
 * redundant admin check of its own, matching availability-repository.ts's
 * existing convention for admin-only writes.
 */
export async function createEquipmentItem(input: CreateEquipmentItemInput): Promise<EquipmentItem> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_items")
    .insert({
      name: input.name,
      description: input.description ?? null,
      provided_by: input.providedBy,
      quantity_available: input.quantityAvailable,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createEquipmentItem: ${error.message}`);
  }

  return data;
}

export type UpdateEquipmentItemInput = {
  name?: string;
  description?: string | null;
  providedBy?: EquipmentProvidedBy;
  quantityAvailable?: number;
};

/**
 * Admin-only: updates an existing equipment item. Relies on the
 * equipment_items_update_admin RLS policy (0035). Returns null (not a
 * throw) if the id doesn't exist, same "not found is not an error"
 * convention as closeSlot/deleteBlock elsewhere in this project.
 */
export async function updateEquipmentItem(
  id: string,
  input: UpdateEquipmentItemInput,
): Promise<EquipmentItem | null> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.providedBy !== undefined) patch.provided_by = input.providedBy;
  if (input.quantityAvailable !== undefined) patch.quantity_available = input.quantityAvailable;

  const { data, error } = await supabase
    .from("equipment_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`updateEquipmentItem: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Admin-only: deletes an equipment item. Relies on the
 * equipment_items_delete_admin RLS policy (0035). Returns true if a row
 * was actually deleted, false if no row matched (already removed, or
 * never existed).
 */
export async function deleteEquipmentItem(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_items")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`deleteEquipmentItem: ${error.message}`);
  }

  return data !== null;
}
