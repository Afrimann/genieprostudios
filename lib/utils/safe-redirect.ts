// Open-redirect guard for the `?redirect=` search param that /login and
// /sign-up accept and then hand to router.push() (2026-10-03 audit, finding
// V-4). Without this, /login?redirect=https://evil.example sends a user who
// just authenticated on the real domain straight to an attacker-controlled
// lookalike — phishing that borrows this site's own trust.
//
// Allow ONLY same-origin absolute paths. Rejected:
//   - "https://evil.example"  — absolute URL, different origin
//   - "//evil.example"        — protocol-relative, resolves off-origin
//   - "/\evil.example"        — backslash; some browsers normalize \ to /,
//                               making this behave like "//evil.example"
//   - "evil.example"          — bare relative, resolves against current dir
//   - anything containing a control character (CR/LF smuggling attempts)
export const DEFAULT_REDIRECT = "/dashboard";

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(
  value: string | undefined | null,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (hasControlCharacter(value)) return fallback;
  return value;
}
