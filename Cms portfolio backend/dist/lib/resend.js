"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResendConfigured = isResendConfigured;
exports.sendNewMessageNotification = sendNewMessageNotification;
exports.sendReplyToVisitor = sendReplyToVisitor;
const resend_1 = require("resend");
/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Resend email transport
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Thin, fail-safe wrapper around the Resend SDK. Nothing in here is allowed
 *  to throw into a request handler: a missing key, a bad sender or an API
 *  outage must degrade to "email not sent", never to a failed contact
 *  submission or a failed dashboard action.
 *
 *  Env:
 *   RESEND_API_KEY            — Resend API key (required to actually send)
 *   CONTACT_FROM_EMAIL        — verified sender, e.g. "Portfolio <hi@you.dev>"
 *   CONTACT_FROM_NAME         — optional display name override
 *   ADMIN_NOTIFICATION_EMAIL  — where new-message alerts go (falls back to ADMIN_EMAIL)
 */
const apiKey = process.env.RESEND_API_KEY?.trim();
const client = apiKey ? new resend_1.Resend(apiKey) : null;
const DEFAULT_FROM = "Portfolio <onboarding@resend.dev>";
function fromAddress() {
    const raw = process.env.CONTACT_FROM_EMAIL?.trim();
    const name = process.env.CONTACT_FROM_NAME?.trim();
    if (raw && name)
        return `${name} <${raw.replace(/^.*<|>.*$/g, "")}>`;
    if (raw)
        return raw;
    return DEFAULT_FROM;
}
function adminAddress() {
    const explicit = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
    if (explicit)
        return explicit;
    const fallback = process.env.ADMIN_EMAIL?.trim();
    return fallback || null;
}
function isResendConfigured() {
    return client !== null && adminAddress() !== null;
}
function reason(error) {
    if (!error)
        return "Unknown email error.";
    if (errstring(error))
        return errstring(error);
    return error instanceof Error ? error.message : String(error);
}
function errstring(error) {
    if (typeof error === "object" && error !== null && "message" in error) {
        const value = error.message;
        if (typeof value === "string" && value.trim())
            return value;
    }
    return null;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function shell(title, inner) {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;">
                <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr><td style="padding:28px;">${inner}</td></tr>
            <tr>
              <td style="padding:18px 28px;background:#fafafa;border-top:1px solid #f0f0f0;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">Sent automatically from your portfolio dashboard.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
function field(label, value) {
    return `<tr>
    <td style="padding:6px 0;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.04em;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#18181b;font-weight:500;">${escapeHtml(value || "—")}</td>
  </tr>`;
}
/**
 * Notify the admin that a new contact message arrived.
 * Returns true when Resend accepted the send.
 */
async function sendNewMessageNotification(payload) {
    const to = adminAddress();
    if (!client || !to) {
        const error = "Email is not configured — set RESEND_API_KEY and ADMIN_NOTIFICATION_EMAIL.";
        console.warn("[resend] skipping new-message notification:", error);
        return { sent: false, error };
    }
    const inner = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">You received a new message from your portfolio contact form.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;padding-top:8px;">
      ${field("Name", payload.name)}
      ${field("Email", payload.email)}
      ${field("Subject", payload.subject ?? "")}
      ${field("Budget", payload.budget ?? "")}
    </table>
    <div style="margin-top:20px;padding:16px;border-radius:12px;background:#f4f4f5;border:1px solid #e4e4e7;">
      <p style="margin:0;font-size:14px;color:#27272a;line-height:1.6;white-space:pre-wrap;">${escapeHtml(payload.body)}</p>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#71717a;">Open your dashboard inbox to reply directly to ${escapeHtml(payload.name)}.</p>`;
    try {
        const result = await client.emails.send({
            from: fromAddress(),
            to,
            replyTo: payload.email,
            subject: `New contact message${payload.subject ? ` — ${payload.subject}` : ""}`,
            html: shell("New contact message", inner),
        });
        if (result.error) {
            console.error("[resend] new-message notification rejected:", result.error);
            return { sent: false, error: reason(result.error) };
        }
        return { sent: true };
    }
    catch (error) {
        console.error("[resend] failed to send new-message notification:", error instanceof Error ? error.message : error);
        return { sent: false, error: reason(error) };
    }
}
/**
 * Send an admin reply back to the visitor. `replyTo` is the admin so a reply
 * from the visitor lands back in the same mailbox.
 */
async function sendReplyToVisitor(args) {
    if (!client) {
        const error = "Email is not configured — set RESEND_API_KEY.";
        console.warn("[resend] skipping reply email:", error);
        return { sent: false, error };
    }
    const inner = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">Hi ${escapeHtml(args.name || "there")},</p>
    <div style="margin:0 0 20px;font-size:14px;color:#27272a;line-height:1.7;white-space:pre-wrap;">${escapeHtml(args.body)}</div>
    <p style="margin:0;font-size:13px;color:#71717a;">— Sent from the portfolio dashboard</p>`;
    try {
        const result = await client.emails.send({
            from: fromAddress(),
            to: args.to,
            replyTo: args.replyTo || adminAddress() || undefined,
            subject: args.subject?.trim()
                ? `Re: ${args.subject.replace(/^re:\s*/i, "")}`
                : "Re: Your message",
            html: shell("Thanks for reaching out", inner),
        });
        if (result.error) {
            console.error("[resend] reply email rejected:", result.error);
            return { sent: false, error: reason(result.error) };
        }
        return { sent: true };
    }
    catch (error) {
        console.error("[resend] failed to send reply email:", error instanceof Error ? error.message : error);
        return { sent: false, error: reason(error) };
    }
}
