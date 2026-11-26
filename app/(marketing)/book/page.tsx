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
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-40 size-96 rounded-full bg-[var(--amber-glow)]/10 blur-3xl"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-12 sm:py-16 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full border border-[var(--amber-glow)]/35 bg-[var(--amber-glow)]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--amber-glow)] uppercase">
              Studio booking
            </span>
            <h1 className="max-w-3xl font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Pick a package, a date, and a time
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Build your session step by step, then choose a payment option to confirm your booking.
            </p>
          </div>

          <aside className="rounded-2xl border border-border bg-background/80 p-5 shadow-lg shadow-black/10">
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--amber-glow)] uppercase">
              Slot availability
            </p>
            <p className="mt-2 font-heading text-lg font-medium text-foreground">
              Payment secures your time
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Unpaid selections don&apos;t reserve a slot. The first successful payment confirms the time.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-gradient-to-b from-background via-background to-card/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="rounded-3xl border border-border bg-card/50 p-4 shadow-xl shadow-black/10 sm:p-6 lg:p-8">
            <Suspense
              fallback={
                <div className="flex min-h-64 items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading your booking options…</p>
                </div>
              }
            >
              <BookPageContent searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
