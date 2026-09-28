import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

type LoginSearchParams = Promise<{ redirect?: string; reason?: string }>;

async function LoginContent({ searchParams }: { searchParams: LoginSearchParams }) {
  const { redirect, reason } = await searchParams;
  const isBookingContext = reason === "book";

  return (
    <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:p-10">
      <div className="flex flex-col gap-2 pb-6">
        <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
          Genie Pro Studios
        </span>
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          {isBookingContext ? "Sign in to continue your booking" : "Log in"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isBookingContext
            ? "Sign in to pick up right where you left off."
            : "Welcome back — sign in to manage your bookings."}
        </p>
      </div>

      <LoginForm redirectTo={redirect} reason={reason} />
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="h-[26rem] w-full max-w-md animate-pulse rounded-3xl border border-border bg-card" />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <main className="bg-grain relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-none opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--amber-glow), transparent 70%)" }}
      />

      <div className="relative z-[1] flex w-full flex-col items-center">
        <Suspense fallback={<LoginFallback />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
