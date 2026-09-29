// Large soft blurred color blobs — the fix for "too much solid background
// space": every Triumph section sat on a flat single-tone background before
// this, which read as scanty on wide viewports. Colors sampled from the
// real Triumph Music Global logo's own blue-to-teal gradient (not the
// site's amber accent — this is what makes the page feel like Triumph's own
// brand rather than a recolored Genie Pro page). Position varies per call
// site so repeated use across sections doesn't look identical.
export function BrandGlow({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "reverse" | "center";
}) {
  if (variant === "center") {
    return (
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        <div className="absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1d3fd6]/10 blur-[120px]" />
      </div>
    );
  }

  const [first, second] =
    variant === "reverse"
      ? ["bg-[#22e6c8]/20 -right-32 -top-32", "bg-[#1d3fd6]/20 -left-32 -bottom-32"]
      : ["bg-[#1d3fd6]/20 -left-32 -top-32", "bg-[#22e6c8]/20 -right-32 -bottom-32"];

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className={`absolute size-[28rem] rounded-full blur-[110px] ${first}`} />
      <div className={`absolute size-[28rem] rounded-full blur-[110px] ${second}`} />
    </div>
  );
}
