import Link from "next/link";

// A bold two-way split rather than a form preview or map thumbnail — most
// visitors here want one of exactly two things (book now, or ask a
// question first), so the section states that choice plainly instead of
// previewing UI that lives on another page.
export function ContactTeaser() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 divide-y divide-border border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Link
          href="/book"
          className="group flex flex-col justify-between gap-6 p-10 transition-colors hover:bg-card sm:p-14"
        >
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Ready now
          </span>
          <span className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
            Book a session
          </span>
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            Pick a service, a date, and a time →
          </span>
        </Link>

        <Link
          href="/contact"
          className="group flex flex-col justify-between gap-6 p-10 transition-colors hover:bg-card sm:p-14"
        >
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Not sure yet
          </span>
          <span className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
            Ask a question
          </span>
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            Studio hours, location, and general enquiries →
          </span>
        </Link>
      </div>
    </section>
  );
}
