"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { BrandGlow } from "@/components/triumph/brand-glow";

// Decorative rings orbiting the logo — same ring-motif mechanism as
// components/home/hero.tsx's DecorativeRings, reused here around the real
// logo mark instead of a thumbnail cluster. Plain CSS animation (not
// framer-motion's animate()) — see globals.css's spin-cw/spin-ccw comment
// for why: this loops forever regardless of scroll position, and a JS/rAF
// loop for that is exactly what compounded into real mobile scroll jank.
function DecorativeRings() {
  const rings = [
    { radius: 48, opacity: 0.45, dash: "1 14", duration: 90, spin: "animate-spin-cw" },
    { radius: 44, opacity: 0.25, dash: "3 10", duration: 70, spin: "animate-spin-ccw" },
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-[-18%] h-[136%] w-[136%]"
    >
      {rings.map((ring, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={ring.radius}
          fill="none"
          stroke="#22e6c8"
          strokeWidth={0.5}
          strokeDasharray={ring.dash}
          className={`origin-center ${ring.spin}`}
          style={{ opacity: ring.opacity, animationDuration: `${ring.duration}s` }}
        />
      ))}
    </svg>
  );
}

// Same staggered-bar VU meter as home/hero.tsx's LiveMeter, as a CSS
// animation (see globals.css's meter-pulse) rather than framer-motion.
function LiveMeter() {
  const bars = [0.9, 1.3, 1.05, 1.4, 0.95];

  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
      {bars.map((mult, i) => (
        <span
          key={i}
          className="animate-meter-pulse w-[3px] rounded-none bg-[#22e6c8]"
          style={{
            height: 4,
            animationDuration: `${0.9 + i * 0.15}s`,
            animationDelay: `${i * 0.1}s`,
            ["--meter-bar-height" as string]: `${14 * mult}px`,
          }}
        />
      ))}
    </span>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 26 },
  },
};

// Original copy, not a copy of the reference site's own sentences — only
// the section's role/layout is modeled after gospelsoundclinic.studio's
// hero: single-column, centered text with a graphic above the headline.
// Here that graphic is the real Triumph Music Global logo, ringed with the
// site's DecorativeRings motif, over a soft blue/teal brand-glow background
// (see brand-glow.tsx) rather than a flat solid section background.
export function TriumphHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <BrandGlow />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-[1] mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center md:py-32"
      >
        <motion.div variants={item} className="relative flex items-center justify-center py-4">
          <DecorativeRings />
          <Image
            src="/images/triumph-logo-mark.png"
            alt="Triumph Music Global"
            width={150}
            height={84}
            priority
            className="relative z-[1] h-10 w-auto rounded-lg bg-white p-1.5 shadow-[0_0_40px_rgba(34,230,200,0.25)] sm:h-12"
          />
        </motion.div>

        <motion.span
          variants={item}
          className="inline-flex items-center gap-2.5 text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase"
        >
          …built for great sound
          <LiveMeter />
        </motion.span>

        <motion.h1
          variants={item}
          className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-foreground sm:text-6xl"
        >
          Mixing &amp; mastering, built for the moment your song needs to land.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Send in your session, get back a mix that&apos;s ready — clean, balanced, and
          radio-ready, wherever it&apos;s played.
        </motion.p>

        <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-none bg-[var(--amber-glow)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="#start-project">Start Your Project</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-none border-border/60 bg-transparent px-7 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <Link href="#pricing">See pricing</Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
