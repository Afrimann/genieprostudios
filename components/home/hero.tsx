"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

// Decorative ring/arc motif around the thumbnail cluster — reads as a
// turntable platter / VU-meter dial sweep rather than generic decoration,
// per work-page-design-brief.md's "stereo vibe" direction. Each ring
// rotates slowly and independently; varied radius/opacity/stroke so they
// don't read as one flat repeated element. Purely decorative — aria-hidden.
function DecorativeRings() {
  const rings = [
    { radius: 46, opacity: 0.5, dash: "1 14", duration: 90, dir: 1 },
    { radius: 44, opacity: 0.28, dash: "3 10", duration: 70, dir: -1 },
    { radius: 41.5, opacity: 0.16, dash: "0.5 6", duration: 130, dir: 1 },
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-[-12%] h-[124%] w-[124%]"
    >
      {rings.map((ring, i) => (
        <motion.circle
          key={i}
          cx="50"
          cy="50"
          r={ring.radius}
          fill="none"
          stroke="var(--amber-glow)"
          strokeWidth={0.5}
          strokeDasharray={ring.dash}
          style={{ opacity: ring.opacity }}
          animate={{ rotate: 360 * ring.dir }}
          transition={{
            duration: ring.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </svg>
  );
}

// A curated handful of real session thumbnails (same catalog as
// components/home/featured-session.tsx / sessions-reel.tsx) floating and
// gently drifting in a tilted, overlapping cluster — replaces the old empty
// "[studio photo — placeholder]" box with something that's actually true
// today (real footage) and does the "crazy, graphical" work the hero needs,
// per the "more fun and graphical, very crazy and attractive" direction.
// Hardcoded rather than fetched: this is a fixed decorative selection (not
// meant to reflect the live catalog 1:1 the way FeaturedSession/SessionsReel
// do), and keeping Hero a plain Client Component avoids restructuring its
// server/client boundary for five thumbnail URLs.
const FLOATING_CARDS = [
  {
    id: "boGA3hV46eo",
    className: "left-[6%] top-[4%] w-[42%] rotate-[-8deg]",
    floatDelay: 0,
    floatDuration: 6.5,
  },
  {
    id: "C-CavnIlXXg",
    className: "right-[2%] top-[14%] w-[38%] rotate-[6deg]",
    floatDelay: 0.6,
    floatDuration: 7.5,
  },
  {
    id: "G1FHmRH-Mio",
    className: "left-[20%] top-[46%] w-[40%] rotate-[5deg]",
    floatDelay: 1.1,
    floatDuration: 8,
  },
  {
    id: "hcvMwvY-x-s",
    className: "right-[8%] bottom-[6%] w-[36%] rotate-[-5deg]",
    floatDelay: 0.3,
    floatDuration: 7,
  },
  {
    id: "5gwH5abVP4U",
    className: "left-[2%] bottom-[16%] w-[30%] rotate-[10deg]",
    floatDelay: 0.9,
    floatDuration: 6,
  },
];

function FloatingThumbnails() {
  return (
    <>
      {FLOATING_CARDS.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: [0, -10, 0],
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.3 + i * 0.1 },
            scale: { duration: 0.5, delay: 0.3 + i * 0.1 },
            y: {
              duration: card.floatDuration,
              delay: card.floatDelay,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          whileHover={{ rotate: 0, scale: 1.08, zIndex: 20 }}
          className={`absolute z-10 aspect-square overflow-hidden rounded-2xl border-2 border-[var(--amber-glow)]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${card.className}`}
        >
          {/* maxresdefault = the true 1280x720 HD thumbnail, same
              resolution FeaturedSession/SessionsReel use via
              resolveThumbnailUrl — falls back to hqdefault on load error
              (all five of these are confirmed to have a maxres thumbnail,
              but the fallback stays for parity with the shared facade). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${card.id}/maxresdefault.jpg`}
            alt=""
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallback) return;
              img.dataset.fallback = "true";
              img.src = `https://img.youtube.com/vi/${card.id}/hqdefault.jpg`;
            }}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </motion.div>
      ))}
    </>
  );
}

// Tiny looping "live meter" next to the eyebrow tag — a few bars pulsing at
// staggered, offset durations so they never sync up, reading as a real VU
// meter rather than a single repeating blink.
function LiveMeter() {
  const bars = [0.9, 1.3, 1.05, 1.4, 0.95];

  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
      {bars.map((mult, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-none bg-[var(--amber-glow)]"
          initial={{ height: 4 }}
          animate={{ height: [4, 14 * mult, 4] }}
          transition={{
            duration: 0.9 + i * 0.15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
    </span>
  );
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 26 },
  },
};

export function Hero() {
  return (
    <section className="bg-grain relative overflow-hidden bg-background">
      <div className="relative z-[1] mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 md:grid-cols-[1.1fr_0.9fr] md:py-32">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="order-2 flex flex-col items-start gap-6 md:order-1"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2.5 text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase"
          >
            Genie Pro Studios
            <LiveMeter />
          </motion.span>

          <motion.h1
            variants={item}
            className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            Sound, shot right.
          </motion.h1>

          <motion.p
            variants={item}
            className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Recording, rehearsal, and production sessions — built for artists who want
            the finished sound and the finished footage in one booking.
          </motion.p>

          <motion.div variants={item} className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-none bg-[var(--amber-glow)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
            >
              <Link href="/book">Book a session</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-none border-border/60 bg-transparent px-7 text-sm font-medium text-foreground hover:bg-secondary"
            >
              <Link href="/services">View services</Link>
            </Button>
          </motion.div>
        </motion.div>

        <div className="relative order-1 mx-auto aspect-square w-full max-w-sm md:order-2">
          <DecorativeRings />
          <FloatingThumbnails />
        </div>
      </div>
    </section>
  );
}
