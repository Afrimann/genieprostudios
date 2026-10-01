"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  triumphProjectLookupSchema,
  type TriumphProjectLookupInput,
} from "@/lib/validation/triumph-project";
import { lookupTriumphProjectAction } from "@/lib/services/triumph-tracking-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fieldInputClass =
  "h-11 rounded-xl text-sm focus-visible:ring-[#22e6c8]/40 focus-visible:border-[#22e6c8]";

// Standalone "Find Your Project" lookup — rendered both on /triumph/track
// itself and inline on /triumph/track/[code] whenever the tracking cookie
// is missing/invalid/expired (see that page's fallback), so a bad/old link
// always lands the client back on a working form rather than an error.
export function TrackLookupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TriumphProjectLookupInput>({
    resolver: zodResolver(triumphProjectLookupSchema),
  });

  async function onSubmit(values: TriumphProjectLookupInput) {
    setServerError(null);
    const result = await lookupTriumphProjectAction(values);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    router.push(`/triumph/track/${result.projectCode}`);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 border border-border bg-background p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="projectCode">Project code</Label>
        <Input
          id="projectCode"
          placeholder="TMG-XXXXXX"
          autoComplete="off"
          aria-invalid={!!errors.projectCode}
          className={fieldInputClass}
          {...register("projectCode")}
        />
        {errors.projectCode && <p className="text-sm text-destructive">{errors.projectCode.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          className={fieldInputClass}
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-12 rounded-none bg-[#22e6c8] text-sm font-medium text-background hover:bg-[#1cc9ae]"
      >
        {isSubmitting ? "Looking up…" : "Access Project"}
      </Button>
    </form>
  );
}
