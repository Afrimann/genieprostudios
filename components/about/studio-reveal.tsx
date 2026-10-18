"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// Real photos from the actual studio/live-session shoot (2026-10-18 drop),
// replacing the old "walkthrough coming soon" placeholder tile. Alternating
// pan directions per slide (not a fixed single drift) so the Ken Burns move
// doesn't read as the same loop repeated eight times.
const SLIDES = [
  {
    src: "/images/studio/IMG_9548..jpg",
    alt: "The engineer at the production desk, dual monitors lit with a waveform",
    caption: "The desk",
    pan: "right" as const,
  },
  {
    src: "/images/studio/IMG_9554..jpg",
    alt: "The engineer from behind, headphones on, deep in a mix",
    caption: "Deep in the mix",
    pan: "left" as const,
  },
  {
    src: "/images/studio/IMG_9467..jpg",
    alt: "The stage lit in amber and green, waiting for a performer",
    caption: "The stage, lit and waiting",
    pan: "up" as const,
  },
  {
    src: "/images/studio/IMG_9473..jpg",
    alt: "Stage lighting rig and keyboard from a side angle",
    caption: "Every angle wired for sound",
    pan: "right" as const,
  },
  {
    src: "/images/studio/IMG_9487..jpg",
    alt: "A drum kit lit in green, ready to play",
    caption: "The kit, ready",
    pan: "left" as const,
  },
  {
    src: "/images/studio/IMG_9506..jpg",
    alt: "A vocalist performing on stage under warm stage lights",
    caption: "A take, captured",
    pan: "down" as const,
  },
  {
    src: "/images/studio/IMG_9488..jpg",
    alt: "A vocalist performing, seen past two silhouetted crew members",
    caption: "The room holds it",
    pan: "right" as const,
  },
  {
    src: "/images/studio/IMG_9505..jpg",
    alt: "Close view of a performance from just behind the crew",
    caption: "Close enough to feel it",
    pan: "left" as const,
  },
];

// Closing card — the engineer's own portrait (same file used on the about
// page's "The engineer" section) rather than another studio shot, so the
// reveal ends on a face instead of just stopping. Treated as index
// SLIDES.length, one past the real photos, with its own layout (centered
// signoff + CTAs) instead of the bottom-left caption the photo slides use.
const THANK_YOU_SLIDE = {
  src: "/images/IMG_7043.JPG",
  alt: "The engineer behind Genie Pro Studios",
  caption: "Thank you for watching",
  pan: "up" as const,
};

const ALL_SLIDES = [...SLIDES, THANK_YOU_SLIDE];

const SLIDE_DURATION = 5000;

const PAN_OFFSETS: Record<(typeof SLIDES)[number]["pan"], { from: [number, number]; to: [number, number] }> = {
  right: { from: [-2, 0], to: [2, 0] },
  left: { from: [2, 0], to: [-2, 0] },
  up: { from: [0, 2], to: [0, -2] },
  down: { from: [0, -2], to: [0, 2] },
};

export function StudioRevealTile() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group bg-grain relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden border border-border bg-card p-4 text-center transition-colors hover:border-[var(--amber-glow)]/50"
      >
        <Image
          src={SLIDES[0].src}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover opacity-30 transition-opacity duration-500 group-hover:opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-background/60" />
        <div className="relative z-[1] flex size-10 items-center justify-center rounded-none border border-[var(--amber-glow)]/50 bg-[var(--amber-glow)]/10 transition-transform duration-300 group-hover:scale-110">
          <Play className="size-4 text-[var(--amber-glow)]" aria-hidden="true" />
        </div>
        <p className="relative z-[1] text-xs leading-snug text-foreground">
          Watch the studio reveal
        </p>
      </button>

      <AnimatePresence>{open && <StudioRevealModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

const TOTAL_SLIDES = SLIDES.length + 1;

function StudioRevealModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((next: number) => {
    setIndex(((next % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES);
  }, []);

  const isThankYou = index === SLIDES.length;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    // Runs on its own the whole way through, including the thank-you card,
    // then loops back to slide one — no click needed to keep it going. The
    // nav arrows/dots/close button stay available as an override, they just
    // aren't required for the reveal to play.
    if (paused) return;
    timerRef.current = setTimeout(() => goTo(index + 1), SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, paused, goTo]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, goTo, onClose]);

  const slide = isThankYou ? THANK_YOU_SLIDE : SLIDES[index];
  const pan = PAN_OFFSETS[slide.pan];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Studio reveal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-full w-full overflow-hidden">
        <AnimatePresence mode="sync">
          <motion.div
            key={slide.src}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {isThankYou ? (
              // The portrait is tall (4:5) against a wide cinematic frame —
              // object-cover on a source that shape-mismatched this badly
              // cropped it down to just the head. Instead: a blurred,
              // full-bleed copy fills the frame as a backdrop, and the real
              // portrait sits on top at object-contain so the whole photo
              // stays visible.
              <div className="relative h-full w-full">
                <Image
                  src={slide.src}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="100vw"
                  className="scale-110 object-cover opacity-40 blur-2xl"
                />
                <div className="absolute inset-0 bg-black/40" />
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.05 }}
                  transition={{ duration: SLIDE_DURATION / 1000 + 1.1, ease: "linear" }}
                  className="relative mx-auto h-full w-full max-w-sm sm:max-w-md"
                >
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    sizes="(max-width: 768px) 90vw, 420px"
                    className="object-contain object-bottom"
                  />
                </motion.div>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 1.12, x: `${pan.from[0]}%`, y: `${pan.from[1]}%` }}
                animate={{ scale: 1.22, x: `${pan.to[0]}%`, y: `${pan.to[1]}%` }}
                transition={{ duration: SLIDE_DURATION / 1000 + 1.1, ease: "linear" }}
                className="relative h-full w-full"
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="100vw"
                  priority={index === 0}
                  className="object-cover"
                />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Cinematic letterbox bars */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[6vh] bg-black sm:h-[8vh]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[6vh] bg-black sm:h-[8vh]" />
        <div
          className={`pointer-events-none absolute inset-0 ${
            isThankYou
              ? "bg-gradient-to-t from-black/85 via-black/40 to-black/60"
              : "bg-gradient-to-t from-black/70 via-transparent to-black/30"
          }`}
        />
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close studio reveal"
          className="absolute top-[7vh] right-5 z-[2] flex size-10 items-center justify-center rounded-none border border-[#f3eee0]/25 bg-black/40 text-[#f3eee0] transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] sm:top-[9vh]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Previous photo"
          className="absolute top-1/2 left-3 z-[2] flex size-10 -translate-y-1/2 items-center justify-center rounded-none border border-[#f3eee0]/20 bg-black/30 text-[#f3eee0]/80 transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] sm:left-6"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Next photo"
          className="absolute top-1/2 right-3 z-[2] flex size-10 -translate-y-1/2 items-center justify-center rounded-none border border-[#f3eee0]/20 bg-black/30 text-[#f3eee0]/80 transition-colors hover:border-[var(--amber-glow)] hover:text-[var(--amber-glow)] sm:right-6"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>

        {isThankYou && (
          // Anchored toward the top of the frame, not dead-center — the
          // portrait below sits object-bottom within its own box, so the
          // upper ~45% stays clear for this text instead of landing on top
          // of his face.
          <div className="absolute inset-x-0 top-[6vh] z-[2] flex flex-col items-center gap-5 px-6 pt-10 text-center sm:top-[8vh] sm:pt-14">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center gap-4"
            >
              <span className="h-px w-10 bg-[var(--amber-glow)]" aria-hidden="true" />
              <p className="font-heading text-3xl font-medium text-[#f3eee0] sm:text-5xl">
                Thank you for watching
              </p>
              <p className="max-w-sm text-sm text-[#f3eee0]/70 sm:text-base">
                That&apos;s the room, the gear, and the person running it — see it in
                person at your next session.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
                >
                  <Link href="/book">Book a session</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => goTo(0)}
                  className="h-11 rounded-none border-[#f3eee0]/30 bg-transparent px-6 text-sm font-medium text-[#f3eee0] hover:bg-[#f3eee0]/10"
                >
                  Watch again
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-[6vh] z-[2] flex flex-col gap-4 px-6 pb-6 sm:bottom-[8vh] sm:px-12 sm:pb-10">
          {!isThankYou && (
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.caption}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col gap-1"
              >
                <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
                  Studio reveal — {String(index + 1).padStart(2, "0")} / {String(ALL_SLIDES.length).padStart(2, "0")}
                </span>
                <p className="font-heading text-2xl font-medium text-[#f3eee0] sm:text-3xl">
                  {slide.caption}
                </p>
              </motion.div>
            </AnimatePresence>
          )}

          <div className="flex gap-1.5">
            {ALL_SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className="relative h-[3px] flex-1 overflow-hidden bg-[#f3eee0]/20"
              >
                {i === index && (
                  <motion.span
                    key={`${slide.src}-progress`}
                    initial={{ width: "0%" }}
                    animate={{ width: paused ? undefined : "100%" }}
                    transition={{ duration: SLIDE_DURATION / 1000, ease: "linear" }}
                    className="absolute inset-y-0 left-0 bg-[var(--amber-glow)]"
                  />
                )}
                {i < index && <span className="absolute inset-0 bg-[var(--amber-glow)]/60" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
