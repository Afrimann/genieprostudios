import { z } from "zod";

// Form-only schema for the T&Cs consent checkbox in the booking flow's
// summary step, following the createSlotSchema/createSlotFormSchema split
// established in lib/validation/availability.ts: the form only ever
// register()s a single `agreed` checkbox, so the schema validated against
// that form must contain ONLY that field — zodResolver silently fails
// validation (no visible error, no network call) if the schema requires a
// field the form never registers.
//
// z.literal(true) with a custom error map (Zod 4 API: the second argument to
// z.literal is `{ error }`, not the Zod 3 `{ errorMap }`) rejects both
// `false` and `undefined` (unchecked box) with the same readable message.
export const consentFormSchema = z.object({
  agreed: z.literal(true, {
    error: "You must accept the terms to continue",
  }),
});

export type ConsentFormValues = z.infer<typeof consentFormSchema>;
