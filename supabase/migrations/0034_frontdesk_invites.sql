-- 0034_frontdesk_invites.sql
-- Backs the /admin/staff invite flow (2026-10-05 client request, after
-- settling on individual staff logins for /frontdesk over a shared desk
-- account): the owner enters an email, Supabase Auth sends a set-password
-- invite link, and the new account is flagged for front desk access as soon
-- as it's created — see lib/services/frontdesk-staff-actions.ts.
--
-- These three columns are purely DISPLAY/AUDIT metadata for the /admin/staff
-- screen ("who did you invite, when, has it been accepted") — none of them
-- gate anything by themselves. profiles.is_frontdesk (0032) remains the only
-- column RLS and the frontdesk_* RPCs actually check.

alter table public.profiles
  add column if not exists frontdesk_invited_at timestamptz,
  add column if not exists frontdesk_invited_by uuid references public.profiles (id),
  add column if not exists frontdesk_invite_accepted_at timestamptz;

-- Locked the same way as is_admin/is_frontdesk (0031/0032), for consistency
-- rather than because these three are individually dangerous. The actual
-- risk if left writable is narrow but real: a customer could set their own
-- frontdesk_invited_at and show up on the Staff screen looking like a
-- legitimate invite the owner doesn't remember sending — a social-engineering
-- surface, not a privilege-escalation one, since is_frontdesk itself stays
-- locked regardless. All writes to these three happen via the service-role
-- client, from two places: the invite action (frontdesk_invited_at/_by) and
-- the accept-invite flow stamping its own acceptance
-- (frontdesk_invite_accepted_at) — see app/frontdesk/accept-invite/page.tsx.
revoke update (frontdesk_invited_at, frontdesk_invited_by, frontdesk_invite_accepted_at)
  on public.profiles from anon, authenticated;

comment on column public.profiles.frontdesk_invited_at is
  'When an admin invited this user to /frontdesk. Display/audit only — does
  not itself grant access, see profiles.is_frontdesk. Not cleared on revoke,
  so a revoked-then-reinvited staff member keeps their original invite
  history. Writable only by service_role — see 0034_frontdesk_invites.sql.';

comment on column public.profiles.frontdesk_invited_by is
  'Which admin sent the invite (FK to profiles, the inviting admin''s own
  row). Writable only by service_role.';

comment on column public.profiles.frontdesk_invite_accepted_at is
  'When this user completed the invite (set a password and signed in).
  Null means still pending. Writable only by service_role — stamped by the
  accept-invite page''s own server action for exactly the calling user''s
  row, never by a client-supplied id.';
