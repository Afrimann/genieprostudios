-- clear_user_data.sql
-- One-time data wipe (owner request, 2026-10-10): clear every piece of
-- USER-GENERATED data — bookings, payments, support conversations, T&C
-- acceptances, reminders, attendance records, Triumph project tracking —
-- while keeping:
--   - public.profiles (every admin/customer/frontdesk account)
--   - app configuration tables that aren't user-generated, just fill the
--     app itself: services, equipment_items, blocked_time_ranges,
--     portfolio_entries, heartbeat
--
-- This is a SCRIPT, not a migration — it belongs in supabase/scripts/, not
-- supabase/migrations/, because it mutates data once rather than changing
-- schema, and must never be replayed against a fresh/future database the
-- way a numbered migration would be.
--
-- Every DELETE is guarded by a table-existence check: the live project this
-- runs against may not have every migration in supabase/migrations/ applied
-- (confirmed live, 2026-10-10: public.rate_limits from 0030_rate_limits.sql
-- was missing even though later migrations had been applied), so this
-- script must not hard-fail over an optional/not-yet-applied table — it
-- just skips whatever isn't there.
--
-- IRREVERSIBLE for whatever IS present. Run this manually in the Supabase
-- Studio SQL editor only after confirming you want to permanently delete
-- all of the above. Order matters — children are cleared before their
-- parents to satisfy foreign key constraints; see each block's comment for
-- why it's positioned there.

do $$
begin

  -- 1. Break the circular bookings <-> tc_acceptances reference first
  --    (bookings.tc_acceptance_id -> tc_acceptances.id, and
  --    tc_acceptances.booking_id -> bookings.id, 0005_bookings.sql) so
  --    neither table blocks deleting the other.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    update public.bookings set tc_acceptance_id = null;
  end if;

  -- 2. payments and reminder_log reference bookings with no ON DELETE
  --    CASCADE (0006_payments.sql, 0007_reminder_log.sql) — must be
  --    cleared before bookings.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payments') then
    delete from public.payments;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reminder_log') then
    delete from public.reminder_log;
  end if;

  -- 3. tc_acceptances can now be cleared (its own FK to bookings no longer
  --    has anything pointing back at it after step 1).
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tc_acceptances') then
    delete from public.tc_acceptances;
  end if;

  -- 4. bookings itself. booking_tracks (0020_addon_song_details.sql) and
  --    session_attendance (0033_session_attendance.sql) both have
  --    ON DELETE CASCADE back to bookings, so they're cleared
  --    automatically here — no separate DELETE needed for either.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    delete from public.bookings;
  end if;

  -- 5. support_tickets cascades to support_messages
  --    (0021_support_tickets.sql) — one DELETE covers both.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'support_tickets') then
    delete from public.support_tickets;
  end if;

  -- 6. triumph_projects cascades to triumph_project_updates
  --    (0023_triumph_projects.sql) and triumph_payments
  --    (0029_triumph_payments.sql) — one DELETE covers all three.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'triumph_projects') then
    delete from public.triumph_projects;
  end if;

  -- 7. Ephemeral security/rate-limit state tied to past requests — safe to
  --    clear, carries no business meaning once cleared.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rate_limits') then
    delete from public.rate_limits;
  end if;

end $$;

-- Deliberately NOT touched: profiles (every account), services,
-- equipment_items, blocked_time_ranges, portfolio_entries, heartbeat.

-- Note: booking_tracks rows referenced files in the "track-uploads"
-- Supabase Storage bucket. Clearing the DB rows above does not delete
-- those underlying files — they become orphaned (unreferenced but still
-- taking storage space). If you also want to free that storage, clear the
-- "track-uploads" bucket separately from Storage > track-uploads in
-- Supabase Studio; this script does not touch Storage.
