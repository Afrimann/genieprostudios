import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/booking-flow";

type BookSearchParams = Promise<{ service?: string }>;

// Empirically, instant=false on the parent app/book/layout.tsx does not
// suppress the "blocking-prerender-runtime" error for a direct
// searchParams read here — that flag only opts a segment's own validation
// out, and only reliably applies where it's declared. Wrapping the
// searchParams-dependent content in <Suspense> (same pattern already used
// in app/sign-up/page.tsx and app/login/page.tsx) is what actually clears
// it, confirmed by hitting this route in a real browser session.
async function BookPageContent({ searchParams }: { searchParams: BookSearchParams }) {
  const { service } = await searchParams;
  return <BookingFlow initialServiceId={service} />;
}

export default function BookPage({
  searchParams,
}: {
  searchParams: BookSearchParams;
}) {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-14">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Book a session
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Pick a package, a date, and a time
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            We&apos;ll hold your slot as soon as you confirm.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <BookPageContent searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
