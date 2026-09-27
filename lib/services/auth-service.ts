"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, signUpSchema } from "@/lib/validation/auth";

// Consistent result shape for the frontend to consume. Never throws for
// expected failure cases (bad input, Supabase auth error) — those come back
// as { success: false, error }. Only truly unexpected errors would surface
// as a thrown exception from here.
export type AuthActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Signs up a new customer. Validates input server-side (never trust client
 * validation alone) and passes full_name/phone via options.data so that the
 * `handle_new_user()` Postgres trigger can populate `profiles` from
 * `raw_user_meta_data`.
 *
 * Does NOT redirect — the calling page/component owns navigation, since the
 * redirect target depends on `?redirect=`/`?reason=` query params that live
 * at the page level, not here.
 */
export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid sign-up details",
    };
  }

  const { email, password, fullName, phone } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Signs in an existing customer with email/password. Validates input
 * server-side. Does NOT redirect — see signUp() doc comment for why.
 */
export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid login details",
    };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Signs out the current session and redirects, in one call — unlike
 * signUp()/login() above, there's no "then decide where to go" step for a
 * sign-out (there is exactly one sensible destination per caller), so this
 * owns navigation itself via redirect() rather than returning a result. Used
 * from the admin shell (redirectTo="/admin/login"); generic enough to reuse
 * for a future customer-facing sign-out.
 */
export async function signOut(redirectTo: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(redirectTo);
}
