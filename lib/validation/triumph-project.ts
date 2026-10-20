import { z } from "zod";

// serviceId used to be a z.enum() built from the static
// TRIUMPH_PRICING_TIERS array. Packages are now admin-editable rows in
// triumph_packages (0041_triumph_packages.sql), so the set of valid slugs
// can change at any time without a code deploy — a static enum can't track
// that. Only non-empty is enforced here; triumph-actions.ts re-validates
// the slug against the live package list server-side before persisting.
export const triumphProjectRequestSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name"),
  email: z.string().trim().min(1, "Please enter your email").email("Please enter a valid email address"),
  country: z.string().trim().min(1, "Please enter your country"),
  phone: z.string().trim().min(1, "Please enter a phone number"),
  numberOfSongs: z.number().int().min(1, "Enter at least 1 song"),
  serviceId: z.string().trim().min(1, "Please select a service"),
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
