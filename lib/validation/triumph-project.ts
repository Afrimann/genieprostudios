import { z } from "zod";

import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";

const SERVICE_IDS = TRIUMPH_PRICING_TIERS.map((tier) => tier.id) as [string, ...string[]];

export const triumphProjectRequestSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name"),
  email: z.string().trim().min(1, "Please enter your email").email("Please enter a valid email address"),
  country: z.string().trim().min(1, "Please enter your country"),
  phone: z.string().trim().min(1, "Please enter a phone number"),
  numberOfSongs: z.number().int().min(1, "Enter at least 1 song"),
  serviceId: z.enum(SERVICE_IDS, { message: "Please select a service" }),
  projectDetails: z.string().trim().min(1, "Tell us a bit about the project"),
});

export type TriumphProjectRequestInput = z.infer<typeof triumphProjectRequestSchema>;

// "Find Your Project" lookup — Project Code + email, no password. Code is
// uppercased and email lower-cased by the caller (triumph-tracking-actions.ts)
// before querying, not here, so this schema only enforces "non-empty."
export const triumphProjectLookupSchema = z.object({
  projectCode: z.string().trim().min(1, "Please enter your project code"),
  email: z.string().trim().min(1, "Please enter your email").email("Please enter a valid email address"),
});

export type TriumphProjectLookupInput = z.infer<typeof triumphProjectLookupSchema>;
