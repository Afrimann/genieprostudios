"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

import { CountUp } from "@/components/home/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";

// TODO(client): estimates pending real figures from the studio owner —
// kept in sync with components/home/about-teaser.tsx's STATS, swap both for
// exact numbers whenever they're confirmed.
const STATS = [
  { value: 100, suffix: "+", label: "sessions produced", barHeight: 68 },
  { value: 20, suffix: "+", label: "artists worked with", barHeight: 92 },
  { value: 5, suffix: "", label: "years running", barHeight: 48 },
];

// Real service categories (see supabase/migrations/0002_services.sql /
// lib/content/package-details.ts) — not invented copy, just the actual
// lineup read as a scrolling ticker.
const MARQUEE_TEXT =
  "Rehearsal. Recording. Livestream. Mixing. Mastering. — ";

// The real flow this app implements (booking -> deposit -> session/
// post-production -> delivery — see app/(marketing)/book), condensed to
// four steps that hold for both a room booking and a per-song mixing/
// mastering order.
const PROCESS_STEPS = [
  {
    number: "01",
    title: "Pick your package",
    description:
      "Browse rehearsal, recording, livestream, or mixing & mastering, then choose a date — or, for a mix, submit your tracks.",
  },
  {
    number: "02",
    title: "Secure it with a deposit",
    description:
      "A minimum 70% deposit through Paystack locks in your booking the moment you pay it.",
  },
  {
    number: "03",
    title: "Show up and create",
    description:
      "Arrive for your session and settle any remaining balance — or we start on your mix once your files are in.",
  },
  {
    number: "04",
    title: "Walk away with your sound",
    description:
      "Leave with your session captured, your stream delivered, or a release-ready mix in hand.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 26 },
  },
};

// Decorative waveform + rotating ring, same visual language as the homepage
// Hero's DecorativeRings/LiveMeter (components/home/hero.tsx) so this page
// reads as part of the same site rather than a one-off. Purely decorative —
// aria-hidden.
function HeroGraphic() {
  const bars = [0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.95, 0.5, 0.75, 0.45, 0.65, 0.3];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <motion.circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="var(--amber-glow)"
          strokeWidth={0.5}
          strokeDasharray="1 10"
          style={{ opacity: 0.35 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          stroke="var(--moss)"
          strokeWidth={0.5}
          strokeDasharray="0.5 6"
          style={{ opacity: 0.3 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      <div className="absolute inset-[14%] flex items-center justify-center rounded-none border border-border bg-card">
        <div className="flex items-end gap-[5px]" aria-hidden="true">
          {bars.map((mult, i) => (
            <motion.span
              key={i}
              className="w-[6px] rounded-none bg-[var(--amber-glow)]"
              initial={{ height: 6 }}
              animate={{ height: [6, 64 * mult, 6] }}
              transition={{
                duration: 1.6 + (i % 4) * 0.25,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.08,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="flex flex-col">
      <section className="bg-grain relative overflow-hidden border-b border-border bg-background">
        <div className="relative z-[1] mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 md:grid-cols-[1.1fr_0.9fr] md:py-32">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="order-2 flex flex-col items-start gap-5 md:order-1"
          >
            <motion.span
              variants={item}
              className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase"
            >
              About the studio
            </motion.span>
            <motion.h1
              variants={item}
              className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-foreground sm:text-6xl"
            >
              Built for the room, and the take that happens in it.
            </motion.h1>
            <motion.p
              variants={item}
              className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Genie Pro Studios started as a home for gospel sessions that needed to be
              captured properly — not just recorded, but held onto exactly as they
              happened. That&apos;s still the job today: rehearsal space to prepare, a full
              recording setup to capture it, and mixing and mastering to finish it, all in
              one place.
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

          <div className="order-1 md:order-2">
            <HeroGraphic />
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-b border-border bg-card py-10">
        <Reveal className="overflow-hidden">
          <motion.p
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 24, ease: "linear", repeat: Infinity }}
            className="font-mono text-xl whitespace-nowrap text-[var(--amber-glow)] sm:text-2xl"
          >
            {Array.from({ length: 4 }, () => MARQUEE_TEXT).join("")}
            {Array.from({ length: 4 }, () => MARQUEE_TEXT).join("")}
          </motion.p>
        </Reveal>
      </section>

      <section className="border-b border-border bg-background">
        <Reveal className="mx-auto flex w-full max-w-4xl flex-wrap items-end justify-center gap-10 px-6 py-20 sm:justify-between">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: stat.barHeight }}
                viewport={{ once: true, margin: "-80px 0px" }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: "easeOut" }}
                className="w-4 rounded-none bg-[var(--amber-glow)]"
                style={{ maxHeight: stat.barHeight }}
              />
              <p className="font-heading text-3xl font-medium text-foreground">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="max-w-[8rem] text-center text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20">
          <Reveal className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
              How it works
            </span>
            <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              How a session runs
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => (
              <Reveal key={step.number} delay={i * 0.08} className="flex flex-col gap-3">
                <span className="font-heading text-4xl font-medium text-[var(--amber-glow)]/40">
                  {step.number}
                </span>
                <h3 className="font-heading text-lg font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-12 gap-y-16 px-6 py-24 sm:grid-cols-2">
          <Reveal className="relative flex flex-col gap-4">
            <span
              aria-hidden="true"
              className="font-heading text-8xl font-medium text-foreground/[0.06] select-none"
            >
              01
            </span>
            <h2 className="font-heading text-2xl font-medium text-foreground">
              The space
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              A room built to record live takes, not just isolate them — from full-band
              rehearsals to spontaneous worship sessions, with the acoustics and setup
              to keep a take usable straight out of the session.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="relative flex flex-col gap-4">
            <span
              aria-hidden="true"
              className="font-heading text-8xl font-medium text-foreground/[0.06] select-none"
            >
              02
            </span>
            <h2 className="font-heading text-2xl font-medium text-foreground">
              The engineer
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every session is run hands-on, from levels to final mix — the same person
              who sets up your session is the one shaping how it sounds by the time you
              leave with it.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-6 py-24 text-center">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Take a look inside
          </span>
          <div className="bg-grain relative flex aspect-video w-full max-w-2xl items-center justify-center overflow-hidden rounded-none border border-border bg-background">
            <div className="relative z-[1] flex flex-col items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-none border border-[var(--amber-glow)]/50 bg-[var(--amber-glow)]/10">
                <Play className="size-5 text-[var(--amber-glow)]" aria-hidden="true" />
              </div>
              <p className="font-heading text-lg font-medium text-foreground">
                Studio walkthrough — coming soon
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                A full video tour, shot by the owner, is on the way.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-background">
        <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 px-6 py-20">
          <p className="text-sm text-muted-foreground">Ready to see it in person?</p>
          <Button
            asChild
            className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="/book">Book a session</Link>
          </Button>
        </Reveal>
      </section>
    </main>
  );
}
