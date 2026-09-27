const STUDIO_GUIDELINES = [
  "A minimum 70% deposit is required to secure a booking; the remaining balance is due before studio access, no later than 24 hours before your session start time. Paying in full at booking is also accepted.",
  "Prices are fixed and non-negotiable.",
  "Payments are accepted only to the official company account. Payments to any other recipient are at the client's own risk.",
  "Advance booking is required — availability is not guaranteed without it.",
  "Missed sessions without prior notice are non-refundable.",
  'Session will be cancelled without refund at 35 minute "no call - no show." (Please reach out so that your session can be rescheduled if you’re running late or unable to make the agreed upon date).',
  "Rescheduling a session in advance attracts a charge of 25% of the initial stated price.",
  "Clients must arrive 30 minutes early for sound checks. After 30 minutes, the booked session time begins counting down regardless.",
  "Additional setup time beyond the grace period is charged at ₦25,000 per hour.",
  "Booked time is strictly adhered to. Additional time must be requested in advance.",
  "Only bottled water is allowed. No food, snacks or bags are permitted in the studio space.",
];

const PROJECT_MANAGEMENT_TERMS = [
  "Recorded video/audio files not collected or actively worked on are stored for 14 days only.",
  "File damage or loss on the studio's end warrants a refund of the stated price only, with no further liability.",
  "Genie Pro takes 10% of distribution/publishing royalties, but only if the song or project was produced or mixed by them, unless otherwise agreed.",
  "Genie Pro reserves the right to use session content for advertising and promotion of their brand and work.",
];

export default function TermsPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Legal
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Guidelines &amp; Terms
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Genie Pro Music Studio — bookings, sessions and studio management.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16">
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-medium text-foreground">
              Studio guidelines
            </h2>
            <ol className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
              {STUDIO_GUIDELINES.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 font-medium text-foreground">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-medium text-foreground">
              Project management terms
            </h2>
            <ol className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
              {PROJECT_MANAGEMENT_TERMS.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 font-medium text-foreground">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
