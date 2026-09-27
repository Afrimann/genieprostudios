"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

interface CountUpProps {
  to: number;
  suffix?: string;
  prefix?: string;
  durationSeconds?: number;
}

// Small reusable count-up — animates a number from 0 to `to` once its
// container scrolls into view, using framer-motion's imperative `animate()`
// rather than a full spring-per-frame React re-render (animate() drives the
// DOM text node directly on each tick, cheaper than setState-per-frame for
// something this simple).
export function CountUp({ to, suffix = "", prefix = "", durationSeconds = 1.6 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // "-80px 0px" (vertical-only): a bare "-80px" shrinks the detection zone
  // on all four sides, including left/right — harmless when elements sit
  // near the horizontal center, but on a narrow mobile viewport with items
  // spread edge-to-edge (see about-teaser.tsx's justify-between row), the
  // side margins exclude elements near the screen edges from ever
  // registering as "in view", so their count never starts. Only the
  // vertical restriction (wait until scrolled further into view) was ever
  // intentional.
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const controls = animate(0, to, {
      duration: durationSeconds,
      ease: "easeOut",
      onUpdate: (value) => setDisplay(Math.round(value)),
    });

    return () => controls.stop();
  }, [inView, to, durationSeconds]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
