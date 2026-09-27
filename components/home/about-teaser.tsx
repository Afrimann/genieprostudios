"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { CountUp } from "@/components/home/count-up";
import { Reveal } from "@/components/ui/reveal";

// Deliberately not another photo+decorative-ring composition (that's the
// Hero's language, once is enough) — stats read as a small bank of VU
// meters: vertical bars at varied heights, each capped by its own count-up
// number, evoking a mixing console meter bridge rather than a generic
// stat-card grid.
// TODO(client): estimates pending real figures from the studio owner —
// swap these three for exact numbers whenever they're confirmed.
const STATS = [
  { value: 100, suffix: "+", label: "sessions produced", barHeight: 62 },
  { value: 20, suffix: "+", label: "artists worked with", barHeight: 88 },
  { value: 5, suffix: "", label: "years running", barHeight: 44 },
];

export function AboutTeaser() {
  return (
    <section className="border-t border-border bg-background">
      <Reveal className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-16 px-6 py-24 md:grid-cols-[0.85fr_1.15fr] md:items-center">
        {/* w-full + justify-between on mobile: three fixed max-w-[7rem]
            labels with a gap-5 flex row don't fit a narrow viewport (the
            row was overflowing past the right edge, cutting off the third
            "years running" stat entirely) — splitting the full row width
            evenly guarantees all three fit regardless of exact text
            wrapping. md+ reverts to the original left-aligned, natural-width
            layout since there's room to spare there. */}
        <div className="flex w-full items-end justify-between gap-2 md:w-auto md:justify-start md:gap-5">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: stat.barHeight }}
                // Vertical-only margin — see count-up.tsx's identical fix:
                // a bare "-80px" also shrinks left/right, which excluded the
                // edge stats (now spread via justify-between on mobile) from
                // ever registering as in-view.
                viewport={{ once: true, margin: "-80px 0px" }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: "easeOut" }}
                className="w-3 rounded-none bg-[var(--amber-glow)]"
                style={{ maxHeight: stat.barHeight }}
              />
              <p className="font-heading text-2xl font-medium text-foreground">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="max-w-[5.5rem] text-center text-xs text-muted-foreground md:max-w-[7rem]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start gap-5">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            About the studio
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Where gospel sound finds its room.
          </h2>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            Genie Pro Studios is built around one thing: capturing a session the way it
            actually sounded in the room. From spontaneous worship to full multitrack
            productions, we&apos;ve hosted gospel artists and live performances with the
            gear and the ears to match — rehearsal space, a proper recording rig, and
            mixing and mastering, all under one roof.
          </p>
          <Link
            href="/about"
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-[var(--amber-glow)]"
          >
            Learn more about the studio →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
