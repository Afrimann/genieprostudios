import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Anon-key client with no cookie/session handling — for reads that are
// public by RLS policy (e.g. published portfolio entries) and need to run
// outside a request context, such as during static generation of
// app/sitemap.ts, where next/headers' cookies() is unavailable.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
