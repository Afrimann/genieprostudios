import type { Metadata } from "next";

const SECTIONS = [
  {
    title: "1. What we collect",
    body: "Account details (name, email, phone), your booking history, and payment metadata. Paystack handles your card details directly — we never see or store card numbers.",
  },
  {
    title: "2. How we use it",
    body: "To create and manage your bookings, verify payments, send booking-related emails (confirmations, balance reminders, cancellation notices), and respond to enquiries.",
  },
  {
    title: "3. Who we share it with",
    body: "Paystack (payment processing) and Resend (transactional email delivery) — the two services this booking system relies on. We do not sell customer data to anyone.",
  },
  {
    title: "4. How long we keep it",
    body: "Booking and payment records are kept for as long as your account is active, plus a reasonable period afterward for financial record-keeping. Contact us if you'd like your account data deleted.",
  },
  {
    title: "5. Your rights",
    body: "You can request access to, correction of, or deletion of the personal data we hold about you at any time — reach out via the Contact page.",
  },
  {
    title: "6. Contact",
    body: "Questions about this policy or your data go to the studio directly — see the Contact page for current details.",
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Genie Pro Studios collects, uses, and protects your personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Legal
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            How Genie Pro Studios handles the personal data collected through this site.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <h2 className="font-heading text-lg font-medium text-foreground">
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
