# GenieProStudios — Site Map & Page Breakdown

> Every page the site will have, what it's for, and how they connect into one
> working flow. Based on notes in [project-notes.md](project-notes.md).

**Update 2026-09-26 (v2):** the home page is now a rich single-scroll marketing page with
its own Hero/About/Mission/Services/Packages/Testimonials/Contact sections — but this is
**in addition to**, not instead of, the full standalone pages those sections tease into.
Nothing gets folded away or dropped. Nav labels don't have to match route/page names 1:1
(e.g. "Dashboard" is represented as an icon + tooltip, not a text link — see below). Every
portfolio video also gets its own real detail page, not an inline expand.

---

## 1. Public-facing pages (customer side)

### `/` — Home
The front door, now a full single-scroll marketing page (not just a landing teaser),
built from stacked sections. Every section below is a **condensed teaser** that links out
to its own full page for the complete version — the home page never tries to *be* the
full `/about`, `/services`, or `/contact` experience, it just previews and links to them.

1. **Hero** — studio identity, primary CTA → `/book`, secondary CTA → `/services` or a
   scroll-anchor to the Services section below.
2. **About** (teaser) — condensed studio story → "Learn more" links to `/about`.
3. **Mission statement** — a short values/positioning statement. Home-only section (no
   separate `/mission` page planned; flag if you want one).
4. **Services** (teaser) — highlights of what's bookable, pulling from the same
   `services` table `/services` uses → links to `/services` for the full real pricing grid.
5. **Packages** — same underlying pricing data as Services, framed as bundled
   offerings/tiers rather than a flat list (e.g. grouping by category) → also links to
   `/services`, which remains the one source-of-truth pricing page. Treat Services +
   Packages as two presentational angles on one dataset, not two separate content types,
   unless you tell me otherwise.
6. **Testimonials** (teaser) — a few featured quotes. Home-only for now (no separate
   `/testimonials` page planned; flag if you want the full collection to have its own page).
7. **Contact** (teaser) — quick contact info/CTA → links to `/contact` for the full
   form/map/hours.
8. **Footer** — shared across every page, not just Home.

### `/about` — About
Full studio story, the space, the team/engineer(s). What Home's About teaser links to.

### `/services` — Services
Real, DB-driven pricing grid (already built) — session types, pricing per type, what's
included. Each card links straight into `/book` pre-filtered to that service.

### `/gallery` — Gallery
Photos of the studio and space itself — distinct from `/work`, which is the owner's
produced video output. Supports the "why book here" decision alongside `/about`.

### `/work` — Exhibition (producer + videographer portfolio)
Grid of the owner's production/videography work, publicly viewable, no login required.
Filterable by category (needs a small schema addition — `portfolio_entries` has no
category column yet). Uses the lazy-loaded thumbnail-first embed facade for the grid
itself (no eager iframes, no DB bloat) — but see below, clicking a card navigates to a
real detail page rather than expanding inline.

### `/work/[id]` — Work item detail *(new)*
Each portfolio entry's own page: the real video embed plays here, alongside its title,
description, and platform (YouTube/Instagram). Not an inline lightbox — a real route, so
each piece of work is individually linkable/shareable.

### `/contact` — Contact
Full location/map, contact form, socials, studio hours — what Home's Contact teaser
links to.

### `/sign-up`, `/login` — Account creation & sign-in
Supabase Auth. Required before a customer can book — no guest booking. Personal details
entered here get saved alongside every booking.

### `/book` — Book a Session *(the core page — see flow below)*
Requires an authenticated customer (redirects to `/sign-up` if not signed in). Multi-step
flow: service → date → time-window → start time (see the availability-windows rework) →
condensed T&Cs consent (checkbox, linking to full `/terms`) → deposit payment (Paystack,
customer chooses "pay minimum deposit" or "pay in full," never forced to exactly 70%).

### `/book/confirmation` — Booking Confirmation
Shown after payment, but only actually confirmed once the Paystack webhook verifies it
server-side (never the client redirect alone). Shows booking summary, reference, and
remaining balance if any. Triggers the owner notification.

Once a deposit lands, balance reminder emails fire until it's paid or the 24-hour-before-
session cutoff, at which point an unpaid booking auto-cancels and its slot releases.

### Bookings view — *not a text nav link*
Represented in the nav as an **icon with a tooltip** ("View your bookings"), not a
"Dashboard" text link — same page underneath (currently `/dashboard`; the route name is
an implementation detail and can be renamed later if you want the URL itself to read
`/bookings` instead, purely cosmetic, not blocking). Signed-in customers see booking
history, payment status, and can pay a remaining balance from here.

### `/terms` — Terms & Conditions (full)
The complete legal text — the source of truth the condensed booking-flow version links
back to.

### `/privacy` — Privacy Policy
Standard companion to `/terms`.

### `404` — Not Found
Standard catch-all with a way back to Home / Book a Session.

---

## 2. Admin-facing pages (owner side, authenticated via Supabase Auth) — unaffected by this update

### `/admin/login` — Admin Login
Owner-only sign-in. Not linked from public nav.

### `/admin/availability` — Availability Manager
Owner's calendar to open/close windows of time (per the windows rework — a window can
back many non-overlapping bookings, not just one).

### `/admin/bookings` — Bookings List
All bookings, filterable by date/status, payment status at a glance.

### `/admin/bookings/[id]` — Booking Detail
Full detail on one booking, including the T&Cs acceptance record.

### `/admin/portfolio` — Portfolio Manager
Where the owner uploads/manages `/work` entries (title, description, platform, video
reference, category once added, published toggle).

---

## 3. How it all connects (flow)

```
Home (Hero, About, Mission, Services, Packages, Testimonials, Contact teasers, Footer)
  │
  ├──> About ──────────┐
  ├──> Services ────────┤
  ├──> Gallery           │
  ├──> Work ──> Work/[id] ├──> Sign Up / Login ──> Book a Session ──> Confirmation ──> (owner notified)
  ├──> Contact           │                              │
  └──> Terms/Privacy ────┘                              └──(balance reminders until paid,
                                                              auto-cancel + slot release if missed)

Bookings icon (nav) ──> booking history, pay balance

Admin Login ──> Availability Manager ──(controls what's selectable in)──> Book a Session
                     │
                     ├──> Bookings List ──> Booking Detail
                     └──> Portfolio Manager ──(feeds)──> Work ──> Work/[id]
```

---

## Open items / assumptions to confirm
- **Mission statement** and **Testimonials** are treated as Home-only sections with no
  standalone page of their own — say so if you want either to also get its own full route.
- **Services vs. Packages**: treated as two framings of the same `services` table data,
  both teasing into the one real `/services` page — flag if "Packages" is actually meant
  to be a distinct concept (e.g. bundled multi-service offers at a special rate), since
  that would need new schema, not just a new section.
- **`/gallery` vs. `/work`**: kept as two separate pages — Gallery is studio/space photos,
  Work is the owner's produced video output. Say so if you'd rather merge them.
- `portfolio_entries` needs a new `category` column (small migration) to support filtering
  on `/work`, and `/work/[id]` is a new dynamic route not previously scoped.
- Notification channel for the owner (email/SMS/WhatsApp) — doesn't change the page map.
- Equipment inventory management — confirmed **out of scope** (2026-09-26).

---
*Generated: 2026-08-29, updated 2026-09-26 (v2)*
