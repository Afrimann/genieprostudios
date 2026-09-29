import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Route group (no URL segment of its own) covering every public-facing page
// — home, about, services, work, gallery, contact, book, dashboard,
// login/sign-up, terms/privacy. /admin/* lives entirely outside this group,
// so it never picks up the public SiteHeader/SiteFooter (it has its own
// chrome — components/admin/admin-shell.tsx). The root app/layout.tsx only
// owns html/body/fonts now; this is the only place SiteHeader/SiteFooter
// render.
//
// SiteHeader renders HeaderAuthLinks (components/layout/header-auth-links.tsx)
// behind a Suspense boundary, which reads cookies() via getCurrentUser() —
// a legitimate per-request dynamic read, exactly the pattern Next's own
// Cache Components auth guide recommends. But that guide is also explicit
// that a page/layout reading the session this way blocks Cache Components'
// static-shell ("instant navigation") validation, and per its own
// migration guidance: "Set `export const instant = false` on the page or
// layout ... then adopt the patterns ... one route at a time." Every
// marketing page shares this layout, so setting it once here (rather than
// on each individual page) is what actually covers all of them — a handful
// of pages had their own instant=false already for unrelated reasons
// (their own dynamic reads), which is why this surfaced as "only some
// pages are broken" rather than affecting the header uniformly.
export const instant = false;

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
