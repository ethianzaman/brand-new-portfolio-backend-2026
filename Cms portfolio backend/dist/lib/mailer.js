"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailProvider = mailProvider;
exports.isMailConfigured = isMailConfigured;
exports.sendNewMessageNotification = sendNewMessageNotification;
exports.sendReplyToVisitor = sendReplyToVisitor;
const nodemailer_1 = __importDefault(require("nodemailer"));
const resend_1 = require("resend");
const gmailUser = process.env.GMAIL_USER?.trim();
const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
const resendKey = process.env.RESEND_API_KEY?.trim();
const fromName = process.env.CONTACT_FROM_NAME?.trim() ||
    process.env.MAIL_FROM_NAME?.trim() ||
    "";
const explicitProvider = process.env.MAIL_PROVIDER?.trim().toLowerCase();
const resend = resendKey ? new resend_1.Resend(resendKey) : null;
const gmail = gmailUser && gmailPass
    ? nodemailer_1.default.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
    })
    : null;
function activeProvider() {
    if (explicitProvider === "gmail")
        return gmail ? "gmail" : null;
    if (explicitProvider === "resend")
        return resend ? "resend" : null;
    if (gmail)
        return "gmail";
    if (resend)
        return "resend";
    return null;
}
/** The provider that will be used, or null when mail isn't configured. */
function mailProvider() {
    return activeProvider();
}
function isMailConfigured() {
    return activeProvider() !== null;
}
function fromAddress(provider) {
    if (provider === "gmail") {
        // Gmail only permits sending from the authenticated account.
        return fromName ? `${fromName} <${gmailUser}>` : String(gmailUser);
    }
    const raw = process.env.CONTACT_FROM_EMAIL?.trim();
    if (raw && fromName)
        return `${fromName} <${raw.replace(/^.*<|>.*$/g, "")}>`;
    if (raw)
        return raw;
    return "Portfolio <onboarding@resend.dev>";
}
function adminAddress() {
    const explicit = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
    if (explicit)
        return explicit;
    const fallback = process.env.ADMIN_EMAIL?.trim();
    return fallback || null;
}
function errstring(error) {
    if (typeof error === "object" && error !== null && "message" in error) {
        const value = error.message;
        if (typeof value === "string" && value.trim())
            return value;
    }
    return null;
}
function reason(error) {
    if (!error)
        return "Unknown email error.";
    return errstring(error) ?? (error instanceof Error ? error.message : String(error));
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
                <p style="margin:0;font-size:12px;color:#a1a1aa;">Sent automatically from Ethian Zaman Team.</p>
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
async function deliver(args) {
    const provider = activeProvider();
    if (!provider) {
        const error = "Email is not configured — set GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY with a verified domain.";
        console.warn("[mailer] skipping send:", error);
        return { sent: false, error };
    }
    try {
        if (provider === "gmail") {
            const info = await gmail.sendMail({
                from: fromAddress("gmail"),
                to: args.to,
                replyTo: args.replyTo || undefined,
                subject: args.subject,
                html: args.html,
            });
            const rejected = (info.rejected ?? []);
            if (rejected.length > 0) {
                console.error("[mailer] gmail rejected recipient:", rejected);
                return {
                    sent: false,
                    error: `Gmail rejected the recipient (${rejected.join(", ")}).`,
                };
            }
            return { sent: true };
        }
        const result = await resend.emails.send({
            from: fromAddress("resend"),
            to: args.to,
            replyTo: args.replyTo || undefined,
            subject: args.subject,
            html: args.html,
        });
        if (result.error) {
            console.error("[mailer] resend rejected:", result.error);
            return { sent: false, error: reason(result.error) };
        }
        return { sent: true };
    }
    catch (error) {
        console.error("[mailer] failed to send:", error instanceof Error ? error.message : error);
        return { sent: false, error: reason(error) };
    }
}
/**
 * Notify the admin that a new contact message arrived.
 */
async function sendNewMessageNotification(payload) {
    const to = adminAddress();
    if (!to) {
        const error = "No admin recipient — set ADMIN_NOTIFICATION_EMAIL (or ADMIN_EMAIL).";
        console.warn("[mailer] skipping new-message notification:", error);
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
    return deliver({
        to,
        replyTo: payload.email,
        subject: `New contact message${payload.subject ? ` — ${payload.subject}` : ""}`,
        html: shell("New contact message", inner),
    });
}
/**
 * Send an admin reply back to the visitor. `replyTo` is the admin so a reply
 * from the visitor lands back in the same mailbox.
 */
async function sendReplyToVisitor(args) {
    const inner = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">Hi ${escapeHtml(args.name || "there")},</p>
    <div style="margin:0 0 20px;font-size:14px;color:#27272a;line-height:1.7;white-space:pre-wrap;">${escapeHtml(args.body)}</div>
    <p style="margin:0;font-size:13px;color:#71717a;">— Sent from the Ethian Zaman</p>`;
    return deliver({
        to: args.to,
        replyTo: args.replyTo || adminAddress() || undefined,
        subject: args.subject?.trim()
            ? `Re: ${args.subject.replace(/^re:\s*/i, "")}`
            : "Re: Your message",
        html: shell("Thanks for reaching out", inner),
    });
}
