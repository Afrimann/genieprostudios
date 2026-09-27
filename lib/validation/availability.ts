import { z } from "zod";

// Accepts "HH:MM" or "HH:MM:SS" (24-hour), matching what
// lib/repositories/availability-repository.ts's CreateSlotInput expects.
// Kept lenient on seconds since <input type="time"> only ever emits "HH:MM".
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

// Shared by the admin "add slot" form now, and reusable server-side later
// (per project-notes.md: Zod schemas should be written so they can be
// reused for server-side validation, not duplicated ad hoc). The actual
// 30-minute buffer rule still lives in
// lib/services/availability-service.ts (checkSlotBuffer) — this schema only
// validates shape/ordering, not business rules that need DB state.
const startTimeField = z
  .string()
  .trim()
  .min(1, "Start time is required")
  .regex(TIME_REGEX, "Enter a valid time (HH:MM)");

const endTimeField = z
  .string()
  .trim()
  .min(1, "End time is required")
  .regex(TIME_REGEX, "Enter a valid time (HH:MM)");

export const createSlotSchema = z
  .object({
    date: z.string().trim().min(1, "Date is required"),
    startTime: startTimeField,
    endTime: endTimeField,
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type CreateSlotFormInput = z.infer<typeof createSlotSchema>;

// Client-form-only variant: the admin "add slot" form supplies `date`
// separately (from the selected calendar day, not a form field), so
// validating the form itself against the full createSlotSchema — which
// requires `date` — always failed with no visible error, since the form
// never registers a `date` input. This mirrors createSlotSchema's
// startTime/endTime rules exactly, minus the field the form doesn't own.
export const createSlotFormSchema = z
  .object({
    startTime: startTimeField,
    endTime: endTimeField,
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type CreateSlotFormValues = z.infer<typeof createSlotFormSchema>;
