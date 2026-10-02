"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

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

// Each "variant" reuses the one real studio photo the business has today
// (digital-space.jpg), panning to a different framing and swapping the
// accent between Triumph's two actual brand colors — teal and blue, sampled
// from the real logo gradient (see brand-glow.tsx) — rather than inventing
// off-brand colors just to manufacture variety. `image` is its own field
// per slide so a distinct real photo can drop in here later with no
// structural change, once there's more than one photo to rotate through.
type HeroVariant = { image: string; focus: string; accent: string };

const HERO_VARIANTS: HeroVariant[] = [
  { image: "/images/digital-space.jpg", focus: "55% 35%", accent: "#22e6c8" },
  { image: "/images/digital-space.jpg", focus: "15% 70%", accent: "#1d3fd6" },
  { image: "/images/digital-space.jpg", focus: "85% 20%", accent: "#22e6c8" },
  { image: "/images/digital-space.jpg", focus: "40% 85%", accent: "#1d3fd6" },
];

const ROTATE_MS = 6000;

// useSyncExternalStore, not useState+useEffect — this is exactly the case
// React built it for: a value (window width) that only exists on the
// client, where the server has no opinion. getServerSnapshot's `false`
// becomes the hydration baseline, and React reconciles the real value after
// mount without the "client's first render already disagreed with the
// server HTML" mismatch that useState(() => window...) produced.
function subscribeToDesktopQuery(callback: () => void) {
  const mql = window.matchMedia("(min-width: 768px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getDesktopQuerySnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function getDesktopQueryServerSnapshot() {
  return false;
}

// Plain two-panel split rather than a glow/gradient-heavy background — a
// solid dark text panel next to a full-bleed photo of the studio's
// production desk, which rotates on a timer (photo framing + accent color)
// the way the SoundBetter reference hero does. Paused while the tab is
// hidden — same visibilitychange discipline as project-status-timeline.tsx's
// polling, no reason to keep ticking a slide show nobody's looking at.
export function TriumphHero() {
  const [index, setIndex] = useState(0);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopQuerySnapshot,
    getDesktopQueryServerSnapshot,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      setIndex((i) => (i + 1) % HERO_VARIANTS.length);
    }
    function start() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(tick, ROTATE_MS);
    }
    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const variant = HERO_VARIANTS[index];

  return (
    <section className="grid grid-cols-1 overflow-hidden border-b border-border bg-background md:min-h-[680px] md:grid-cols-2">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col justify-center gap-6 px-6 py-20 sm:px-10 md:px-14 lg:px-20"
      >
        <motion.h1
          variants={item}
          className="max-w-xl font-heading text-5xl leading-[1.05] font-medium tracking-tight text-foreground sm:text-6xl"
        >
          Mixing &amp; mastering, built for the moment your song needs to land.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Send in your session, get back a mix that&apos;s ready — clean, balanced, and
          radio-ready, wherever it&apos;s played.
        </motion.p>

        <motion.div variants={item} className="flex flex-wrap items-center gap-4 pt-2">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-none px-7 text-sm font-medium text-background transition-colors duration-700 hover:opacity-90"
            style={{ backgroundColor: variant.accent }}
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

        <motion.div
          variants={item}
          className="mt-2 flex items-center gap-1.5"
          role="tablist"
          aria-label="Hero photo"
        >
          {HERO_VARIANTS.map((v, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className="h-1 w-6 rounded-none transition-colors duration-700"
              style={{ backgroundColor: i === index ? variant.accent : "var(--border)" }}
            />
          ))}
        </motion.div>
      </motion.div>

      <div
        className="relative min-h-[320px] sm:min-h-[420px] md:min-h-0"
        style={isDesktop ? { clipPath: "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)" } : undefined}
      >
        <Image
          src={variant.image}
          alt="Triumph Music Global's production desk — dual monitors, MIDI keyboard, and pad controller lit in red"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover transition-[object-position] duration-[1600ms] ease-in-out"
          style={{ objectPosition: variant.focus }}
        />
      </div>
    </section>
  );
}
