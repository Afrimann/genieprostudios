"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";

import { setPasswordSchema, type SetPasswordInput } from "@/lib/validation/frontdesk-staff";
import { markFrontdeskInviteAcceptedAction } from "@/lib/services/frontdesk-staff-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fieldInputClass =
  "h-11 rounded-xl pl-10 text-sm focus-visible:ring-[var(--amber-glow)]/40 focus-visible:border-[var(--amber-glow)]";
const fieldIconClass =
  "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground";

/**
 * The second half of the invite flow: the session from verifyOtp
 * (app/auth/confirm/route.ts) is already live in cookies by the time this
 * renders, so supabase.auth.updateUser({ password }) here needs nothing
 * more than that session — same trust model as a normal password change,
 * not a privileged operation. Stamping frontdesk_invite_accepted_at,
 * though, writes a locked column (0034_frontdesk_invites.sql), so that part
 * goes through the server action instead.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
  });

  async function onSubmit(values: SetPasswordInput) {
    setServerError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });

    if (updateError) {
      setServerError(updateError.message);
      return;
    }

    // Best-effort: a failure here means the Staff screen shows "pending"
    // forever even though the account works fine — annoying for the owner,
    // never a reason to block someone who just successfully set a password
    // from reaching the board they were invited to use.
    await markFrontdeskInviteAcceptedAction();

    router.push("/frontdesk");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className={fieldIconClass} aria-hidden="true" />
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            className={fieldInputClass}
            {...register("password")}
          />
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <div className="relative">
          <Lock className={fieldIconClass} aria-hidden="true" />
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            className={fieldInputClass}
            {...register("confirmPassword")}
          />
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-11 w-full rounded-none bg-[var(--amber-glow)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
      >
        {isSubmitting ? "Setting password…" : "Set password & continue"}
      </Button>
    </form>
  );
}
