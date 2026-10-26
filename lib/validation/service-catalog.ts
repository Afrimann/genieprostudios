import { z } from "zod";

const title = z.string().trim().min(1, "Enter a name").max(120, "Keep the name under 120 characters");
const packageId = z.string().uuid("Choose a valid package");

export const createServicePackageSchema = z.object({
  title,
  subtitle: z.string().trim().max(200, "Keep the subtitle under 200 characters").default(""),
});

export const updateServicePackageSchema = z.object({
  id: packageId,
  title,
  subtitle: z.string().trim().max(200, "Keep the subtitle under 200 characters"),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const createServiceCategorySchema = z.object({
  packageId,
  category: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Use lowercase letters, numbers, and underscores"),
  label: z.string().trim().min(1, "Enter a category label").max(120),
  description: z.string().trim().max(500).default(""),
});

export const updateServiceCategorySchema = z.object({
  category: z.string().min(1),
  label: z.string().trim().min(1, "Enter a category label").max(120).optional(),
  description: z.string().trim().max(500).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const createServiceFeatureSchema = z.object({
  packageId,
  label: z.string().trim().min(1, "Enter a feature").max(200),
  included: z.boolean(),
  highlight: z.boolean().default(false),
});

export const updateServiceFeatureSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1, "Enter a feature").max(200).optional(),
  included: z.boolean().optional(),
  highlight: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const createServiceRateSchema = z
  .object({
    category: z.string().min(1),
    label: z.string().trim().min(1, "Enter a service name").max(160),
    durationHours: z.number().min(0).max(24),
    priceNaira: z
      .number()
      .min(0, "Price cannot be negative")
      .max(100_000_000, "Enter a valid price")
      .multipleOf(0.01, "Use no more than two decimal places"),
    isAddon: z.boolean(),
  })
  .refine((value) => value.isAddon ? value.durationHours === 0 : value.durationHours > 0, {
    message: "Add-ons must have no duration; booked sessions need a duration above zero",
    path: ["durationHours"],
  });

export const updateServiceRateSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().trim().min(1, "Enter a service name").max(160).optional(),
    durationHours: z.number().min(0).max(24).optional(),
    priceNaira: z
      .number()
      .min(0, "Price cannot be negative")
      .max(100_000_000, "Enter a valid price")
      .multipleOf(0.01, "Use no more than two decimal places")
      .optional(),
    isAddon: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.isAddon === undefined ||
      value.durationHours === undefined ||
      (value.isAddon ? value.durationHours === 0 : value.durationHours > 0),
    {
      message: "Add-ons must have no duration; booked sessions need a duration above zero",
      path: ["durationHours"],
    },
  );
