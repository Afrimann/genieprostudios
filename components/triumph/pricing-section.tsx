import { getActiveTriumphPackages } from "@/lib/repositories/triumph-package-repository";
import { TriumphPricing } from "@/components/triumph/pricing";

// Thin async Server Component wrapper so the data fetch (which reads
// Supabase via cookies(), see triumph-package-repository.ts) can be
// Suspense-boundaried in app/triumph/page.tsx without making the rest of
// that page dynamic — same reasoning as TriumphPortfolioTeaser.
export async function TriumphPricingSection() {
  const tiers = await getActiveTriumphPackages();

  return <TriumphPricing tiers={tiers} />;
}
