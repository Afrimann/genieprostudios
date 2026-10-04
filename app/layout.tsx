import type { Metadata } from "next";
import { Fraunces, Space_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

import { SITE_URL, absoluteUrl } from "@/lib/utils/site-url";
import { serializeJsonLd } from "@/lib/utils/json-ld";

// "Tape Room" identity (2026-09-27, studio-color-scheme-v2 reference):
// Fraunces (serif) carries both body copy and headings — no separate
// display font, per the reference's editorial/film-not-screen direction.
// Includes italic for emphasis accents (e.g. the hero's "the slow way").
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Space Mono replaces Geist Mono for the same role (nav labels, prices,
// timestamps, uppercase-tracked kickers) — matches the reference's
// tape-box/stamped-label mono treatment.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Site-wide defaults — every route inherits these unless it exports its own
// `metadata`/`generateMetadata`, which deep-merges over this rather than
// replacing it (Next's metadata resolution). metadataBase makes every
// relative OG/icon/canonical URL elsewhere in the app resolve against
// SITE_URL automatically, so those don't need to repeat the domain.
// app/triumph's own layout does NOT export metadata of its own — instead
// app/triumph/page.tsx sets its own title/description/OG directly, which is
// enough to override these defaults for that one route without needing a
// parallel root-metadata block.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Genie Pro Studios",
  url: SITE_URL,
  logo: absoluteUrl("/images/logo.png"),
  description: "Recording, rehearsal, and production sessions for gospel artists.",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GenieProStudios — Recording, Rehearsal & Production Sessions",
    template: "%s | GenieProStudios",
  },
  description:
    "Recording, rehearsal, and production sessions for gospel artists — capture the room, not just the take. Book multitrack recording, rehearsal space, livestreaming, and mixing & mastering.",
  keywords: [
    "gospel recording studio",
    "recording studio",
    "rehearsal space",
    "multitrack recording",
    "mixing and mastering",
    "video livestream studio",
    "gospel music production",
  ],
  applicationName: "GenieProStudios",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    siteName: "GenieProStudios",
    title: "GenieProStudios — Recording, Rehearsal & Production Sessions",
    description:
      "Recording, rehearsal, and production sessions for gospel artists — capture the room, not just the take.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "GenieProStudios — Recording, Rehearsal & Production Sessions",
    description:
      "Recording, rehearsal, and production sessions for gospel artists — capture the room, not just the take.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(ORGANIZATION_JSON_LD) }}
        />
      </body>
    </html>
  );
}
