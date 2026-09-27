import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Auth-gated: always needs a live session check, so it can never be
// meaningfully prerendered — opt out of Cache Components' static-shell validation.
export const instant = false;

export default async function BookLayout({
  children,
}: LayoutProps<"/book">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up?redirect=/book&reason=book");
  }

  return children;
}
