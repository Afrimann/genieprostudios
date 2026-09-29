"use client";

import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";
import { AmbientVideo } from "@/components/media/ambient-video";

const MISSION_TEXT = "Every session leaves with a mix that's ready, not almost ready. — ";

// Reads as an LED character display / tape-counter readout scrolling past —
// a distinct mechanism from the About section's meter bars and the Hero's
// ring motif, so no two sections lean on the same visual trick. Stage
// footage (a real worship set, lit purple/gold) runs silently behind it —
// same stage-lighting palette the site's theme is built from.
export function MissionMarquee() {
  const repeated = Array.from({ length: 4 }, () => MISSION_TEXT).join("");

  return (
    <section className="relative border-t border-border bg-card py-14">
      <AmbientVideo
        src="/videos/stage-glow.mp4"
        poster="/videos/posters/stage-glow.jpg"
        overlayClassName="bg-background/80"
      />
      <Reveal
        className="relative z-[1] overflow-hidden"
        role="text"
        aria-hidden="false"
        aria-label={MISSION_TEXT.replace(" — ", "")}
      >
        <motion.p
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 22, ease: "linear", repeat: Infinity }}
          className="font-mono text-2xl whitespace-nowrap text-[var(--amber-glow)] sm:text-3xl"
        >
          {repeated}
          {repeated}
        </motion.p>
      </Reveal>
    </section>
  );
}
