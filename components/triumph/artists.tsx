import { Reveal } from "@/components/ui/reveal";

// Names supplied directly by the client (2026-10-02) — not sourced/assumed.
// Plain text list rather than a logo wall (no logos exist for most of
// these) or another scrolling marquee (the page already has one, for
// services) — just names, beautifully set, which is its own kind of proof.
const ARTISTS = [
  "Tamar Collins",
  "Mary Tanimola",
  "Faith Owolabi",
  "Samuel Williams",
  "Folusho Ajala",
  "John Akpors",
  "Ayonitemi Music",
];

// A compact "trusted by" strip directly under the hero — social proof reads
// strongest as the very next thing a visitor sees, before anything else is
// explained. Flipped to a light band (foreground/background swapped) rather
// than another dark section — the page doesn't need to be dark everywhere,
// and the contrast gives this strip its own moment instead of blending into
// the dark hero above and dark marquee below. One unbroken row, uppercase,
// scrolling horizontally on narrow viewports instead of wrapping onto a
// second line.
export function TriumphArtists() {
  return (
    <section className="border-b border-border bg-foreground">
      <Reveal className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-6 sm:gap-8">
        <span className="shrink-0 text-xs font-medium tracking-[0.2em] text-background/60 uppercase">
          Trusted by
        </span>
        <ul className="scrollbar-hide flex flex-nowrap items-center gap-x-8 overflow-x-auto">
          {ARTISTS.map((name) => (
            <li
              key={name}
              className="shrink-0 font-heading text-sm tracking-wide text-background uppercase sm:text-base"
            >
              {name}
            </li>
          ))}
          <li className="shrink-0 font-heading text-sm tracking-wide text-background/50 uppercase sm:text-base">
            + more
          </li>
        </ul>
      </Reveal>
    </section>
  );
}
