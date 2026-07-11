import { prisma } from "../config/prisma";

/** Verifies a Google reCAPTCHA token against the admin-configured secret key.
 * Skips verification (returns ok) whenever reCAPTCHA isn't enabled/configured, so the
 * contact form keeps working before an admin sets up real reCAPTCHA credentials. */
export async function verifyRecaptcha(token: string | undefined): Promise<{ ok: boolean; reason?: string }> {
  const settings = await prisma.communicationSetting.findUnique({ where: { id: "communication" } });
  if (!settings?.recaptchaEnabled || !settings.recaptchaSecretKey) return { ok: true };
  if (!token) return { ok: false, reason: "Missing reCAPTCHA token" };

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: settings.recaptchaSecretKey, response: token }),
    });
    const json = await res.json();
    if (!json.success || (typeof json.score === "number" && json.score < 0.5)) {
      return { ok: false, reason: "reCAPTCHA verification failed" };
    }
    return { ok: true };
  } catch {
    // Google's verification API being unreachable shouldn't block every submission.
    return { ok: true };
  }
}
