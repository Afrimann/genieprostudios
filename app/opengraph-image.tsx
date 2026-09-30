import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Default OG/Twitter image for every main-site route that doesn't define
// its own (Next's file-convention: app/opengraph-image.tsx is inherited by
// all sibling/child routes unless overridden — app/triumph/opengraph-image.tsx
// overrides it for the Triumph scope). Logo embedded as a base64 data URI
// (read from disk at render time) rather than fetched by URL — reliable at
// both build time and runtime without depending on a live server round-trip.
export const alt = "GenieProStudios — recording, rehearsal, and production sessions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_WIDTH = 220;
const LOGO_HEIGHT = 186; // matches public/images/logo.png's 1538x1298 aspect ratio

export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), "public/images/logo.png"));
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
          style={{ borderRadius: 20 }}
        />
        <div style={{ display: "flex", fontSize: 54, fontWeight: 600, color: "#f3eee0" }}>
          Genie Pro Studios
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#f2c230", letterSpacing: 2 }}>
          RECORDING · REHEARSAL · PRODUCTION
        </div>
      </div>
    ),
    { ...size },
  );
}
