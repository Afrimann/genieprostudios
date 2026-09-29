import Image from "next/image";
import Link from "next/link";

// Same "unstable value cached once" reasoning as site-footer.tsx's
// getCopyrightYear() — see that file's comment for why this can't just be
// `new Date().getFullYear()` inline under cacheComponents.
async function getCopyrightYear(): Promise<number> {
  "use cache";
  return new Date().getFullYear();
}

const FOOTER_LINKS = [
  { href: "#pricing", label: "Services" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#start-project", label: "Start a Project" },
];

// Social links deliberately omitted — no real Instagram/WhatsApp/etc handles
// for Triumph Music Global exist yet, and this project's standing rule is
// never publish fabricated contact details (see app/(marketing)/contact/page.tsx).
// Add them here once the client supplies real ones.
export async function TriumphFooter() {
  const year = await getCopyrightYear();

  return (
    <footer className="border-t border-[#22e6c8]/30 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/triumph" className="flex items-center" aria-label="Triumph Music Global">
          <Image
            src="/images/triumph-logo-mark.png"
            alt="Triumph Music Global"
            width={150}
            height={84}
            className="h-7 w-auto rounded bg-white p-0.5"
          />
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
          © {year} Triumph Music Global
        </p>
      </div>
    </footer>
  );
}
