import type { NextConfig } from "next";

// Security headers (2026-10-03 audit, finding V-3: the app previously set
// none at all). Applied to every route via the "/:path*" source — these are
// all response headers with no per-route variation, so one rule covers both
// the GenieProStudios and Triumph scopes plus the two admin areas.
//
// X-Frame-Options + frame-ancestors are the load-bearing ones here: without
// them /admin and /triumph-admin can be iframed, which makes the payment
// status toggle and the project update form clickjackable.
const SECURITY_HEADERS = [
  // Belt-and-suspenders with CSP's frame-ancestors below — X-Frame-Options
  // is obeyed by older browsers that ignore frame-ancestors, and vice versa.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // strict-origin-when-cross-origin keeps the TMG-XXXXXX project code in
  // /triumph/track/[code] URLs from leaking to third-party origins via the
  // Referer header — that code is half of an access credential.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // 2 years + preload is the submission requirement for hstspreload.org.
  // Vercel terminates TLS and already redirects http->https; this stops the
  // first-request downgrade window.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// React's DEVELOPMENT build calls eval() for debugging features (notably
// reconstructing callstacks across the server/client boundary). The
// production build never does. So 'unsafe-eval' is granted in dev only —
// without it `next dev` throws "eval() is not supported in this
// environment", and with it in production we'd be handing back a large part
// of what this CSP exists to prevent.
const isDev = process.env.NODE_ENV !== "production";

// CSP kept deliberately separate and commented, because the 'unsafe-*'
// allowances below are real and shouldn't be silently inherited:
//   - 'unsafe-inline' on script-src: Next.js injects inline bootstrap
//     scripts, and app/layout.tsx + app/triumph/page.tsx both render inline
//     JSON-LD <script> tags. Removing this needs nonce plumbing through a
//     proxy, which is a bigger change than this audit pass.
//   - 'unsafe-inline' on style-src: framer-motion and Radix write inline
//     styles on animated/positioned elements at runtime.
//   - 'unsafe-eval' on script-src: DEV ONLY, see isDev above.
// Even with those, this CSP still meaningfully constrains where scripts,
// frames, and form posts can originate — it is not a no-op.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  // img.youtube.com: portfolio thumbnails. blob:/data: : OG images and the
  // base64 logo data URIs. *.supabase.co: signed storage URLs.
  "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com https://*.supabase.co",
  "media-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  // wss://*.supabase.co is required by Supabase Realtime (the admin
  // dashboards' live refresh) — without it those channels silently fail.
  // ws: is dev-only, for Turbopack's HMR socket: 'self' does not reliably
  // cover a ws:// origin, so HMR breaks without it.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://va.vercel-scripts.com${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  // youtube-nocookie: portfolio video embeds. paystack: checkout iframe.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://checkout.paystack.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
