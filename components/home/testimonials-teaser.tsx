"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";

// Real names supplied by the client (2026-09-27); quotes drafted on their
// behalf and meant to be reviewed/swapped for the client's actual words
// whenever they send them — not sourced from an interview.
const TESTIMONIALS = [
  {
    quote: "Every take we brought in came back sounding like the room, not like a fix. That's rare.",
    name: "Folusho Ajala — Artist / Producer",
  },
  {
    quote: "I walked in still finding the song and walked out with a session ready to release. They just get it.",
    name: "Tamar Collins — Artist",
  },
  {
    quote: "First place I've shot where the audio team and I aren't fighting for the same space — everything's built for both.",
    name: "Sam Wills — Videographer",
  },
  {
    quote: "Genie Pro doesn't just record you, they listen first. You can hear the difference.",
    name: "Praise Oladimeji — Artist",
  },
  {
    quote: "Getting a full choir to sound this clean, this together, usually takes twice the time. Not here.",
    name: "TCN Choir",
  },
];

// A single large auto-advancing quote rather than a card carousel/grid — the
// index reads like a tape/track counter ("02 / 03") instead of dots, one
// more small nod to the studio-equipment language without repeating the
// meter-bar or LED-marquee tricks used elsewhere on the page.
export function TestimonialsTeaser() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const current = TESTIMONIALS[index];

  return (
    <section className="border-t border-border bg-background">
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-24 text-center">
        <span className="font-mono text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(TESTIMONIALS.length).padStart(2, "0")}
        </span>

        <div className="min-h-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
                “{current.quote}”
              </p>
              <p className="text-sm text-muted-foreground">{current.name}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2" role="tablist" aria-label="Testimonials">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show testimonial ${i + 1}`}
              onClick={() => setIndex(i)}
              className="h-1.5 w-6 rounded-none bg-border transition-colors data-[active=true]:bg-[var(--amber-glow)]"
              data-active={i === index}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
