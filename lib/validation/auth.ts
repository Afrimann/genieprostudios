import { z } from "zod";

// Lenient international-ish phone regex: optional leading +, 7-15 digits
// total, allows spaces/hyphens between groups. Deliberately permissive —
// this is a UX sanity check, not a strict E.164 validator. Server-side
// re-validation still applies (never trust client validation alone).
const PHONE_REGEX = /^\+?[0-9][0-9\s-]{6,14}[0-9]$/;

export const signUpSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long"),
  fullName: z.string().trim().min(1, "Full name is required"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(PHONE_REGEX, "Enter a valid phone number"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
