-- 0027_triumph_deliverables_allow_mp4.sql
-- Allows .mp4 deliverables (e.g. a video reference/consultation clip, not
-- just the final audio) into the triumph-deliverables bucket created in
-- 0023, alongside the existing WAV/MP3 types (2026-10-xx client request).

update storage.buckets
set allowed_mime_types = array[
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
  'audio/mpeg', 'audio/mp3',
  'video/mp4'
]
where id = 'triumph-deliverables';
