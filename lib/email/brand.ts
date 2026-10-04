import { emailAssetUrl } from "@/lib/utils/site-url";

// One config per sender identity used by lib/services/email-service.ts.
// Deliberately two separate brands, not one with a "mode" flag — Triumph
// Music Global and GenieProStudios already read as distinct businesses
// everywhere else in this codebase (separate header/footer, separate JSON-LD,
// separate metadata — see app/triumph/page.tsx's own comment), so their
// email identity shouldn't quietly merge into one shared look either.
export type EmailBrand = {
  name: string;
  logoUrl: string;
  logoAlt: string;
  logoWidth: number;
  logoHeight: number;
  /** Eyebrow label color and the top accent bar. No gradients — solid fills only. */
  accentColor: string;
  /** CTA button fill — kept separate from accentColor since a brand's accent isn't always the best button fill for contrast (see Triumph below). */
  ctaColor: string;
  ctaTextColor: string;
  headingColor: string;
};

// Amber (#f2c230) is this site's one CTA/accent color on the dark website
// theme (see app/globals.css's --amber-glow and its own comment reserving
// --moss for status signals only) — reused here as the single accent rather
// than inventing an email-only palette.
export const GENIE_PRO_BRAND: EmailBrand = {
  name: "Genie Pro Studios",
  logoUrl: emailAssetUrl("/images/logo.png"),
  logoAlt: "Genie Pro Studios",
  logoWidth: 40,
  logoHeight: 34,
  accentColor: "#f2c230",
  ctaColor: "#f2c230",
  ctaTextColor: "#120b16",
  headingColor: "#120b16",
};

// Blue (#1d3fd6) carries the CTA buttons for contrast/legibility reasons
// (white text on the brand's teal reads too light); teal (#22e6c8) stays for
// the eyebrow label and top accent bar — same two brand colors used across
// components/triumph/*, just split by role instead of alternating randomly.
export const TRIUMPH_BRAND: EmailBrand = {
  name: "Triumph Music Global",
  logoUrl: emailAssetUrl("/images/triumph-logo-mark.png"),
  logoAlt: "Triumph Music Global",
  logoWidth: 57,
  logoHeight: 32,
  accentColor: "#22e6c8",
  ctaColor: "#1d3fd6",
  ctaTextColor: "#ffffff",
  headingColor: "#0a1230",
};
