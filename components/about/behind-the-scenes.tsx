"use client";

import { useEffect, useRef } from "react";
import { Play } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { AmbientVideo } from "@/components/media/ambient-video";

// Real footage from actual studio shoots — a silent "video wall" (grid
// tiles autoplay muted/looped, same texture-not-content role as a photo,
// per the "background... no controls" brief), including the featured
// reel-trumpet.mp4 tile, which uses the same AmbientVideo treatment as the
// rest of the site (autoplay muted+loop, no native controls, low-volume
// unmute toggle) rather than a tap-to-play-with-controls player — no
// browser allows autoplaying audio, muted-by-default-with-opt-in-unmute is
// the only honest way to offer sound here. Its audio track is the shoot's
// own ambient track from bts-dance.mp4's source (IMG_0578), not the
// trumpet performance's original audio. The "walkthrough coming soon" tile
// stays — the owner's dedicated video is still pending (see
// app/(marketing)/about/page.tsx's prior placeholder) and now lives inside
// the grid instead of standing alone.
const GRID_CLIPS = [
  {
    src: "/videos/bts-drummer.mp4",
    poster: "/videos/posters/bts-drummer.jpg",
    alt: "Artist in traditional dress performing with a talking drum on set",
  },
  {
    src: "/videos/bts-monitor.mp4",
    poster: "/videos/posters/bts-monitor.jpg",
    alt: "Crew reviewing a shot on the camera monitor mid-shoot",
  },
  {
    src: "/videos/bts-dance.mp4",
    poster: "/videos/posters/bts-dance.jpg",
    alt: "Gimbal shot following a dance take, lit in red",
  },
  {
    src: "/videos/bts-backstage.mp4",
    poster: "/videos/posters/bts-backstage.jpg",
    alt: "Crew setting up backstage before a shoot",
  },
  {
    src: "/videos/bts-decor.mp4",
    poster: "/videos/posters/bts-decor.jpg",
    alt: "Studio set dressing and lighting rig",
  },
];

function GridTile({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden border border-border bg-background">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    </div>
  );
}

function ComingSoonTile() {
  return (
    <div className="bg-grain relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden border border-border bg-card p-4 text-center">
      <div className="relative z-[1] flex size-10 items-center justify-center rounded-none border border-[var(--amber-glow)]/50 bg-[var(--amber-glow)]/10">
        <Play className="size-4 text-[var(--amber-glow)]" aria-hidden="true" />
      </div>
      <p className="relative z-[1] text-xs leading-snug text-muted-foreground">
        Full studio walkthrough — coming soon
      </p>
    </div>
  );
}

function FeaturedReel() {
  return (
    <div className="relative col-span-2 row-span-2 aspect-square w-full overflow-hidden border border-[var(--amber-glow)]/40 bg-background sm:aspect-auto">
      <AmbientVideo
        src="/videos/reel-trumpet.mp4"
        poster="/videos/posters/reel-trumpet.jpg"
        overlayClassName="bg-gradient-to-t from-black/30 via-transparent to-transparent"
      />
    </div>
  );
}

export function BehindTheScenes() {
  return (
    <section className="border-b border-border bg-card">
      <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-24 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Take a look inside
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Behind the scenes
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Real clips from real sessions — sets, shoots, and the room while it&apos;s working.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:[grid-auto-rows:1fr]">
          <FeaturedReel />
          {GRID_CLIPS.map((clip) => (
            <GridTile key={clip.src} {...clip} />
          ))}
          <ComingSoonTile />
        </div>
      </Reveal>
    </section>
  );
}
