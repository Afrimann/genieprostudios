"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { Send, CheckCircle2 } from "lucide-react";

import {
  triumphProjectRequestSchema,
  type TriumphProjectRequestInput,
} from "@/lib/validation/triumph-project";
import { submitProjectRequestAction } from "@/lib/services/triumph-actions";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

const fieldInputClass =
  "h-11 rounded-xl text-sm focus-visible:ring-[#22e6c8]/40 focus-visible:border-[#22e6c8]";

const TRUST_POINTS = [
  "We reply within 24 hours",
  "Direct line to the engineer working your song",
  "Files handled securely, never shared",
  "No hidden fees — pricing is what you see above",
];

// Staggered field entrance — same container/item variant shape as
// components/triumph/hero.tsx and pricing.tsx, giving this section its own
// distinct accent (a bobbing Send icon) rather than reusing either of
// theirs verbatim.
const fieldContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fieldItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const trustContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const trustItem = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function TriumphStartProjectForm() {
  const [projectCode, setProjectCode] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TriumphProjectRequestInput>({
    resolver: zodResolver(triumphProjectRequestSchema),
  });

  async function onSubmit(values: TriumphProjectRequestInput) {
    setServerError(null);
    const result = await submitProjectRequestAction(values);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    setProjectCode(result.projectCode);
  }

  if (projectCode) {
    return (
      <section id="start-project" className="scroll-mt-16 border-b border-border bg-card">
        <Reveal className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
          <h2 className="font-heading text-2xl font-medium text-foreground">Request sent</h2>
          <p className="text-sm text-muted-foreground">
            Thanks — we&apos;ll get back to you within 24 hours.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Your project code
            </span>
            <span className="font-heading text-xl font-medium text-[#22e6c8]">{projectCode}</span>
            <p className="max-w-sm text-xs text-muted-foreground">
              Save this — we&apos;ve also emailed it to you. Use it with your email anytime at{" "}
              <Link href="/triumph/track" className="underline underline-offset-4 hover:text-[#22e6c8]">
                /triumph/track
              </Link>{" "}
              to check your status.
            </p>
          </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section id="start-project" className="relative scroll-mt-16 overflow-hidden border-b border-border bg-card">
      <BrandGlow />
      <Reveal className="relative z-[1] mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-6">
          <div
            className="animate-bob-y flex size-9 items-center justify-center rounded-none border border-[#22e6c8]/50 bg-[#22e6c8]/10"
            style={{ animationDuration: "1.6s" }}
          >
            <Send className="size-4 text-[#22e6c8]" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
              Start your project
            </span>
            <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Tell us about the song.
            </h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll get back to you within 24 hours.
            </p>
          </div>

          <motion.ul
            variants={trustContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px 0px" }}
            className="flex flex-col gap-3"
          >
            {TRUST_POINTS.map((point) => (
              <motion.li key={point} variants={trustItem} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#22e6c8]" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{point}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 border border-border bg-background p-6 sm:p-8"
        >
          <motion.div
            variants={fieldContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px 0px" }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                aria-invalid={!!errors.fullName}
                className={fieldInputClass}
                {...register("fullName")}
              />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
            </motion.div>

            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
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
            </motion.div>

            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                autoComplete="country-name"
                aria-invalid={!!errors.country}
                className={fieldInputClass}
                {...register("country")}
              />
              {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
            </motion.div>

            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                className={fieldInputClass}
                {...register("phone")}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </motion.div>

            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
              <Label htmlFor="numberOfSongs">Number of songs</Label>
              <Input
                id="numberOfSongs"
                type="number"
                min={1}
                aria-invalid={!!errors.numberOfSongs}
                className={fieldInputClass}
                {...register("numberOfSongs", { valueAsNumber: true })}
              />
              {errors.numberOfSongs && (
                <p className="text-sm text-destructive">{errors.numberOfSongs.message}</p>
              )}
            </motion.div>

            <motion.div variants={fieldItem} className="flex flex-col gap-1.5">
              <Label htmlFor="serviceId">Service required</Label>
              <select
                id="serviceId"
                aria-invalid={!!errors.serviceId}
                className="h-11 rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-[#22e6c8] focus-visible:ring-3 focus-visible:ring-[#22e6c8]/40"
                defaultValue=""
                {...register("serviceId")}
              >
                <option value="" disabled>
                  Select a service
                </option>
                {TRIUMPH_PRICING_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
              {errors.serviceId && <p className="text-sm text-destructive">{errors.serviceId.message}</p>}
            </motion.div>
          </motion.div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectDetails">Project details</Label>
            <Textarea
              id="projectDetails"
              rows={4}
              aria-invalid={!!errors.projectDetails}
              className="rounded-xl text-sm focus-visible:ring-[#22e6c8]/40 focus-visible:border-[#22e6c8]"
              {...register("projectDetails")}
            />
            {errors.projectDetails && (
              <p className="text-sm text-destructive">{errors.projectDetails.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-none bg-[var(--amber-glow)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            {isSubmitting ? "Sending…" : "Send Request"}
          </Button>
        </form>
      </Reveal>
    </section>
  );
}
