// Safe serializer for the JSON-LD <script> tags in app/layout.tsx and
// app/triumph/page.tsx (2026-10-03 audit, finding V-9).
//
// Those tags use dangerouslySetInnerHTML with JSON.stringify output. That is
// NOT currently exploitable — both objects are static module constants with
// no user input — but JSON.stringify does not escape "<", so the moment any
// dynamic value lands in one of those objects, a payload containing
// "</script>" would close the tag early and execute. Escaping the three
// characters that can break out of a <script> block costs nothing and
// removes the latent footgun rather than relying on every future edit to
// remember the rule.
//
// < / > / & are valid JSON escapes, so the emitted text still
// parses as the identical object — this changes the encoding, not the data.
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
