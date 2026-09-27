# GenieProStudios — Web App Notes (raw intake)

> Running collection of everything shared so far. Will be synthesized into a full
> project/spec document when requested. Entries are kept close to original wording,
> organized by theme as they come in.

---

## Voice note transcript — 2026-08-27 (WhatsApp PTT 22:03:48)

> "Yeah, that's exactly what I want. Maybe I don't know everything that I want just yet,
> but I think the landing page — where we reduce what I have to say to customers, you
> know, pretty much all the necessary information, all the terms and conditions, and not
> just it being the day having to read it and agree to it before making payments. Because
> I don't want to hear 'I did not see it', that be all those kind of things. So generally,
> yeah, I think you know better. I just need to create something that works — where
> people can also book appointments, and book sessions, and I'll be notified."

### Extracted requirements
- **Landing page** should front-load key info so the business doesn't have to repeat
  itself to every customer (self-service info page).
- **Terms & Conditions**: must be clearly presented and require explicit agreement
  *before payment* — not an afterthought on the payment day. Purpose: legal/CYA
  protection against "I didn't see it" disputes. Likely needs a checkbox/consent
  flow with a timestamped record of acceptance.
- **Booking system**: customers can book appointments/sessions directly on the site.
- **Owner notifications**: business owner (user) gets notified when a booking is made
  (email/SMS/push — channel TBD).
- User is open to recommendations ("I think you know better") — okay to propose
  best-practice UX/architecture where they haven't specified.

## Business type
- **Music studio** (recording/rehearsal — likely session-based, possibly hourly rate,
  possibly with engineer/equipment involved). Explains "GenieProStudios" name.

### Open questions (to revisit)
- What kind of sessions are bookable — recording, mixing/mastering, rehearsal,
  production, vocal booth, etc.? (Could be one type or several with different rates.)
- Pricing model — flat per session, hourly, per engineer/room?
- Is a sound engineer assigned per booking, or is it just room/equipment rental?
- Who needs to see/sign the T&Cs — every booking, or once per customer account?
- Notification channel preference (email, SMS, WhatsApp, in-app)?

---

## Features (running list)
1. Landing page — condensed, self-explanatory, reduces manual back-and-forth with customers.
2. T&Cs consent flow — required agreement before payment, with proof of acceptance.
3. Appointment/session booking system.
4. Owner notifications on new bookings.

## Branding
- (nothing yet)

## Architecture / Stack

### Frontend
- Next.js + TypeScript — framework & type safety
- Tailwind CSS — styling
- Shadcn/ui — used selectively where needed (forms, dialogs, calendar/date-picker)
- Framer Motion — animations/transitions
- React Hook Form + Zod — form state + schema validation (schema can be shared/reused
  for server-side validation too)

### Data-access pattern (frontend)
Layered pipeline, each layer only aware of the one below it:

`Component → Hook → Service → Repository → Supabase / Node API`

- **Repositories** (classes): sole place that talks to Supabase/API. Dumb data access
  only — no business rules. e.g. `BookingRepository`, `AvailabilityRepository`.
- **Services**: business logic + orchestration layer above repositories. e.g.
  `BookingService.book()` checks slot availability, confirms T&Cs acceptance recorded,
  creates the booking, triggers owner notification.
- **Hooks**: React-facing glue (`useBooking()`, `useAvailability()`) — call services,
  expose state/loading/errors to components. Components stay presentational only.

Rationale: swapping backend tech or changing a business rule only touches one layer,
never the UI.

### Backend
- **Supabase**: Postgres DB, Auth (customer accounts/login), Row Level Security
  (lets frontend query safe data directly without custom API), Storage if needed.
- **Node.js + TypeScript**: thin custom backend for what Supabase shouldn't handle
  client-side directly:
  - Payment provider integration + webhook handling (secret keys, server-only)
  - Owner notifications (email/SMS/WhatsApp) on new bookings
  - Recording proof of T&Cs acceptance (timestamp, version, possibly IP) per booking

### Payments
- **Paystack** confirmed as the payment provider. Node backend handles Paystack
  webhook (payment confirmation) server-side; booking should only be marked confirmed
  after webhook verifies successful payment (not just on client-side redirect).

## Style / Design
- (nothing yet)

## Logic / Flows
- Booking → T&Cs consent (blocking) → Payment → Confirmation → Owner notified.

### Availability / booking logic
- Owner manages availability **fully manually, date-by-date** (not a recurring weekly
  template) — owner opens a calendar view and marks/opens specific dates & time slots
  themselves. Gives full control, more hands-on upkeep per the owner's preference.
- Customers only ever see and can select dates/slots the owner has explicitly opened —
  everything else greyed out / unavailable in the date picker.
- Once a slot is booked, it's immediately removed from the available pool (no double
  booking).

## Commercials / Pricing
- **Development fee**: ₦250,000
- **Setup, environment & production fee**: ₦70,000 — includes domain, database, and
  post-production setup.
- **Total**: ₦320,000
- **Post-handover maintenance**: 2 months of maintenance (bug fixes/minor adjustments)
  included free after handover; anything beyond that window or new scope is billed
  separately.
- **Payment schedule**: 70% before commencement (₦224,000), 30% after completion
  (₦96,000).
- **Payment account**: 9133328567 — Opay — Omotosho Peter Oluwadarasimi.
- (Internal/business terms — not customer-facing site content.)

## Deliverables
- [sitemap.md](sitemap.md) — full page-by-page breakdown of the site and how the
  pages connect into one flow. Generated 2026-08-29.

---

## New requirements — 2026-09-26

### Booking system pivot: accounts required (supersedes guest-booking assumption)
- Customers must **sign in before booking** (Supabase Auth) — the guest-booking
  assumption flagged in [sitemap.md](sitemap.md) is now overridden.
- Personal details + booking details saved together against the account.
- Payment confirmation still required before a booking counts as made (webhook-verified,
  as already decided).

### Deposit requirement
- Minimum **70% deposit** required to make a "successful" booking/deposit — but customers
  aren't forced to pay exactly 70%. They can choose to pay the full 100% upfront instead.
  Correction from the client, 2026-09-26: presented as two preset buttons at payment time —
  "Pay minimum deposit (70%)" or "Pay in full (100%)" — no arbitrary custom amount.
- Whatever remains unpaid (if the 70% option was chosen) must be paid before the session —
  reminders below.

### Balance reminder emails
- Once the 70% deposit is paid, send the customer a reminder email **every 24 hours**
  that the remaining balance is due, until it's settled — must be resolved **24 hours
  before the session** at the latest.
- Open question: what happens if unpaid by that 24-hour cutoff (auto-cancel/release the
  slot vs. owner decides manually) — asked separately.

### Portfolio / exhibition page (producer + videographer work)
- Owner wants a dedicated page/workspace to upload and showcase their work (production +
  videography) — an exhibition-style gallery of videos, publicly viewable.
- Open question: implemented as a path on the main site vs. a subdomain — asked separately.

### Existing video content (YouTube/Instagram)
- Owner already has session recordings on YouTube/Instagram (links, not raw files).
- Need an approach to embed these without bloating the DB or hurting page load.
- Open question: lazy-loaded embed facade (store URL only, defer iframe load) vs.
  re-hosting via Cloudinary — asked separately, but facade is the likely fit since the
  footage already lives on YouTube/Instagram rather than as raw files we own.

### Lovable prototype (source of truth for services/packages)
Prototype at https://genieprostudios.lovable.app. Extracted service/pricing info to fold
into `/services` and the booking flow:

**Rehearsal Sessions**
- Day: 1hr ₦30,000 · 2hrs ₦60,000 · 3hrs ₦90,000
- Night: 4hrs ₦80,000 · 6hrs ₦100,000

**Multi-track Recording**
- Day: 2hrs ₦100,000 · 4hrs ₦200,000 · 6hrs ₦250,000
- Night: 2hrs ₦100,000 · 4hrs ₦200,000 · 6hrs ₦250,000

**Video Livestream (iPhone single angle)**
- Day: 1hr ₦50,000 · 2hrs ₦80,000

**Virtual Package (Facebook/YouTube Live)**
- Day: 2hrs ₦80,000 · 3hrs ₦120,000
- Night: 4hrs ₦160,000

**Post-Production Add-ons**
- Mix + Master Bundle: ₦200,000/song
- Mixing & Mastering: ₦80,000/song

Other prototype details worth carrying over:
- 30-minute mandatory setup buffer between booked slots (affects availability/slot logic).
- Real-time equipment inventory management (not yet scoped here — flag if owner wants this).
- Prototype's own reminder cadence was 3/2/1 days + 45/30 min before session — differs from
  the new 24-hour deposit-balance reminder ask above; the 24-hour balance reminder is the
  one actually requested now, treat as the spec unless owner says otherwise.

### Supabase project status
- No Supabase project has been created/linked yet. `@supabase/supabase-js` and `@supabase/ssr`
  are installed and `lib/supabase/{client,server,admin}.ts` are scaffolded, but
  `.env.example` keys are blank and there's no `supabase/config.toml` — nothing's connected.
- Plan to avoid free-tier auto-pause once created: schedule a trivial `pg_cron` job (e.g. a
  daily upsert into a `heartbeat` table) via the Database > Extensions / cron.schedule() in
  Supabase, so the project shows real DB activity daily and doesn't get paused for inactivity.

---
*Last updated: 2026-09-26*
