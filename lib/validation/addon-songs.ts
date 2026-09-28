import { z } from "zod";

// Form-only schema for the booking flow's "songs" step (an is_addon service
// — per-song mixing/mastering, see 0020_addon_song_details.sql). Mirrors
// consent.ts/availability.ts's pattern: only fields the form actually
// registers, since zodResolver silently fails validation otherwise.

// Must match the storage bucket's allowed_mime_types (0020_addon_song_details.sql).
const WAV_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]);
// Confirmed empirically (2026-09-28): a real Supabase upload above ~50MB
// doesn't fail cleanly — it hangs indefinitely regardless of the bucket's
// own file_size_limit, because Supabase Storage's actual enforced cap on
// the Free tier is 50MB (the bucket's higher limit only takes effect on a
// paid plan). Capping here at 50MB is what makes an oversized file fail
// fast with a clear message instead of leaving the customer stuck on
// "Submitting…" forever. Raise this only once the project is confirmed to
// be on a plan with a higher enforced limit.
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "50MB";

function isWavFile(file: File): boolean {
  return WAV_MIME_TYPES.has(file.type) || file.name.toLowerCase().endsWith(".wav");
}

const songFieldSchema = z.object({
  title: z.string().trim().min(1, "Please name this track"),
  file: z
    .custom<File>((value) => value instanceof File, {
      message: "Please upload the WAV file for this track",
    })
    .refine((file) => isWavFile(file), { message: "Only .wav files are accepted" })
    .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, {
      message: `File is too large (max ${MAX_FILE_SIZE_LABEL})`,
    }),
});

export const addonSongsFormSchema = z.object({
  contactName: z.string().trim().min(1, "Please enter your name"),
  contactEmail: z
    .string()
    .trim()
    .min(1, "Please enter your email")
    .email("Please enter a valid email address"),
  songs: z.array(songFieldSchema).min(1, "Add at least one song"),
});

export type AddonSongsFormValues = z.infer<typeof addonSongsFormSchema>;
