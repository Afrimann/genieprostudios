import { z } from "zod";

export const inviteFrontdeskStaffSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

export type InviteFrontdeskStaffInput = z.infer<typeof inviteFrontdeskStaffSchema>;

// Same minimum as signUpSchema's password rule (lib/validation/auth.ts) —
// one standard across every place this app lets someone set a password.
export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
