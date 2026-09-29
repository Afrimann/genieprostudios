// TODO(client): placeholder pricing — same tier *shape* as the
// gospelsoundclinic.studio reference (a generic, industry-standard
// mixing/mastering tier structure, not proprietary to that business), but
// these dollar amounts are placeholders. Confirm real pricing before launch.
export const TRIUMPH_PRICING_TIERS = [
  {
    id: "standard-mix",
    name: "Standard Mix",
    priceValue: 350,
    unit: "/song",
    description: "Vocal tuning, dynamics & FX. Mastering not included.",
    turnaround: "3 working days (5-day queue)",
    featured: false,
  },
  {
    id: "mastering",
    name: "Mastering",
    priceValue: 75,
    unit: "/song",
    description: "Tonal correction, loudness optimization, radio-ready.",
    turnaround: "3 working days (5-day queue)",
    featured: false,
  },
  {
    id: "mix-master",
    name: "Mix + Master Bundle",
    priceValue: 400,
    unit: "/song",
    description: "Full mixing plus stereo mastering, radio-ready.",
    turnaround: "3 working days (5-day queue)",
    featured: true,
  },
  {
    id: "express-mix",
    name: "Express Mix Bundle",
    priceValue: 500,
    unit: "/song",
    description: "Mixing and mastering, vocal tuning, dynamics & FX.",
    turnaround: "24-hour queue",
    featured: false,
  },
  {
    id: "add-ons",
    name: "Add-Ons",
    priceValue: 100,
    unit: "/song",
    description: "Additional instrumentation, arrangement, orchestration.",
    turnaround: "24-hour turnaround",
    featured: false,
  },
] as const;

export type TriumphPricingTierId = (typeof TRIUMPH_PRICING_TIERS)[number]["id"];
