"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { login } from "@/lib/services/auth-service";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  redirectTo?: string;
  reason?: string;
}

const fieldInputClass =
  "h-11 rounded-xl pl-10 text-sm focus-visible:ring-[var(--amber-glow)]/40 focus-visible:border-[var(--amber-glow)]";
const fieldIconClass =
  "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground";

export function LoginForm({ redirectTo, reason }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const signUpHref = buildAuthLink("/sign-up", redirectTo, reason);

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await login(values);

    if (!result.success) {
      setServerError(result.error);
      return;
    }

    // Never push `redirectTo` raw — it comes straight from a URL search
    // param an attacker controls. See lib/utils/safe-redirect.ts.
    router.push(safeRedirectPath(redirectTo));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className={fieldIconClass} aria-hidden="true" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className={fieldInputClass}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className={fieldIconClass} aria-hidden="true" />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className={fieldInputClass}
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-11 w-full rounded-none bg-[var(--amber-glow)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={signUpHref} className="font-medium text-[var(--amber-glow)] underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

function buildAuthLink(base: string, redirectTo?: string, reason?: string) {
  const params = new URLSearchParams();
  if (redirectTo) params.set("redirect", redirectTo);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
