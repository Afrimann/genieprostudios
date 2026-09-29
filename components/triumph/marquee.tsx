"use client";

import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";

const MARQUEE_TEXT = "Mixing — Mastering — Vocal Tuning — Production — ";

// Same "LED character display / tape-counter readout" scrolling mechanism as
// components/home/mission-marquee.tsx — reused here for site-wide visual
// consistency (no video behind it though, this page has none to spare —
// plain amber-on-background instead).
export function TriumphMarquee() {
  const repeated = Array.from({ length: 4 }, () => MARQUEE_TEXT).join("");

  return (
    <section className="border-b border-[#22e6c8]/30 bg-card py-8">
      <Reveal
        className="overflow-hidden"
        role="text"
        aria-hidden="false"
        aria-label={MARQUEE_TEXT.replace(" — ", "")}
      >
        <motion.p
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 20, ease: "linear", repeat: Infinity }}
          className="font-mono text-xl whitespace-nowrap text-[#22e6c8] sm:text-2xl"
        >
          {repeated}
          {repeated}
        </motion.p>
      </Reveal>
    </section>
  );
}
