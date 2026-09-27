import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ConfirmationPoller } from "@/components/booking/confirmation-poller";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ConfirmationSearchParams = Promise<{ reference?: string; trxref?: string }>;

// Paystack appends both `reference` and `trxref` (a legacy alias of the
// same value) to the callback URL — only `reference` is read here.
async function ConfirmationContent({
  searchParams,
}: {
  searchParams: ConfirmationSearchParams;
}) {
  const { reference } = await searchParams;

  if (!reference) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No payment reference found</CardTitle>
          <CardDescription>
            We couldn&apos;t find a payment reference on this link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm underline underline-offset-2">
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  // RLS-scoped read (payments_select_own, 0010_rls_policies.sql) — the
  // customer can only ever see a payment tied to one of their own bookings.
  // A first, simple read of the current state; the poller below is what
  // actually watches for a pending -> success/failed transition, since
  // arriving at this URL is never itself proof of payment.
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No payment reference found</CardTitle>
          <CardDescription>
            We couldn&apos;t find a payment matching this reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm underline underline-offset-2">
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (payment.status === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment confirmed</CardTitle>
          <CardDescription>Thanks — your payment went through successfully.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm underline underline-offset-2">
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (payment.status === "failed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment failed</CardTitle>
          <CardDescription>This payment did not go through.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/book" className="text-sm underline underline-offset-2">
            Try again
          </Link>
          <Link href="/dashboard" className="text-sm underline underline-offset-2">
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  // status === "pending" — hand off to the client-side poller, which is the
  // only thing that actually watches for the webhook-driven state change.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirming your payment</CardTitle>
        <CardDescription>
          This usually only takes a few seconds — please don&apos;t close this page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmationPoller reference={reference} />
      </CardContent>
    </Card>
  );
}

export default function ConfirmationPage({
  searchParams,
}: {
  searchParams: ConfirmationSearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Confirming your payment</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <ConfirmationContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
