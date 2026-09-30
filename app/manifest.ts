import type { MetadataRoute } from "next";

// PWA web manifest — icons generated from public/images/logo.png (see the
// sharp resize step that produced public/icons/icon-{192,512}.png; contain-
// fit onto white so the logo's own rounded-card look stays intact at both
// sizes rather than being cropped).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GenieProStudios",
    short_name: "GenieProStudios",
    description: "Recording, rehearsal, and production sessions for gospel artists.",
    start_url: "/",
    display: "standalone",
    background_color: "#120b16",
    theme_color: "#120b16",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
