import Image from "next/image";
import Link from "next/link";

// new Date() is an "unstable value" under cacheComponents — fine to compute
// once and cache indefinitely (a copyright year has no need to be
// request-fresh), rather than opting the whole (marketing) layout out of
// static prerendering just for this. Found live (2026) as a real
// blocking-prerender error once SiteFooter moved from the root layout into
// app/(marketing)/layout.tsx, which Next now attempts to statically
// prerender.
async function getCopyrightYear(): Promise<number> {
  "use cache";
  return new Date().getFullYear();
}

const FOOTER_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

// Kept functional and restrained by design — every other section on the
// page carries a piece of the studio-equipment visual language, the footer
// deliberately doesn't, it just needs to work.
export async function SiteFooter() {
  const year = await getCopyrightYear();

  return (
    <footer className="border-t border-[var(--amber-glow)]/30 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Genie Pro Studios">
          <Image
            src="/images/logo.png"
            alt=""
            width={28}
            height={28}
            style={{ height: "auto" }}
            className="rounded-md"
          />
          <span className="font-heading text-sm font-medium text-foreground">
            Genie Pro Studios
          </span>
        </Link>

        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-xs text-muted-foreground">
          © {year} Genie Pro Studios
        </p>
      </div>
    </footer>
  );
}
