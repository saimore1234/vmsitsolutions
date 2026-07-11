import nodemailer from "nodemailer";
import { prisma } from "../config/prisma";

/** Best-effort email send using the admin-configured SMTP settings. Never throws — a missing
 * or misconfigured SMTP setup must not break the request that triggered the email. */
export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) {
  try {
    const smtp = await prisma.smtpSetting.findUnique({ where: { id: "smtp" } });
    if (!smtp?.host || !smtp.fromEmail) {
      console.warn("[mailer] SMTP not configured in Settings → Communication — skipping email send");
      return { sent: false, reason: "SMTP not configured" };
    }
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port ?? 587,
      secure: smtp.encryption === "ssl",
      auth: smtp.username ? { user: smtp.username, pass: smtp.password ?? undefined } : undefined,
    });
    await transport.sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] send failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}
