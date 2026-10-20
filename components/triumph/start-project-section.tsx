import { getActiveTriumphPackages } from "@/lib/repositories/triumph-package-repository";
import { TriumphStartProjectForm } from "@/components/triumph/start-project-form";

// Thin async Server Component wrapper, same pattern as pricing-section.tsx
// — fetches triumph_packages (via cookies()-backed Supabase client) so the
// Client Component form's service dropdown can be Suspense-boundaried
// without making the rest of app/triumph/page.tsx dynamic.
export async function TriumphStartProjectSection() {
  const packages = await getActiveTriumphPackages();

  return <TriumphStartProjectForm packages={packages} />;
}
