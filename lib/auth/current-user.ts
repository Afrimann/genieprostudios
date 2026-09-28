import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// React's cache() memoizes per-request: multiple independent Server
// Components calling getCurrentUser() within the same request (e.g. the
// header's auth links + a page's own auth-gated content) share one
// in-flight auth.getUser() call instead of each firing their own. Several
// concurrent, unmemoized auth.getUser() calls on one page reproducibly left
// one of their Suspense boundaries stuck forever mid-stream in dev once a
// third one was added (see components/layout/header-auth-links.tsx) — this
// is the official Cache Components "Data Access Layer" pattern for exactly
// that problem, not a workaround specific to this bug.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
