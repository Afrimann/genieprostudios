// Large soft blurred color blobs — the fix for "too much solid background
// space": every Triumph section sat on a flat single-tone background before
// this, which read as scanty on wide viewports. Colors sampled from the
// real Triumph Music Global logo's own blue-to-teal gradient (not the
// site's amber accent — this is what makes the page feel like Triumph's own
// brand rather than a recolored Genie Pro page). Position varies per call
// site so repeated use across sections doesn't look identical.
//
// `hidden sm:block`: blur filters this large are cheap for a desktop GPU
// but were the main cause of real scroll jank on mobile once six of these
// were mounted down the page at once (2026-09-30, reported: "dragging on
// mobile, fine on desktop") — narrow viewports are already visually denser
// (single column, less empty margin) so the fill-effect these exist for
// matters far less there anyway, making "just don't render on mobile" a
// fix with no real visual cost. `[transform:translateZ(0)]` promotes what's
// left to its own compositor layer so desktop scrolling doesn't repaint the
// blur on every frame either.
export function BrandGlow({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "reverse" | "center";
}) {
  if (variant === "center") {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 hidden overflow-hidden sm:block ${className}`}
      >
        <div className="absolute top-1/2 left-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 [transform:translateZ(0)] rounded-full bg-[#1d3fd6]/10 blur-[90px]" />
      </div>
    );
  }

  const [first, second] =
    variant === "reverse"
      ? ["bg-[#22e6c8]/20 -right-32 -top-32", "bg-[#1d3fd6]/20 -left-32 -bottom-32"]
      : ["bg-[#1d3fd6]/20 -left-32 -top-32", "bg-[#22e6c8]/20 -right-32 -bottom-32"];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 hidden overflow-hidden sm:block ${className}`}
    >
      <div className={`absolute size-[22rem] [transform:translateZ(0)] rounded-full blur-[80px] ${first}`} />
      <div className={`absolute size-[22rem] [transform:translateZ(0)] rounded-full blur-[80px] ${second}`} />
    </div>
  );
}
