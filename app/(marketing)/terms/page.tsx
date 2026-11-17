import type { Metadata } from "next";

const TERMS_SECTIONS: {
  title: string;
  items?: string[];
  body?: string;
}[] = [
  {
    title: "Bookings & confirmation",
    items: [
      "All sessions and services must be booked in advance.",
      "A booking is only confirmed after payment of the required deposit and confirmation by the Studio.",
      "A minimum 70% deposit is required to secure a booking.",
      "Availability is not guaranteed until your booking is confirmed.",
    ],
  },
  {
    title: "Payment policy",
    items: [
      "The remaining balance must be paid before the session or service begins, and no later than 24 hours before the scheduled session.",
      "Full payment at the point of booking is accepted.",
      "All payments must be made into the official Genie Pro Studios account.",
      "Payments to unauthorised personal accounts or third parties are at the Client’s risk.",
      "Published prices and approved quotations are fixed unless otherwise agreed in writing.",
    ],
  },
  {
    title: "Cancellation & rescheduling",
    items: [
      "Missed sessions without prior notice are non-refundable.",
      "A booking may be treated as a no-show if the Client fails to arrive or make contact within 35 minutes of the scheduled start time.",
      "Advance rescheduling attracts a charge equivalent to 50% of the originally booked session duration. This is a time-based charge, not 50% of the session fee.",
      "All rescheduling requests are subject to availability and management approval.",
      "If the Studio cancels a confirmed booking for reasons within its control, an alternative date or appropriate refund will be offered.",
    ],
  },
  {
    title: "Arrival & session time",
    items: [
      "Clients are expected to arrive 30 minutes before their scheduled session for preparation and sound checks.",
      "Your session begins and ends at the agreed booking time, regardless of late arrival.",
      "Late arrival does not automatically qualify a Client for an extension.",
      "Additional session time must be requested and approved in advance and may attract extra charges.",
    ],
  },
  {
    title: "Additional setup",
    items: [
      "Additional setup required beyond the applicable setup or grace period attracts a charge equivalent to 50% of the agreed session fee.",
      "The additional setup requirement and charge will be communicated to and approved by the Client before the work begins.",
    ],
  },
  {
    title: "Studio rules & conduct",
    items: [
      "Clients and their guests must maintain a respectful and professional environment.",
      "Only bottled water is permitted in designated studio spaces.",
      "Food, snacks and bags are not permitted in restricted studio spaces unless management grants permission.",
      "Clients must not operate, disconnect, move or adjust Studio equipment without authorisation.",
      "Clients are responsible for the conduct of their guests, artistes, crew and other invitees.",
      "Any damage resulting from misuse, negligence or unauthorised handling may attract repair or replacement charges.",
    ],
  },
  {
    title: "Additional services & charges",
    items: [
      "Your payment covers only the services and deliverables stated in your approved quotation or booking.",
      "Additional recording, editing, production, revisions, equipment, personnel, setup or extended session time may attract additional charges.",
      "Any additional cost will be communicated for approval before the additional work is undertaken.",
    ],
  },
  {
    title: "Project files & storage",
    items: [
      "Recorded audio, video and project materials not collected or actively being worked on are retained for a maximum of 14 days, unless otherwise agreed.",
      "Clients are responsible for collecting and backing up their files within this period.",
      "Raw recordings, multitrack sessions, DAW project files, editable video timelines and other working files are not automatically included in standard service packages.",
      "Requests for additional files or project materials must be agreed upon and may attract additional fees.",
      "The Studio does not guarantee indefinite storage or recovery of files after the retention period.",
    ],
  },
  {
    title: "Intellectual property & royalties",
    items: [
      "Recording, mixing or mastering services do not automatically transfer ownership of a Client’s music or recordings to Genie Pro Studios.",
      "Any agreed producer royalty, publishing share, master royalty, distribution commission or ownership arrangement must be documented separately in writing.",
      "Clients are responsible for ensuring that all materials they provide are authorised for use.",
      "The Studio retains ownership of its pre-existing templates, presets, workflows and proprietary production materials.",
    ],
  },
  {
    title: "Promotional use",
    items: [
      "Genie Pro Studios may showcase completed projects and selected work as part of its portfolio and marketing.",
      "The Studio will obtain the Client’s consent before using identifiable Client content, private session footage or unreleased project material.",
      "Agreed confidentiality restrictions will be respected.",
    ],
  },
  {
    title: "Video production, livestreaming & events",
    items: [
      "Clients are responsible for providing accurate event details, schedules, venue access and necessary recording or broadcast permissions.",
      "Changes to agreed production requirements may attract additional charges.",
      "The Studio is not responsible for independent failures of third-party internet providers, streaming platforms or external infrastructure beyond its reasonable control.",
    ],
  },
  {
    title: "Technical issues & refunds",
    items: [
      "The Studio will make reasonable efforts to resolve technical issues and minimise disruption.",
      "If a technical issue makes it impossible to reasonably continue a session, the Client may be offered a rescheduled session or an appropriate refund for the affected service.",
      "Where the Client chooses to proceed and substantially receives the agreed service despite a disruption, a full refund will not automatically apply.",
      "Where appropriate, partial compensation or credit may be offered in proportion to the actual impact of the disruption.",
      "All refunds and compensation are subject to the circumstances and applicable law.",
    ],
  },
  {
    title: "Client responsibilities",
    items: [
      "Clients must provide accurate project information and necessary materials.",
      "Clients are responsible for securing permissions for music, samples, footage and other materials they supply.",
      "Clients must ensure that their performers, guests and representatives comply with Studio policies.",
      "Feedback, approvals and project instructions should be provided promptly to avoid unnecessary delays.",
    ],
  },
  {
    title: "Force majeure & unforeseen events",
    items: [
      "The Studio will not be held responsible for delays or interruptions caused by circumstances beyond its reasonable control, including natural disasters, fire, government restrictions, civil unrest, major utility failures or widespread network outages.",
      "Where possible, an alternative arrangement, rescheduling or appropriate refund will be considered.",
    ],
  },
  {
    title: "Separate agreements",
    items: [
      "Special bookings, recurring facility rentals, partnerships, event productions and royalty arrangements may require separate written agreements.",
      "Where a separate signed agreement contains different terms, those specific terms will take precedence over these general website conditions to the extent of any inconsistency.",
    ],
  },
  {
    title: "Governing law",
    body: "These Terms & Conditions are governed by the laws of the Federal Republic of Nigeria. Any dispute will be handled in accordance with applicable Nigerian law.",
  },
];

export const metadata: Metadata = {
  title: "Terms & Conditions | Genie Pro Studios",
  description:
    "Booking, payment, rescheduling, studio conduct, project files, intellectual property, and service terms for Genie Pro Studios.",
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-20">
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Genie Pro Studios
          </span>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Welcome to Genie Pro Studios. We are committed to providing a
            professional, creative and seamless experience for every client. By
            booking or using our services, you agree to the following terms and
            conditions.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
          {TERMS_SECTIONS.map((section, index) => (
            <section key={section.title} className="flex flex-col gap-4">
              <h2 className="font-heading text-xl font-medium text-foreground sm:text-2xl">
                <span className="mr-3 font-mono text-sm text-[var(--amber-glow)]">
                  {index + 1}.
                </span>
                {section.title}
              </h2>
              {section.items && (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-[var(--amber-glow)]">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.body && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              )}
            </section>
          ))}

          <aside className="flex flex-col gap-3 border border-[var(--amber-glow)]/40 bg-card p-6">
            <h2 className="font-heading text-lg font-medium text-foreground">
              Important notice
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By making a booking, paying a deposit or using Genie Pro Studios’
              services, you acknowledge that you have read and agreed to these
              Terms &amp; Conditions.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For enquiries or clarification, please contact the Studio through
              its official communication channels.
            </p>
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              Genie Pro Studios — Professional Music Production | Recording |
              Mixing &amp; Mastering | Video Production | Livestreaming |
              Rehearsal Facilities | Event Technical Services
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
