import type { Metadata } from "next";

// app/(marketing)/about/page.tsx is a Client Component (framer-motion
// throughout), and Client Components can't export `metadata` — this sibling
// layout is the standard Next.js workaround: a plain Server Component that
// only supplies metadata and passes children through untouched.
export const metadata: Metadata = {
  title: "About the Studio",
  description:
    "Genie Pro Studios started as a home for gospel sessions that needed to be captured properly — rehearsal space, a full recording setup, and mixing and mastering, all in one place.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
