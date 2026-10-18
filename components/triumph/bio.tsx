"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

// Same ring-motif mechanism as components/triumph/hero.tsx's
// DecorativeRings (itself borrowed from components/home/hero.tsx) — reused
// a third time here around the portrait rather than the logo, tying the
// page's "crazy" moments together without repeating the exact same
// combination twice. Plain CSS animation (globals.css's spin-cw/spin-ccw),
// not framer-motion — see hero.tsx's DecorativeRings for why (a JS/rAF loop
// that never pauses is what caused real mobile scroll jank, 2026-09-30).
// Insets scaled up from the old size-40/48 placeholder box to fit the much
// larger portrait frame below.
function PhotoRings() {
  const rings = [
    { inset: -16, opacity: 0.45, dash: "3 16", duration: 80, spin: "animate-spin-cw" },
    { inset: -30, opacity: 0.22, dash: "1 10", duration: 60, spin: "animate-spin-ccw" },
  ];

  return (
    <>
      {rings.map((ring, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-full border border-dashed border-[#22e6c8] ${ring.spin}`}
          style={{ inset: ring.inset, opacity: ring.opacity, animationDuration: `${ring.duration}s` }}
        />
      ))}
    </>
  );
}

// TODO(client): placeholder name/bio text — replace with the real
// engineer's name and a short background/approach paragraph once the client
// confirms copy (the portrait itself is final, dropped in 2026-10-18).
// Deliberately a different treatment from the GenieProStudios about page's
// "The engineer" section (app/(marketing)/about/page.tsx) — that one is a
// full-bleed color block keyed off the photo's wall tone; this one stays on
// the page's own dark bg-card and instead lets the brand's teal identity
// carry the portrait: a tall editorial frame with a soft teal glow behind
// it, a duotone-ish gradient wash over the photo itself, and the existing
// ring motif enlarged around it — brand-led rather than photo-led.
export function TriumphBio() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="reverse" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-24 md:flex-row md:items-center md:gap-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px 0px" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative w-full max-w-[16rem] shrink-0 sm:max-w-xs md:max-w-sm"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-8 -z-[1] rounded-full bg-[#22e6c8]/15 blur-3xl"
          />
          <PhotoRings />
          <div className="bg-grain relative z-[1] aspect-[4/5] w-full overflow-hidden border border-[#22e6c8]/30 bg-background">
            <Image
              src="/images/IMG_7043.JPG"
              alt="The engineer behind Triumph Music Global"
              fill
              sizes="(max-width: 768px) 70vw, 384px"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061412]/60 via-transparent to-[#22e6c8]/20 mix-blend-multiply" />
            <div className="pointer-events-none absolute inset-0 bg-[#22e6c8]/5" />
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Meet the engineer
          </span>
          <p className="font-heading text-2xl leading-snug font-medium text-foreground sm:text-3xl">
            &ldquo;Every mix gets the same standard — clean enough for a listening
            session, loud enough for a room.&rdquo;
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            [Bio pending — a short paragraph on background, experience, and approach
            goes here.]
          </p>
          <p className="font-mono text-xs text-muted-foreground uppercase">
            [Name], Founder &amp; Engineer
          </p>
        </div>
      </Reveal>
    </section>
  );
}
