"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Loosely typed (matches the existing company settings page convention) since form inputs
// always produce strings/booleans regardless of the field's real column type — numeric
// fields are coerced back to Number explicitly in save().
type SmtpSettings = Record<string, string | number | boolean | null>;
type CommSettings = Record<string, string | number | boolean | null>;

const inputCls = "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt";

export default function CommunicationSettingsPage() {
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [comm, setComm] = useState<CommSettings | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<SmtpSettings>("/settings/smtp"), api<CommSettings>("/settings/communication")])
      .then(([s, c]) => { setSmtp(s); setComm(c); setState("ready"); })
      .catch((e) => { setError(e.message); setState("error"); });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!smtp || !comm) return;
    setState("saving");
    setError("");
    try {
      const smtpPayload = { ...smtp, port: smtp.port !== "" && smtp.port != null ? Number(smtp.port) : null };
      const [savedSmtp, savedComm] = await Promise.all([
        api<SmtpSettings>("/settings/smtp", { method: "PATCH", body: JSON.stringify(smtpPayload) }),
        api<CommSettings>("/settings/communication", { method: "PATCH", body: JSON.stringify(comm) }),
      ]);
      setSmtp(savedSmtp);
      setComm(savedComm);
      setState("saved");
      setTimeout(() => setState("ready"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  if (state === "loading") return <p className="font-mono-x text-xs uppercase tracking-widest text-slate-400">Loading settings…</p>;
  if (!smtp || !comm) return null;

  const bindSmtp = (key: keyof SmtpSettings) => ({
    value: (smtp[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSmtp((s) => s && { ...s, [key]: e.target.value }),
  });
  const bindComm = (key: keyof CommSettings) => ({
    value: (comm[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setComm((c) => c && { ...c, [key]: e.target.value }),
  });
  const bindToggle = (key: keyof CommSettings) => ({
    checked: Boolean(comm[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setComm((c) => c && { ...c, [key]: e.target.checked }),
  });

  return (
    <form onSubmit={save} className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Communication</h1>
          <p className="mt-1 text-sm text-slate-500">Email delivery, WhatsApp handoff and spam protection for every public form.</p>
        </div>
        <button disabled={state === "saving"} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save changes"}
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Lead capture behaviour</h2>
        <p className="mt-1 text-xs text-slate-400">Applies to the contact, demo and quote forms across the site.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Notification email
            <input type="email" {...bindComm("notifyEmail")} className={inputCls} />
          </label>
          <div className="flex flex-wrap items-end gap-5 pb-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" {...bindToggle("databaseSaveEnabled")} /> Save to database</label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" {...bindToggle("emailEnabled")} /> Send email notification</label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" {...bindToggle("whatsappEnabled")} /> Open WhatsApp</label>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" {...bindToggle("thankYouPageEnabled")} /> Enable dedicated thank-you page</label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" {...bindToggle("autoRedirectEnabled")} /> Auto-redirect to thank-you page after submit</label>
        </div>
        {Boolean(comm.emailEnabled) && (!smtp.host || !smtp.fromEmail) && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Email notifications are enabled, but SMTP isn&apos;t fully configured (host and from-address are required) — no lead
            notification emails will actually be sent until you complete the Email (SMTP) section below.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Email (SMTP)</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Provider
            <select {...bindSmtp("provider")} className={inputCls}>
              <option value="smtp">Custom SMTP</option>
              <option value="sendgrid">SendGrid</option>
              <option value="mailgun">Mailgun</option>
              <option value="ses">Amazon SES</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Encryption
            <select {...bindSmtp("encryption")} className={inputCls}>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            SMTP host
            <input {...bindSmtp("host")} placeholder="smtp.example.com" className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            SMTP port
            <input type="number" {...bindSmtp("port")} placeholder="587" className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Username
            <input {...bindSmtp("username")} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Password
            <input type="password" {...bindSmtp("password")} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            From email
            <input type="email" {...bindSmtp("fromEmail")} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            From name
            <input {...bindSmtp("fromName")} className={inputCls} />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">No email is sent until a host and from-address are configured here.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">WhatsApp</h2>
        <div className="mt-4 grid gap-5">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:max-w-xs">
            WhatsApp number (with country code, digits only)
            <input {...bindComm("whatsappNumber")} placeholder="919137801103" className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Default message template
            <textarea rows={10} {...bindComm("whatsappDefaultMessage")} className={`${inputCls} resize-y font-mono text-xs`} />
            <span className="text-[11px] font-normal text-slate-400">
              Variables: {"{{name}} {{email}} {{phone}} {{company}} {{service}} {{message}}"}
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Spam protection</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 sm:col-span-2">
            <input type="checkbox" {...bindToggle("recaptchaEnabled")} /> Enable Google reCAPTCHA v3
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Site key
            <input {...bindComm("recaptchaSiteKey")} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Secret key
            <input type="password" {...bindComm("recaptchaSecretKey")} className={inputCls} />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Get keys from google.com/recaptcha (v3). Submissions are only blocked once both a site key and secret key are set and this is enabled.
          Rate limiting (15 submissions per 10 minutes per IP) is already active on every public form regardless of this setting.
        </p>
      </section>
    </form>
  );
}
