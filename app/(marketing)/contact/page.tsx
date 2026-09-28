import { Suspense } from "react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";

// Reads a live session, so this page can never be meaningfully
// prerendered — same reasoning as every other page with this comment
// (e.g. app/(marketing)/dashboard/page.tsx).
export const instant = false;

// No real email/phone/address supplied yet (2026-09-27, explicit user call:
// don't publish fabricated contact details — a wrong phone number is
// actively misleading, unlike an approximate stat). /book is the one real,
// working channel today; this stays a booking-first page until the studio
// supplies direct contact details to add alongside it.
const HOURS = [{ day: "Every day", time: "24 hours" }];

async function FrontDeskCard() {
  const user = await getCurrentUser();

  const href = user ? "/dashboard/support" : "/sign-up?redirect=/dashboard/support";

  return (
    <div className="flex flex-col items-start gap-4">
      <h2 className="font-heading text-lg font-medium text-foreground">
        Message the front desk
      </h2>
      <p className="text-sm text-muted-foreground">
        Have a question that isn&apos;t about booking? Start a conversation and we&apos;ll
        reply here — you can keep talking to us until it&apos;s resolved.
      </p>
      <Button
        asChild
        variant="outline"
        className="h-11 rounded-none px-6 text-sm font-medium"
      >
        <Link href={href}>Message the front desk</Link>
      </Button>
    </div>
  );
}

export default function ContactPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Contact
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Get in touch
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Booking is the fastest way to reach us — pick a service and a time, and
            we&apos;ll take it from there.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-12 px-6 py-16 sm:grid-cols-3">
          <div className="flex flex-col items-start gap-4">
            <h2 className="font-heading text-lg font-medium text-foreground">
              Book a session
            </h2>
            <p className="text-sm text-muted-foreground">
              Every service, priced up front — pick what you need and lock in a time.
            </p>
            <Button
              asChild
              className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
            >
              <Link href="/book">Book a session</Link>
            </Button>
          </div>

          <Suspense
            fallback={
              <div className="h-40 w-full animate-pulse rounded-2xl border border-border bg-muted" />
            }
          >
            <FrontDeskCard />
          </Suspense>

          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-lg font-medium text-foreground">
              Studio hours
            </h2>
            <dl className="flex flex-col gap-2">
              {HOURS.map((row) => (
                <div key={row.day} className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">{row.day}</dt>
                  <dd className="font-mono text-foreground">{row.time}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
