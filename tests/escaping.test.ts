import { describe, it, expect } from "vitest";

import { escapeHtml, escapeHtmlMultiline } from "@/lib/email/escape-html";
import { serializeJsonLd } from "@/lib/utils/json-ld";

// Transactional emails interpolate customer-submitted text (names, project
// details, support messages) straight into HTML strings with no templating
// engine. This escaping is the only thing between a crafted project-details
// field and script execution in the studio owner's mail client.
describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes & first so existing entities are not double-unescaped", () => {
    // If & were escaped last, "<" would become "&lt;" then "&amp;lt;".
    expect(escapeHtml("<")).toBe("&lt;");
  });

  it("neutralizes a script tag payload", () => {
    const payload = "<script>alert(1)</script>";
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script");
    expect(escaped).not.toContain("</script>");
  });

  it("neutralizes an attribute-breakout payload", () => {
    const escaped = escapeHtml(`" onerror="alert(1)`);
    expect(escaped).not.toContain(`"`);
  });

  it("leaves safe text untouched", () => {
    expect(escapeHtml("Tamar Collins")).toBe("Tamar Collins");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("escapeHtmlMultiline", () => {
  it("converts newlines to <br> while still escaping", () => {
    expect(escapeHtmlMultiline("line1\nline2")).toBe("line1<br>line2");
  });

  it("escapes before inserting <br>, so the <br> it adds is the only real tag", () => {
    const result = escapeHtmlMultiline("<b>bad</b>\nnext");
    expect(result).toBe("&lt;b&gt;bad&lt;/b&gt;<br>next");
  });
});

describe("serializeJsonLd", () => {
  it("escapes < > & so a payload cannot break out of a <script> block", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("still parses back to the identical object", () => {
    // The escapes are valid JSON, so this changes encoding, not data.
    const input = { "@type": "Organization", name: "Genie & Co <Studios>" };
    expect(JSON.parse(serializeJsonLd(input))).toEqual(input);
  });
});
