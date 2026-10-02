// Shared presentation metadata for `services.category` values (migration
// 0002_services.sql seed data). Lives here — not in service-repository.ts,
// which stays dumb data access, and not duplicated per-page — so the
// homepage teaser and the full /services page always show the same label
// and copy for a given category. Descriptions are generic, definitional
// restatements of what each category name already means (rehearsal time,
// multi-track inputs, etc.), not specific claims about equipment or staff.

export const CATEGORY_LABELS: Record<string, string> = {
  rehearsal_day: "Rehearsal Sessions — Day",
  rehearsal_night: "Rehearsal Sessions — Night",
  multitrack_day: "Multi-track Recording — Day",
  multitrack_night: "Multi-track Recording — Night",
  video_livestream_day: "Video Livestream",
  virtual_package_day: "Virtual Package — Day",
  virtual_package_night: "Virtual Package — Night",
  post_production: "Post-Production Add-ons",
};

export const CATEGORY_BLURBS: Record<string, string> = {
  rehearsal_day: "Band or solo rehearsal time in a fully equipped room, booked by the hour.",
  rehearsal_night: "The same rehearsal space, at after-hours rates for late sessions.",
  multitrack_day: "Full multi-track recording with isolated inputs for every instrument and vocal.",
  multitrack_night: "Multi-track recording booked for evening and late sessions.",
  video_livestream_day: "Single-angle livestream setup for your performance or service.",
  virtual_package_day: "Multi-platform livestream package, built for Facebook and YouTube Live.",
  virtual_package_night: "Virtual package rates for evening broadcasts.",
  post_production: "Mixing and mastering for songs recorded here or sent in remotely.",
};

// Explicit display order — object key order from a DB query isn't
// guaranteed to match the order we want to present categories in.
export const CATEGORY_ORDER = [
  "rehearsal_day",
  "rehearsal_night",
  "multitrack_day",
  "multitrack_night",
  "video_livestream_day",
  "virtual_package_day",
  "virtual_package_night",
  "post_production",
];
