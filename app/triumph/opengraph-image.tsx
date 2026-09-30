import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Triumph Music Global's own OG/Twitter image — overrides the root
// app/opengraph-image.tsx for this route segment (Next's file-convention
// nesting), since this is a distinct business from the main site and needs
// its own branding, not Genie Pro's. Same logo-embedding approach as the
// root OG image; uses Triumph's own logo (with tagline) and teal accent
// rather than Genie Pro's amber.
export const alt = "Triumph Music Global — mixing, mastering, and production";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_WIDTH = 260;
const LOGO_HEIGHT = 182; // matches triumph-logo-trimmed.png's ~1.435 aspect ratio

export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), "public/images/triumph-logo-trimmed.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#120b16",
          gap: 28,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          style={{ borderRadius: 16, backgroundColor: "#ffffff", padding: 12 }}
        />
        <div style={{ display: "flex", fontSize: 50, fontWeight: 600, color: "#f3eee0" }}>
          Mixing &amp; mastering, built to land.
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#22e6c8", letterSpacing: 2 }}>
          TRIUMPH MUSIC GLOBAL
        </div>
      </div>
    ),
    { ...size },
  );
}
