import { createClient } from "@/lib/supabase/server";

// Dumb data access for public.booking_tracks (0020_addon_song_details.sql) —
// one row per song submitted with an addon (per-song) booking. Same
// convention as the other repositories: relies entirely on RLS
// (booking_tracks_select_own/booking_tracks_select_admin/booking_tracks_insert_own)
// for authorization, no redundant checks here.

export type BookingTrack = {
  id: string;
  booking_id: string;
  position: number;
  title: string;
  file_path: string;
  file_name: string;
  created_at: string;
};

/**
 * Inserts one booking_tracks row for a song already uploaded to the
 * track-uploads storage bucket. Only succeeds while the booking is still
 * pending_deposit (booking_tracks_insert_own) — the file itself must already
 * be at filePath before this is called, since RLS on the row doesn't verify
 * the object exists.
 */
export async function createBookingTrack(params: {
  bookingId: string;
  position: number;
  title: string;
  filePath: string;
  fileName: string;
}): Promise<BookingTrack> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_tracks")
    .insert({
      booking_id: params.bookingId,
      position: params.position,
      title: params.title,
      file_path: params.filePath,
      file_name: params.fileName,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`createBookingTrack: ${error.message}`);
  }

  return data as BookingTrack;
}

/** Ordered by position — the order the customer entered their songs in. */
export async function getTracksForBooking(bookingId: string): Promise<BookingTrack[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_tracks")
    .select("*")
    .eq("booking_id", bookingId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(`getTracksForBooking: ${error.message}`);
  }

  return (data ?? []) as BookingTrack[];
}

/**
 * Signed, time-limited download URL for a track's file — used by the admin
 * detail page to actually retrieve the audio. Relies on the
 * track_uploads_select_admin storage policy (0020), so this must be called
 * with the caller's own cookie-scoped session (an admin), never the
 * service-role client.
 */
export async function getTrackDownloadUrl(filePath: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("track-uploads")
    .createSignedUrl(filePath, 60);

  if (error || !data) {
    throw new Error(`getTrackDownloadUrl: ${error?.message ?? "no URL returned"}`);
  }

  return data.signedUrl;
}
