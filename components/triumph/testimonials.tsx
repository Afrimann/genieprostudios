"use client";

import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";

// Names already confirmed by the client for the "Trusted by" strip
// (components/triumph/artists.tsx) — quotes drafted on their behalf, same
// discipline as home/testimonials-teaser.tsx: meant to be swapped for real
// words whenever the client sends them, not sourced from an interview.
// Pre-broken into short lines (not a single wrapped paragraph) purely for
// where the line breaks fall visually — the reveal itself animates letter
// by letter across the whole quote, see AnimatedQuote below.
type Testimonial = { name: string; role: string; lines: string[] };

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Tamar Collins",
    role: "Artist",
    lines: ["Triumph gave my vocals the clarity", "I'd been chasing for years.", "The mix finally sounds like the song in my head."],
  },
  {
    name: "Mary Tanimola",
    role: "Artist",
    lines: ["I sent in a rough session", "and got back something radio-ready."],
  },
  {
    name: "Folusho Ajala",
    role: "Artist",
    lines: ["They understood the sound I was going for", "before I could even explain it."],
  },
  {
    name: "Samuel Williams",
    role: "Artist",
    lines: ["Fast turnaround, and the master", "still holds up loud."],
  },
  {
    name: "Faith Owolabi",
    role: "Artist",
    lines: ["Every note sits exactly where it should.", "Nothing fighting for space anymore."],
  },
];

// One stagger context spanning every character across every line — not a
// per-line reset — so the quote reads as a single continuous typewriter
// pass rather than three separate blocks each starting over. staggerChildren
// cascades through the plain <p> wrappers to each motion.span leaf since
// only the outer container and the spans carry variants/initial/whileInView.
const quoteContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.018 } },
};

const letter = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

function AnimatedQuote({ lines }: { lines: string[] }) {
  return (
    <motion.div
      variants={quoteContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px 0px" }}
      className="flex min-w-0 flex-col gap-1"
    >
      {lines.map((text, lineIndex) => (
        <p
          key={lineIndex}
          className="font-heading text-xl leading-snug font-medium text-white sm:text-2xl"
        >
          {Array.from(text).map((char, charIndex) => (
            <motion.span key={charIndex} variants={letter}>
              {char}
            </motion.span>
          ))}
        </p>
      ))}
    </motion.div>
  );
}

function TestimonialRow({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 border-b border-white/10 py-10 first:pt-0 last:border-none last:pb-0 sm:grid-cols-[2.2fr_1fr] sm:items-start sm:gap-10">
      <AnimatedQuote lines={testimonial.lines} />

      <div className="flex flex-col gap-1 sm:items-end sm:text-right">
        <span className="font-mono text-xs text-[#22e6c8]">{String(index + 1).padStart(2, "0")}</span>
        <p className="font-heading text-base font-medium text-white">{testimonial.name}</p>
        <p className="text-xs tracking-wide text-white/50 uppercase">{testimonial.role}</p>
      </div>
    </div>
  );
}

// Liner-notes layout — quote and attribution split into two columns that
// never merge back into a card, with each quote typing in letter by letter
// rather than fading in as one block. Reads like album credits
// (fitting for a mixing/mastering brand) rather than the single
// auto-advancing quote used on the main site's testimonials-teaser.tsx —
// deliberately a different mechanism, not a recolor of that one. Solid deep
// navy rather than the page's usual dark background or another BrandGlow
// treatment — its own moment, no gradient, no glow blobs layered on top.
export function TriumphTestimonials() {
  return (
    <section className="border-b border-border bg-[#0a1230]">
      <Reveal className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-24">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            In their words
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-white sm:text-4xl">
            What artists are saying
          </h2>
        </div>

        <div className="flex flex-col">
          {TESTIMONIALS.map((testimonial, i) => (
            <TestimonialRow key={testimonial.name} testimonial={testimonial} index={i} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
