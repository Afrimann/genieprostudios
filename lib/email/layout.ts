import type { EmailBrand } from "@/lib/email/brand";

// Table-based layout with every rule inlined (not a <style> block) — the
// one layout approach that renders identically across Gmail, Apple Mail,
// and Outlook's Word-based engine, which is why every real transactional
// email provider (Moniepoint included) still builds emails this way instead
// of with regular CSS. No gradients anywhere, by design — every fill below
// is a flat hex value.
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BODY_TEXT_COLOR = "#3f3f46";
const MUTED_TEXT_COLOR = "#71717a";
const CARD_BORDER_COLOR = "#e4e4e7";
const PAGE_BG_COLOR = "#f4f4f5";

/** Section heading inside the email body — one per email, near the top. */
export function heading(text: string, brand: EmailBrand): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;font-family:${FONT_STACK};color:${brand.headingColor};">${text}</h1>`;
}

/** Small uppercase label above the heading — same eyebrow convention used across the sites' own section headers. */
export function eyebrow(text: string, brand: EmailBrand): string {
  return `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-family:${FONT_STACK};color:${brand.accentColor};">${text}</p>`;
}

/** Body copy. Pass pre-escaped/trusted HTML — callers escape any user-submitted text before interpolating it in. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-family:${FONT_STACK};color:${BODY_TEXT_COLOR};">${text}</p>`;
}

/** Label/value receipt rows — e.g. service, session date, amount paid — read more like a Moniepoint transaction receipt than a bullet list. */
export function detailTable(rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${CARD_BORDER_COLOR};font-size:14px;font-family:${FONT_STACK};color:${MUTED_TEXT_COLOR};">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${CARD_BORDER_COLOR};font-size:14px;font-family:${FONT_STACK};color:${BODY_TEXT_COLOR};font-weight:600;text-align:right;">${value}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${rowsHtml}</table>`;
}

/** Quoted note/message callout — a message body, a project-details field — set apart from the email's own copy. */
export function calloutBox(html: string, brand: EmailBrand): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding:14px 16px;background-color:#fafafa;border-left:3px solid ${brand.accentColor};font-size:14px;line-height:1.6;font-family:${FONT_STACK};color:${BODY_TEXT_COLOR};">
          ${html}
        </td>
      </tr>
    </table>`;
}

/** Large emphasized code — a project code or a one-time verification code. */
export function codeBlock(code: string, brand: EmailBrand): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td align="center" style="padding:18px 16px;background-color:#fafafa;border:1px solid ${CARD_BORDER_COLOR};border-radius:6px;font-size:26px;font-weight:700;letter-spacing:0.12em;font-family:${FONT_STACK};color:${brand.headingColor};">
          ${code}
        </td>
      </tr>
    </table>`;
}

/** Solid-fill CTA button — no gradient, a plain rounded rect per brand's ctaColor/ctaTextColor. */
export function ctaButton(url: string, label: string, brand: EmailBrand): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      <tr>
        <td style="border-radius:6px;background-color:${brand.ctaColor};">
          <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;font-family:${FONT_STACK};color:${brand.ctaTextColor};text-decoration:none;border-radius:6px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Full HTML document — header (logo + top accent bar), the body content a
 * caller assembles from the helpers above, and a footer. One shared shell
 * for both brands; only the `brand` config differs per call, which is also
 * exactly how the Resend "from" display name is already chosen per email
 * (see email-service.ts's getFromAddress/fromName).
 */
export function renderEmailLayout(brand: EmailBrand, { previewText, bodyHtml }: { previewText: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG_COLOR};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG_COLOR};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid ${CARD_BORDER_COLOR};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="height:4px;background-color:${brand.accentColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid ${CARD_BORDER_COLOR};">
              <img src="${brand.logoUrl}" alt="${brand.logoAlt}" width="${brand.logoWidth}" height="${brand.logoHeight}" style="display:block;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${PAGE_BG_COLOR};border-top:1px solid ${CARD_BORDER_COLOR};">
              <p style="margin:0;font-size:12px;line-height:1.5;font-family:${FONT_STACK};color:${MUTED_TEXT_COLOR};">
                &copy; ${year} ${brand.name}. This is an automated message — please don't reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
