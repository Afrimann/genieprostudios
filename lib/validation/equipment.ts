import { z } from "zod";

// Shared by the admin "Add equipment" form, and reusable server-side later
// (per project-notes.md: Zod schemas should be written so they can be reused
// for server-side validation, not duplicated ad hoc). Mirrors
// lib/repositories/equipment-repository.ts's CreateEquipmentItemInput shape.
export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Keep the name under 200 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters")
    .optional(),
  providedBy: z.enum(["studio", "client"], {
    message: "Choose who provides this item",
  }),
  quantityAvailable: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative"),
});

export type CreateEquipmentFormValues = z.infer<typeof createEquipmentSchema>;

// Form-only alias — the admin form has no extra fields beyond the schema
// above (unlike createBlockFormSchema's date-split), kept as a distinct
// export anyway so call sites read the same way as availability.ts's
// equivalent naming.
export const createEquipmentFormSchema = createEquipmentSchema;
