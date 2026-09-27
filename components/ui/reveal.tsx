"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

/**
 * Shared scroll-triggered fade+slide-up entrance, so every section on the
 * page animates in consistently instead of each one hand-rolling its own
 * whileInView. A Client Component wrapping server-rendered `children` is
 * the standard RSC pattern here — the sections that fetch from Supabase
 * (FeaturedSession, ServicesTeaser, SessionsReel, ContactTeaser) stay
 * Server Components, they just pass their JSX through this wrapper.
 * Extends motion.div's own props (not just className/children) so callers
 * can still pass things like role/aria-label straight through — see
 * mission-marquee.tsx.
 *
 * Margin is vertical-only ("-80px 0px") deliberately — a bare "-80px"
 * shrinks the viewport-intersection zone on all four sides, which has
 * caused a real bug in this project before (see about-teaser.tsx/
 * count-up.tsx's fix) by excluding edge-positioned content from ever
 * registering as in-view. once:true so a section doesn't re-fade every
 * time it's scrolled past.
 */
export function Reveal({ delay = 0, transition, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut", ...transition }}
      {...props}
    />
  );
}
