import { getActiveTriumphPackages } from "@/lib/repositories/triumph-package-repository";
import { getTriumphExchangeRates } from "@/lib/services/exchange-rates";
import { TriumphPricing } from "@/components/triumph/pricing";

// Thin async Server Component wrapper so the data fetch (which reads
// Supabase via cookies(), see triumph-package-repository.ts) can be
// Suspense-boundaried in app/triumph/page.tsx without making the rest of
// that page dynamic — same reasoning as TriumphPortfolioTeaser.
export async function TriumphPricingSection() {
  const tiers = await getActiveTriumphPackages();
  let rates = null;

  try {
    rates = await getTriumphExchangeRates();
  } catch (error) {
    console.error("Triumph pricing: unable to load currency conversion rates.", error);
  }

  return <TriumphPricing tiers={tiers} rates={rates} />;
}
