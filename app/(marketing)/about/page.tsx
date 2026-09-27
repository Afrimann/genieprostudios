import Link from "next/link";

import { CountUp } from "@/components/home/count-up";
import { Button } from "@/components/ui/button";

// TODO(client): estimates pending real figures from the studio owner —
// kept in sync with components/home/about-teaser.tsx's STATS, swap both for
// exact numbers whenever they're confirmed.
const STATS = [
  { value: 100, suffix: "+", label: "sessions produced" },
  { value: 20, suffix: "+", label: "artists worked with" },
  { value: 5, suffix: "", label: "years running" },
];

export default function AboutPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-24">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            About the studio
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Built for the room, and the take that happens in it.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Genie Pro Studios started as a home for gospel sessions that needed to be
            captured properly — not just recorded, but held onto exactly as they
            happened. That&apos;s still the job today: rehearsal space to prepare, a full
            recording setup to capture it, and mixing and mastering to finish it, all in
            one place.
          </p>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-6 px-6 py-14">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <p className="font-heading text-3xl font-medium text-foreground">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-12 px-6 py-20 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-xl font-medium text-foreground">
              The space
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A room built to record live takes, not just isolate them — from full-band
              rehearsals to spontaneous worship sessions, with the acoustics and setup
              to keep a take usable straight out of the session.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-xl font-medium text-foreground">
              The engineer
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every session is run hands-on, from levels to final mix — the same person
              who sets up your session is the one shaping how it sounds by the time you
              leave with it.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 px-6 py-20">
          <p className="text-sm text-muted-foreground">Ready to see it in person?</p>
          <Button
            asChild
            className="h-11 rounded-full bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            <Link href="/book">Book a session</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
