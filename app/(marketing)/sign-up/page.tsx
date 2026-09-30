import { Suspense } from "react";
import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

type SignUpSearchParams = Promise<{ redirect?: string; reason?: string }>;

export const metadata: Metadata = {
  title: "Sign Up",
  robots: { index: false, follow: false },
};

async function SignUpContent({ searchParams }: { searchParams: SignUpSearchParams }) {
  const { redirect, reason } = await searchParams;
  const isBookingContext = reason === "book";

  return (
    <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:p-10">
      <div className="flex flex-col gap-2 pb-6">
        <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
          Genie Pro Studios
        </span>
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          {isBookingContext ? "Create an account to continue your booking" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isBookingContext
            ? "You'll need an account so we can save your booking and keep you updated."
            : "Sign up to book sessions and track them from your dashboard."}
        </p>
      </div>

      <SignUpForm redirectTo={redirect} reason={reason} />
    </div>
  );
}

function SignUpFallback() {
  return (
    <div className="h-[34rem] w-full max-w-md animate-pulse rounded-3xl border border-border bg-card" />
  );
}

export default function SignUpPage({
  searchParams,
}: {
  searchParams: SignUpSearchParams;
}) {
  return (
    <main className="bg-grain relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-none opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--amber-glow), transparent 70%)" }}
      />

      <div className="relative z-[1] flex w-full flex-col items-center py-10">
        <Suspense fallback={<SignUpFallback />}>
          <SignUpContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
