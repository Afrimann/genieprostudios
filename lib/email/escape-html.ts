/**
 * Every email body below interpolates some amount of user-submitted text
 * (a customer's name, a project-request note, a support message) directly
 * into an HTML string with no templating engine in between — this is the
 * one place that escaping has to happen, since nothing upstream (Zod
 * validation, the DB) does it for us. Without it, a project details field
 * containing e.g. `<img src=x onerror=...>` would execute in whatever mail
 * client renders it for the owner.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same as escapeHtml, plus turning literal newlines into <br> — for multi-line free text (a support message, a project-details field) where the line breaks the customer typed need to survive into the rendered email. */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}
