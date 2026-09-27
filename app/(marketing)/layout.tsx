import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Route group (no URL segment of its own) covering every public-facing page
// — home, about, services, work, gallery, contact, book, dashboard,
// login/sign-up, terms/privacy. /admin/* lives entirely outside this group,
// so it never picks up the public SiteHeader/SiteFooter (it has its own
// chrome — components/admin/admin-shell.tsx). The root app/layout.tsx only
// owns html/body/fonts now; this is the only place SiteHeader/SiteFooter
// render.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* flex-1 (body is flex flex-col, app/layout.tsx) makes this grow to
          fill any leftover viewport height on short pages, pushing
          SiteFooter to the bottom instead of it trailing right under a
          short page's content — standard flexbox sticky-footer pattern. */}
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
