import { TriumphHeader } from "@/components/layout/triumph-header";
import { TriumphFooter } from "@/components/layout/triumph-footer";

// Sibling route group to app/(marketing) — not nested inside it. Genie Pro's
// (marketing) layout already bakes SiteHeader/SiteFooter around every page
// in that group, and a nested layout can't "un-render" an ancestor's
// chrome, so Triumph Music Global (its own nav/CTA/wordmark, no
// booking/auth icons) needs to be a sibling with its own layout rather than
// a page nested under (marketing). Cross-site navigation (2026-10-xx):
// the old BrandToggleBar nav affordance was removed per client request in
// favor of real marketing content (components/home/triumph-teaser.tsx) —
// TriumphFooter now carries the only link back to the main site.
export const instant = false;

export default function TriumphLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TriumphHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <TriumphFooter />
    </>
  );
}
