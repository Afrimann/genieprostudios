import { Reveal } from "@/components/ui/reveal";

// Purely informational announcement — no name/branding exists yet for this
// venture, so this deliberately stays generic ("a record label") rather than
// inventing a name, logo, or launch date. Swap in real copy once the label
// has an identity. No link/CTA since there's nowhere to send visitors yet.
export function RecordLabelTeaser() {
  return (
    <section className="border-t border-border bg-card">
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-6 py-20 text-left">
        <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
          Coming soon
        </span>
        <h2 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
          We&apos;re building a record label.
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Genie Pro Studios is bringing a record label to life — more details soon.
        </p>
      </Reveal>
    </section>
  );
}
