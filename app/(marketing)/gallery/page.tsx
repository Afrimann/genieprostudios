import Link from "next/link";

// TODO(client): real studio photography pending — these six spots are the
// intended set once photos are supplied, captioned plainly rather than as
// bracketed placeholder text.
const GALLERY_SPOTS = [
  "Control room",
  "Live room",
  "Vocal booth",
  "Mixing desk",
  "Outboard gear",
  "Lounge area",
];

export default function GalleryPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Gallery
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            The studio itself
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Photos of the space and gear — see recorded and produced work on the{" "}
            <Link href="/work" className="underline underline-offset-4 hover:text-foreground">
              Work
            </Link>{" "}
            page instead.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 px-6 py-14 sm:grid-cols-3">
          {GALLERY_SPOTS.map((label) => (
            <div
              key={label}
              className="flex aspect-square items-center justify-center rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
