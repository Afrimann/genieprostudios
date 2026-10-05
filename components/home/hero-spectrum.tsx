"use client";

import { useEffect, useRef } from "react";

// Hero spectrum panel — a grid of bars driven by a travelling wave, reading
// as a spectrum analyser / wall of console faders. It's the LiveMeter motif
// from hero.tsx extended into a dimensional object.
//
// WHY 2D CANVAS AND NOT THREE.JS / R3F
// This started as a react-three-fiber prototype (2026-10-04). It worked, but
// it shipped a 236KB gzipped chunk — 2.4x the next largest chunk in the
// project — to render a sine wave over a grid with one axis of rotation.
// None of what makes a 3D engine worth its weight (loaded models, lighting,
// materials, camera control, physics) was being used. Hand-rolled isometric
// projection gets a near-identical result in a couple of KB with no
// dependency at all. If a real 3D need ever lands here (an explorable model
// of the live room, say), that's the moment to reconsider R3F — not this.
//
// Flat fills only, no shading ramps: the look comes from silhouette and
// overlap, like a technical drawing. Peaks snap to full amber while the body
// stays dim — discrete states, the way a real VU meter reads, never a
// blended gradient between them.

const GRID = 14;
const SPACING = 22;
const AMBER = "#f2c230";
const AMBER_DIM = "#5c4a18";
const PEAK_THRESHOLD = 0.62;
const BAR_WIDTH = 7;
const MAX_BAR_HEIGHT = 52;
// Isometric projection constants — a 2:1 ratio is the classic isometric
// look and keeps the grid readable rather than squashed.
const ISO_X = 0.86;
const ISO_Y = 0.42;
const ROTATION_SPEED = 0.12; // radians/sec, matching the R3F prototype

type Cell = { x: number; z: number; dist: number };

export function HeroSpectrum() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Grid geometry is fixed — compute once, not per frame.
    const cells: Cell[] = [];
    const half = (GRID - 1) / 2;
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const x = (i - half) * SPACING;
        const z = (j - half) * SPACING;
        cells.push({ x, z, dist: Math.sqrt(x * x + z * z) / SPACING });
      }
    }

    let width = 0;
    let height = 0;
    // Tracks the last rendered timestamp so a resize can repaint the exact
    // frame that was on screen. Setting canvas.width (below) CLEARS the
    // canvas — without repainting after a resize, the reduced-motion path,
    // which draws a single frame and then stops, would be wiped blank by
    // any layout change and never recover.
    let lastElapsed = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      // Cap DPR at 2: retina phones report 3+, which triples fill work for
      // no visible gain on an abstract shape.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(lastElapsed);
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let startTime = performance.now();
    // Frozen time for the reduced-motion case: renders one static,
    // already-interesting frame rather than a flat grid.
    const STATIC_T = 2.4;

    function draw(elapsed: number) {
      if (!ctx) return;

      lastElapsed = elapsed;
      ctx.clearRect(0, 0, width, height);

      const t = elapsed;
      const rot = t * ROTATION_SPEED;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const cx = width / 2;
      // Nudged below centre so the bars, which grow upward, sit visually
      // centred in the panel rather than riding its top edge.
      const cy = height / 2 + MAX_BAR_HEIGHT / 2;

      // Project every cell, then sort back-to-front (painter's algorithm)
      // so nearer bars overlap farther ones correctly.
      const projected = cells.map((cell) => {
        const rx = cell.x * cos - cell.z * sin;
        const rz = cell.x * sin + cell.z * cos;

        const wave =
          Math.sin(cell.dist * 1.6 - t * 1.8) * 0.5 + Math.sin(cell.x * 0.04 + t * 1.1) * 0.5;
        const normalized = (wave + 1) / 2;

        return {
          sx: cx + (rx - rz) * ISO_X,
          sy: cy + (rx + rz) * ISO_Y,
          depth: rx + rz,
          barHeight: 4 + normalized * MAX_BAR_HEIGHT,
          peak: normalized > PEAK_THRESHOLD,
        };
      });

      projected.sort((a, b) => a.depth - b.depth);

      for (const p of projected) {
        ctx.fillStyle = p.peak ? AMBER : AMBER_DIM;
        ctx.fillRect(p.sx - BAR_WIDTH / 2, p.sy - p.barHeight, BAR_WIDTH, p.barHeight);
      }
    }

    function loop(now: number) {
      draw((now - startTime) / 1000);
      frameId = requestAnimationFrame(loop);
    }

    function start() {
      if (frameId) return;
      if (reduceMotion.matches) {
        draw(STATIC_T);
        return;
      }
      startTime = performance.now();
      // Paint one frame synchronously before handing off to rAF. Browsers
      // suspend requestAnimationFrame entirely in a hidden tab, so a page
      // opened in the background (middle-click, restored session) would
      // otherwise sit on an empty canvas until first focus.
      draw(0);
      frameId = requestAnimationFrame(loop);
    }

    function stop() {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }

    // Pause while the tab is hidden — same discipline as triumph/hero.tsx
    // and project-status-timeline.tsx.
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    function onMotionPreferenceChange() {
      stop();
      start();
    }

    // resize() before start(): it establishes width/height and the DPR
    // transform, which draw() depends on. ResizeObserver fires once on
    // observe(), so the panel also repaints correctly if the grid column
    // settles to a different size after first layout.
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    start();
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", onMotionPreferenceChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onMotionPreferenceChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
