import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SignUpSearchParams = Promise<{ redirect?: string; reason?: string }>;

async function SignUpContent({ searchParams }: { searchParams: SignUpSearchParams }) {
  const { redirect, reason } = await searchParams;
  const isBookingContext = reason === "book";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isBookingContext ? "Create an account to continue your booking" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {isBookingContext
            ? "You'll need an account so we can save your booking and keep you updated."
            : "Sign up to book sessions and track them from your dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm redirectTo={redirect} reason={reason} />
      </CardContent>
    </Card>
  );
}

export default function SignUpPage({
  searchParams,
}: {
  searchParams: SignUpSearchParams;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Suspense fallback={<Card className="h-80 w-full max-w-md animate-pulse" />}>
        <SignUpContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
