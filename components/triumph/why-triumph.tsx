"use client";

import { motion } from "framer-motion";
import { Zap, Headphones, MessageCircle, Globe2 } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

const FEATURES = [
  {
    icon: Zap,
    title: "Fast turnaround",
    description: "Standard queue in days, not weeks — express options when the deadline is tight.",
  },
  {
    icon: Headphones,
    title: "Radio-ready masters",
    description: "Every mix leaves loud, clean, and consistent across every playback system.",
  },
  {
    icon: MessageCircle,
    title: "Direct communication",
    description: "Talk straight to the engineer working your song, not a support queue.",
  },
  {
    icon: Globe2,
    title: "Global clients",
    description: "Sessions sent in and delivered back from anywhere in the world.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 22 } },
};

// New content section (not on the reference site) added specifically to
// give the page a real "why us" moment between the hero/marquee and
// pricing, rather than jumping straight into numbers — also fills what was
// previously a long stretch of flat background between two content-dense
// sections.
export function TriumphWhy() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <BrandGlow variant="reverse" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <div className="flex flex-col gap-3 text-center">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Why Triumph
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            What you get, every time.
          </h2>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px 0px" }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={item}
                whileHover={{ y: -6 }}
                className="flex flex-col items-center gap-3 border border-border bg-card p-6 text-center transition-colors duration-300 hover:border-[#22e6c8]/50"
              >
                <div className="flex size-11 items-center justify-center rounded-none border border-[#22e6c8]/40 bg-[#22e6c8]/10">
                  <Icon className="size-5 text-[#22e6c8]" aria-hidden="true" />
                </div>
                <h3 className="font-heading text-base font-medium text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </Reveal>
    </section>
  );
}
