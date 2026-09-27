// Rich descriptive content for the booking flow's package cards — feature
// checklists and notes, sourced from the studio's original rate card
// (2026-09-27). Deliberately holds NO prices or durations: those always
// come live from the `services` table (lib/repositories/service-repository.ts)
// so this file can never drift out of sync with what a customer actually
// pays. This is presentation content only, grouped one level above the DB's
// `category` column — e.g. "rehearsal" here covers both `rehearsal_day` and
// `rehearsal_night` categories, matching how the original rate card showed
// one card per package with separate Day/Night columns inside it.
export type PackageFeature = {
  label: string;
  // true = included (✓ on the original rate card), false = explicitly not
  // included (the "·" notes, e.g. "No stage lights") — shown differently so
  // a customer can't misread an exclusion as inclusion.
  included: boolean;
  // Marks a feature exclusive to/above the base tier (the "✓✓" rows on the
  // original Mix + Master Bundle card) — rendered with a bit more emphasis.
  highlight?: boolean;
};

export type PackageGroupContent = {
  id: string;
  title: string;
  subtitle?: string;
  // DB `services.category` values this card pulls its live day/night priced
  // rows from (grouped by the _day/_night suffix). Mutually exclusive with
  // matchLabel.
  categories?: string[];
  // For single-row packages (the per-song add-ons) that aren't really a
  // day/night matrix — matched by exact `services.label`.
  matchLabel?: string;
  features: PackageFeature[];
};

export const PACKAGE_GROUPS: PackageGroupContent[] = [
  {
    id: "video_livestream",
    title: "1 iPhone Camera Angle Video Livestream",
    subtitle: "1080p quality stream",
    categories: ["video_livestream_day"],
    features: [
      { label: "One camera angle streaming to multiple platforms", included: true },
      { label: "Recorded stream video", included: true },
      { label: "Come with your own login details and flier display", included: false },
    ],
  },
  {
    id: "rehearsal",
    title: "Rehearsal Session",
    subtitle: "With stereo audio",
    categories: ["rehearsal_day", "rehearsal_night"],
    features: [
      { label: "Stereo recording", included: true },
      { label: "Setup time 30 minutes before your allocated time", included: true },
      { label: "Stage lights", included: false },
      { label: "Moving head lights", included: false },
    ],
  },
  {
    id: "multitrack",
    title: "Multi Track Recording",
    subtitle: "Full session, ready for post",
    categories: ["multitrack_day", "multitrack_night"],
    features: [
      { label: "Full lighting", included: true },
      { label: "Raw files", included: true },
      { label: "Multi-track recording rig", included: true },
      { label: "Mixing & mastering", included: false },
      { label: "Video coverage or recording", included: false },
    ],
  },
  {
    id: "virtual_package",
    title: "Virtual Package",
    subtitle: "Facebook or YouTube Live",
    categories: ["virtual_package_day", "virtual_package_night"],
    features: [
      { label: "Stereo recording", included: true },
      { label: "Access to studio facilities", included: true },
      { label: "Video livestreaming", included: false },
    ],
  },
  {
    id: "mix_master_bundle",
    title: "Mix + Master Bundle",
    subtitle: "(20 mins per song)",
    matchLabel: "Mix + Master Bundle (per song)",
    features: [
      { label: "5-day queue after deposit", included: true },
      { label: "3 working days once started", included: true, highlight: true },
      { label: "Full mixing service", included: true, highlight: true },
      { label: "Professional vocal tuning", included: true, highlight: true },
      { label: "Dynamics & FX processing", included: true, highlight: true },
      { label: "Stereo mastering", included: true, highlight: true },
      { label: "Loudness optimization", included: true, highlight: true },
      { label: "Radio-ready output", included: true, highlight: true },
      { label: "The complete release-ready package", included: true },
    ],
  },
  {
    id: "post_production_addon",
    title: "Post Production Add-on",
    subtitle: "Mixing and mastering add-on",
    matchLabel: "Mixing & Mastering (per song)",
    features: [
      { label: "24-hour turnaround", included: true },
      { label: "Additional instrumentation", included: true, highlight: true },
      { label: "Auxiliary arrangement", included: true, highlight: true },
      { label: "Electronic orchestration", included: true, highlight: true },
      { label: "Production enhancement", included: true, highlight: true },
      { label: "Available as an add-on to your mixing project", included: true },
    ],
  },
];
