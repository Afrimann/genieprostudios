import type { Metadata } from "next";
import { Fraunces, Space_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

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

export const metadata: Metadata = {
  title: "GenieProStudios",
  description: "Recording, rehearsal, and production sessions.",
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
      </body>
    </html>
  );
}
