"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Decorative, section-filling background video — autoplays muted and loops
// with no controls, per the "on repeat, no controls" brief. Browsers refuse
// to autoplay audio under any circumstance, so "plays with sound but really
// low" can only ever be an opt-in: the toggle unmutes at a fixed low volume
// rather than pretending a page can start making sound on its own.
//
// `audioSrc` is optional and separate from the video file itself: when set,
// the toggle controls a standalone looping <audio> track instead of the
// video's own embedded audio (which stays permanently muted) — used where a
// clip's native audio isn't what should play (e.g. replacing it with a
// licensed instrumental bed) without needing to re-encode the mp4.
type AmbientVideoProps = {
  src: string;
  poster: string;
  audioSrc?: string;
  className?: string;
  overlayClassName?: string;
};

const LOW_VOLUME = 0.18;

export function AmbientVideo({
  src,
  poster,
  audioSrc,
  className = "",
  overlayClassName = "bg-background/70",
}: AmbientVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [unmuted, setUnmuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!audioSrc) video.volume = LOW_VOLUME;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      audioRef.current?.pause();
    }
  }, [audioSrc]);

  function toggleSound() {
    const next = !unmuted;
    setUnmuted(next);

    if (audioSrc) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.muted = !next;
      if (next) {
        audio.volume = LOW_VOLUME;
        audio.play().catch(() => {});
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.muted = !next;
    if (next) video.volume = LOW_VOLUME;
  }

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      {audioSrc && <audio ref={audioRef} src={audioSrc} loop muted preload="none" />}
      <div className={`absolute inset-0 ${overlayClassName}`} />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={unmuted ? "Mute background music" : "Unmute background music (low volume)"}
        aria-pressed={unmuted}
        className="pointer-events-auto absolute right-4 bottom-4 z-[2] flex size-8 items-center justify-center rounded-none border border-[var(--amber-glow)]/40 bg-background/60 text-[var(--amber-glow)] backdrop-blur-sm transition hover:bg-background/80"
      >
        {unmuted ? (
          <Volume2 className="size-3.5" aria-hidden="true" />
        ) : (
          <VolumeX className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
