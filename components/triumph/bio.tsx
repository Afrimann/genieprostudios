"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

// Same ring-motif mechanism as components/triumph/hero.tsx's
// DecorativeRings (itself borrowed from components/home/hero.tsx) — reused
// a third time here around the photo placeholder rather than the logo,
// tying the page's "crazy" moments together without repeating the exact
// same combination twice. Plain CSS animation (globals.css's
// spin-cw/spin-ccw), not framer-motion — see hero.tsx's DecorativeRings for
// why (a JS/rAF loop that never pauses is what caused real mobile scroll
// jank, 2026-09-30).
function PhotoRings() {
  const rings = [
    { inset: -12, opacity: 0.45, dash: "2 12", duration: 80, spin: "animate-spin-cw" },
    { inset: -22, opacity: 0.22, dash: "1 8", duration: 60, spin: "animate-spin-ccw" },
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

// TODO(client): placeholder name/bio/photo — replace with the real
// engineer's name, bio, and headshot before launch. Deliberately original
// wording, not a copy of the reference site's own bio copy. Two-column at
// full section width (photo/rings left, text right) rather than a narrow
// centered stack — the reference's own "image above text" layout works for
// its narrow content column, but left a lot of flat background on this
// site's wider max-w-6xl sections, which is exactly the "too much solid
// background" gap this fixes.
export function TriumphBio() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="reverse" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-24 md:flex-row md:items-center md:gap-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px 0px" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative flex size-40 shrink-0 items-center justify-center sm:size-48"
        >
          <PhotoRings />
          <div className="bg-grain relative z-[1] flex size-40 flex-col items-center justify-center gap-1.5 overflow-hidden border border-border bg-background sm:size-48">
            <User className="size-8 text-[#22e6c8]" aria-hidden="true" />
            <p className="text-[11px] leading-snug text-muted-foreground">Photo coming soon</p>
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
