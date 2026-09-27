# `/work` — Design Brief (Phase 5)

> Adapted from a personal-portfolio design brief the user supplied, retargeted for GenieProStudios's
> `/work` exhibition page — the owner's producer/videographer showcase (per [sitemap.md](sitemap.md)
> and [project-notes.md](project-notes.md)). Same design *caliber* and motion language, different
> content structure: `/work` is one page in a larger site that already has separate `/about`,
> `/services`, and `/contact` pages, so this brief does not duplicate those.

## Stack (unchanged, already in place)
Next.js App Router, Tailwind CSS, Framer Motion (already a dependency), Supabase for
`portfolio_entries` data. No new stack additions needed.

## Design direction — "stereo vibe," not generic AI portfolio

Same anti-generic mandate as the original brief (no purple-blue gradients, no default-Inter
headlines, no floating 3D blobs, no identical glassmorphism grids) — reskinned around analog
audio-gear warmth instead of tech-startup cool.

- **Base**: near-black (`#0A0A0B`) — a control-room, lights-down mood, which a recording studio
  can lean into more literally than most brands.
- **Accent (recommended)**: warm amber/copper (`#E8A33D`–`#FF8A3D` range) — reads as VU-meter
  needle glow / tube-amp warmth / vintage receiver dial lighting. This is the "stereo" cue: it's
  the one color a real analog mixing console or hi-fi receiver actually uses. (Alternative if you'd
  rather go modern-digital instead of vintage-analog: electric teal `#2DD4BF`, evoking a DAW
  waveform/EQ display. Recommend amber — more distinctive, less "generic AI teal.")
- **Text**: warm off-white (`#F5F1EA`, not a cold blue-white) — ties to the amber rather than
  fighting it.
- **Type**: keep Geist (already used site-wide, see `app/layout.tsx`) for body copy for
  consistency with the rest of the site. Headlines get a distinctive display font with some
  technical/nameplate character — direction: something geometric with a bit of edge (e.g. Space
  Grotesk, Bricolage Grotesque) rather than another default-Inter-looking headline font. Final
  pick TBD once you've seen it in context.
- **Texture**: subtle grain/noise over the near-black background — doubles as "tape hiss/vinyl
  grain," which is thematically on-the-nose here in a good way.
- **Theme switching — flag, not yet decided**: the rest of the site has no light/dark toggle
  anywhere. Recommend `/work` commits to a **fixed dark** aesthetic rather than adding
  light/dark/system switching just for this one page — a control-room mood reads better as
  deliberately dark than as a "you can lighten it" option, and it avoids introducing
  theme-consistency questions for the rest of the site that haven't been asked for. Say the word
  if you'd rather have full site-wide theme switching instead — bigger scope, touches Phase 6 too.

## Hero section (adapted)

Same asymmetric technique as the original brief, different subject:

- **Visual centerpiece**: `[owner at the mixing console / in the booth — placeholder until real
  photography supplied]`, anchored to one side in a circular/squircle frame — same technique as
  the personal-portfolio brief, just a studio photo instead of a headshot.
- **Decorative rings**, reskinned: instead of generic arcs, these read as a **turntable platter /
  vinyl groove motif** or a **VU-meter dial sweep** — thin concentric arcs at varied scale/opacity
  around the photo frame, some clipped at the container edge, one or two with slow independent
  rotation (a literal spinning-record cue) or scroll/mouse parallax.
- **Copy side**: eyebrow label (`SELECTED WORK`), oversized headline — a positioning statement
  about the studio's craft (`[headline — e.g. "Sound, shot right." — placeholder]`), short
  supporting line, primary CTA (**Book a Session** → `/book`) + secondary CTA (**View Services** →
  `/services`, or a scroll-anchor down to the work grid).

## Gamification (subtle, on-theme)

- Custom cursor hover state — styled as a small ▶ play glyph or a "●REC" dot when hovering a work
  card, rather than a generic pointer swap. Ties directly to the video content instead of being
  decoration for its own sake.
- Animated count-up stats — real numbers once supplied: `[X] sessions produced`, `[X] artists
  worked with`, `[X] years running`.
- Scroll progress indicator — as in the original brief, no changes needed.
- Hover-reveal detail chips on work cards — platform icon (YouTube/Instagram), category, date.
- One tasteful hidden easter egg — low priority, ships after the core structure: something like a
  hidden "power LED" dot that triggers a brief tape-warble visual pulse, on-theme with the rest of
  the gamification rather than a generic hidden interaction.

## Sections (retargeted against the existing sitemap — see note below each dropped section)

1. **Hero** — as above.
2. **Craft / stats teaser** — a condensed narrative blurb + the count-up stats, *not* the full
   `/about` page content. Ends with "Learn more about the studio →" linking to `/about`. This is
   glue, not a duplicate About section.
3. **Selected Work** — the actual core of the page. Filterable grid, categories mapped to the
   studio's real service categories (Recording, Rehearsal, Livestream, Mix & Master — matching
   `services.category` already in the DB) rather than the personal brief's software-project
   categories. **Schema gap**: `portfolio_entries` (migration `0008`) has no category field yet —
   needs a small new column + migration to support filtering. **Correction (2026-09-26):** every
   entry gets its own real detail page at `/work/[id]` — not an inline expand as originally drafted
   here. The grid itself still uses the lazy-loaded thumbnail-first facade (no eager iframes), but
   clicking a card navigates to `/work/[id]`, which is where the actual embed plays, alongside the
   entry's `title`/`description` and platform badge. No per-video "problem/approach/result + tech
   stack" narrative fields exist in the schema (that was the original personal-portfolio brief's
   software-case-study framing) — the detail page works with what `portfolio_entries` actually has
   (title, description, platform, video reference), not an invented structure.
4. **Collaborations** (optional, recommend a simple v1) — typographic-only cards naming notable
   artists/clients worked with (name + genre/role), no images, similar spirit to the original
   brief's NDA-work cards. Needs a short list of real names from the owner; simple enough to
   hardcode for v1 rather than building a CMS table for what's likely an occasionally-updated list.
5. **Closing CTA** — "Ready to create something? Book a session" banner linking to `/book`,
   instead of a full contact form (that's `/contact`'s job).
6. **Footer** — shared site footer, not redesigned per-page.

**Deliberately dropped from the original brief** (would duplicate already-planned pages):
Rate Card (→ already `/services`), full About section (→ already `/about`), Process (→ the
booking flow on `/book` already tells this story, a second explanation here would be redundant),
full Testimonials section and Contact form (→ recommend testimonials as a couple of short quotes
folded into the Craft/stats teaser rather than a whole dedicated section, and Contact stays on
`/contact`).

## Motion
Spring-based easing throughout, scroll-triggered reveals with staggered children for the work
grid, matching the original brief — no changes needed here, this part of the language travels
well regardless of subject matter.

## Open decisions before implementation
1. Amber/copper accent (recommended) vs. teal, or a different color entirely — "colors can
   change" per your note, the above is a starting recommendation, not a final call.
2. Fixed dark `/work` vs. site-wide theme switching (recommended: fixed dark, see above).
3. Include the Collaborations section for v1, or hold it for later once real names are supplied?
4. Confirm the `portfolio_entries` category-column addition before implementation starts (small
   migration, not a blocker, just flagging it now so it's not a surprise mid-build).
