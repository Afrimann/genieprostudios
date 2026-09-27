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

/**
 * Reads all active services/add-ons, ordered by category then duration —
 * a sensible grouping for a customer-facing pricing/services list.
 *
 * Dumb data access only: no filtering/business logic beyond what RLS
 * already enforces (services_select_active_public policy, 0010) — this
 * repository just adds an explicit active=true filter + ordering on top of
 * a table anon/authenticated can already read directly.
 */
export async function getActiveServices(): Promise<Service[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("duration_hours", { ascending: true });

  if (error) {
    throw new Error(`getActiveServices: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Reads a single active service by id (e.g. to look up duration_hours when
 * computing valid booking start times). Returns null if it doesn't exist or
 * isn't active, rather than throwing, so callers can distinguish "not
 * found" (a normal, expected case — e.g. a stale/invalid service id) from a
 * genuine query failure.
 *
 * Dumb data access only, same RLS reliance as getActiveServices.
 */
export async function getServiceById(serviceId: string): Promise<Service | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`getServiceById: ${error.message}`);
  }

  return data ?? null;
}
