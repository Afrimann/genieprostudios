"use client";

import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/home/count-up";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { BrandGlow } from "@/components/triumph/brand-glow";

// Cycling tilt per card — the same "photos pinned to a corkboard" trick as
// components/home/sessions-reel.tsx's ROTATIONS, applied to pricing cards
// instead of video thumbnails so the two "crazy" sections on this page each
// carry a visibly different content type through the same signature motif.
const ROTATIONS = ["-rotate-2", "rotate-2", "-rotate-1", "rotate-3", "-rotate-3"];

// Per-card mini VU-bar graphic — same mechanism as
// components/home/services-teaser.tsx's rack-unit bars, animated in on
// scroll rather than static.
const BAR_SETS = [
  [40, 65, 50, 80, 55],
  [55, 80, 45, 60, 70],
  [70, 50, 85, 60, 45],
  [45, 75, 55, 90, 65],
  [60, 40, 70, 50, 80],
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 240, damping: 22 },
  },
};

export function TriumphPricing() {
  return (
    <section id="pricing" className="relative scroll-mt-16 overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="center" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Transparent pricing
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Every service, priced up front.
          </h2>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px 0px" }}
          className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {TRIUMPH_PRICING_TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              variants={item}
              whileHover={{ rotate: 0, scale: 1.06, zIndex: 10 }}
              className={`${ROTATIONS[i % ROTATIONS.length]} flex flex-col gap-3 border p-5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)] ${
                tier.featured
                  ? "border-[#22e6c8] bg-[#22e6c8]/10"
                  : "border-border bg-background"
              }`}
            >
              {tier.featured && (
                <motion.span
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="w-fit bg-[#22e6c8] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#04211c] uppercase"
                >
                  Most popular
                </motion.span>
              )}

              <div className="flex items-end gap-1" aria-hidden="true">
                {BAR_SETS[i % BAR_SETS.length].map((height, j) => (
                  <motion.span
                    key={j}
                    initial={{ height: 0 }}
                    whileInView={{ height }}
                    viewport={{ once: true, margin: "-80px 0px" }}
                    transition={{ duration: 0.7, delay: j * 0.06, ease: "easeOut" }}
                    style={{ maxHeight: height }}
                    className="w-1.5 rounded-none bg-[#22e6c8]/70"
                  />
                ))}
              </div>

              <h3 className="font-heading text-lg font-medium text-foreground">{tier.name}</h3>
              <p className="font-heading text-2xl font-medium text-foreground">
                <CountUp to={tier.priceValue} prefix="$" durationSeconds={1.2} />
                <span className="text-sm font-normal text-muted-foreground">{tier.unit}</span>
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
              <p className="mt-auto font-mono text-xs text-muted-foreground">{tier.turnaround}</p>
            </motion.div>
          ))}
        </motion.div>
      </Reveal>
    </section>
  );
}
