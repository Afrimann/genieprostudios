import { z } from "zod";

// Shared by the Triumph admin "Add package" form, mirrors
// lib/validation/equipment.ts's shape and
// lib/repositories/triumph-package-repository.ts's CreateTriumphPackageInput.
export const createTriumphPackageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Keep the name under 100 characters"),
  priceUsd: z
    .number({ message: "Price is required" })
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative"),
  unit: z.string().trim().min(1, "Unit is required").max(30, "Keep the unit under 30 characters"),
  description: z
    .string()
    .trim()
    .max(300, "Keep the description under 300 characters")
    .optional()
    .default(""),
  turnaround: z
    .string()
    .trim()
    .max(100, "Keep the turnaround under 100 characters")
    .optional()
    .default(""),
  featured: z.boolean().default(false),
});

export type CreateTriumphPackageFormValues = z.input<typeof createTriumphPackageSchema>;
