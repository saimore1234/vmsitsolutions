"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { CommunicationSettings } from "@/lib/site-settings";

declare global {
  interface Window {
    grecaptcha?: { ready: (cb: () => void) => void; execute: (siteKey: string, opts: { action: string }) => Promise<string> };
  }
}

const KIND_LABEL: Record<string, string> = { demo: "A product demo", quote: "An implementation quote", contact: "General enquiry" };

const DEFAULT_WHATSAPP_TEMPLATE = `Hello VMS IT Solutions,

A new website enquiry has been submitted.

Name:
{{name}}

Email:
{{email}}

Phone:
{{phone}}

Company:
{{company}}

Interested In:
{{service}}

Message:
{{message}}

Submitted from:
Website Contact Form`;

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function loadRecaptchaScript(siteKey: string) {
  if (document.querySelector(`script[data-recaptcha="${siteKey}"]`)) return;
  const script = document.createElement("script");
  script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
  script.dataset.recaptcha = siteKey;
  document.head.appendChild(script);
}

interface ContactSectionProps {
  email?: string | null;
  phone?: string | null;
  eyebrow?: string;
  title?: string;
  description?: string;
  defaultKind?: "demo" | "quote" | "contact";
  communication?: CommunicationSettings | null;
}

export function ContactSection({
  email, phone,
  eyebrow = "Book a demo",
  title = "See your processes running in the system",
  description = "Tell us what you make or move. We'll prepare a demo around your actual workflows — quotation to dispatch, purchase to payment, or shop floor to balance sheet.",
  defaultKind = "demo",
  communication,
}: ContactSectionProps) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", kind: defaultKind });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (communication?.recaptchaEnabled && communication.recaptchaSiteKey) {
      loadRecaptchaScript(communication.recaptchaSiteKey);
    }
  }, [communication?.recaptchaEnabled, communication?.recaptchaSiteKey]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function openWhatsApp() {
    if (!communication?.whatsappEnabled || !communication.whatsappNumber) return;
    const message = fillTemplate(communication.whatsappDefaultMessage || DEFAULT_WHATSAPP_TEMPLATE, {
      name: form.name, email: form.email, phone: form.phone, company: form.company,
      service: KIND_LABEL[form.kind] ?? form.kind, message: form.message,
    });
    const url = `https://wa.me/${communication.whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      let recaptchaToken: string | undefined;
      if (communication?.recaptchaEnabled && communication.recaptchaSiteKey && window.grecaptcha) {
        recaptchaToken = await new Promise<string>((resolve) => {
          window.grecaptcha!.ready(() => {
            window.grecaptcha!.execute(communication.recaptchaSiteKey!, { action: "contact" }).then(resolve);
          });
        });
      }

      const res = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, meta: { page: window.location.pathname }, recaptchaToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not send your request");

      setState("sent");
      openWhatsApp();

      if (communication?.thankYouPageEnabled && communication.autoRedirectEnabled) {
        setTimeout(() => router.push("/thank-you"), 400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request");
      setState("error");
    }
  }

  return (
    <section id="contact" className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-cobalt">{eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500">
            {description}
          </p>
          <div className="mt-8 space-y-2 font-mono-x text-xs uppercase tracking-widest text-slate-400">
            {email && <p>Email — <span className="text-ink">{email}</span></p>}
            {phone && <p>Phone — <span className="text-ink">{phone}</span></p>}
            <p>Response — <span className="text-ink">within one business day</span></p>
          </div>
        </div>

        {state === "sent" ? (
          <div className="grid place-items-center rounded-xl border border-cobalt/30 bg-cobalt/5 p-10 text-center">
            <div>
              <div className="font-display text-xl font-semibold text-ink">Thank you.</div>
              <p className="mt-2 text-sm text-slate-500">Your enquiry has been submitted successfully.</p>
              {communication?.whatsappEnabled && communication.whatsappNumber && (
                <p className="mt-3 text-xs text-slate-400">We opened WhatsApp with your enquiry pre-filled — just hit send there too.</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 bg-paper p-6 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Your name
              <input required value={form.name} onChange={set("name")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" placeholder="Priya Sharma" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Work email
              <input required type="email" value={form.email} onChange={set("email")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" placeholder="priya@company.com" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Phone
              <input required value={form.phone} onChange={set("phone")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" placeholder="+91 …" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Company
              <input required value={form.company} onChange={set("company")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" placeholder="Company Pvt Ltd" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
              I&apos;m interested in
              <select required value={form.kind} onChange={set("kind")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                <option value="demo">{KIND_LABEL.demo}</option>
                <option value="quote">{KIND_LABEL.quote}</option>
                <option value="contact">{KIND_LABEL.contact}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
              What should we know?
              <textarea required rows={4} value={form.message} onChange={set("message")} className="resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" placeholder="Industry, team size, current systems…" />
            </label>
            {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
            <button
              disabled={state === "sending"}
              className="rounded-lg bg-cobalt px-6 py-3 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60 sm:col-span-2"
            >
              {state === "sending" ? "Sending…" : "Request demo"}
            </button>
            {communication?.recaptchaEnabled && (
              <p className="text-[11px] text-slate-400 sm:col-span-2">Protected by reCAPTCHA.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
