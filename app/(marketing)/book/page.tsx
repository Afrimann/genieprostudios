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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Book a session</h1>
        <p className="text-sm text-muted-foreground">
          Pick a service, date, and time — we&apos;ll hold your slot as soon as you confirm.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <BookPageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
