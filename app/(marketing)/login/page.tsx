import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginSearchParams = Promise<{ redirect?: string; reason?: string }>;

async function LoginContent({ searchParams }: { searchParams: LoginSearchParams }) {
  const { redirect, reason } = await searchParams;
  const isBookingContext = reason === "book";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isBookingContext ? "Sign in to continue your booking" : "Log in"}
        </CardTitle>
        <CardDescription>
          {isBookingContext
            ? "Sign in to pick up right where you left off."
            : "Welcome back — sign in to manage your bookings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={redirect} reason={reason} />
      </CardContent>
    </Card>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Suspense fallback={<Card className="h-80 w-full max-w-md animate-pulse" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
