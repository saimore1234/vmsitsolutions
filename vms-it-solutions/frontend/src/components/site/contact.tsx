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

const WHATSAPP_FIELD_MAX = 300;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeForWhatsApp(value: string) {
  return value.replace(CONTROL_CHARS, " ").trim().slice(0, WHATSAPP_FIELD_MAX);
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
      name: sanitizeForWhatsApp(form.name), email: sanitizeForWhatsApp(form.email), phone: sanitizeForWhatsApp(form.phone),
      company: sanitizeForWhatsApp(form.company), service: KIND_LABEL[form.kind] ?? form.kind, message: sanitizeForWhatsApp(form.message),
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

      if (communication?.thankYouPageEnabled && communication.autoRedirectEnabled) {
        setTimeout(() => router.push("/thank-you"), 400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request");
      setState("error");
    }
  }

  return (
    <section id="contact" className="relative py-14">
      <div className="glow-orb -right-24 top-10 h-80 w-80 bg-violet/25" />
      <div className="relative mx-auto grid max-w-6xl animate-fade-in-up gap-10 px-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-aqua">{eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-haze">
            {description}
          </p>
          <div className="mt-6 space-y-2 font-mono-x text-xs uppercase tracking-widest text-haze">
            {email && <p>Email — <span className="text-fg">{email}</span></p>}
            {phone && <p>Phone — <span className="text-fg">{phone}</span></p>}
            <p>Response — <span className="text-fg">within one business day</span></p>
          </div>
        </div>

        {state === "sent" ? (
          <div className="glass animate-scale-in grid place-items-center rounded-xl p-10 text-center">
            <div>
              <div className="font-display text-xl font-semibold text-fg">Thank you.</div>
              <p className="mt-2 text-sm text-haze">Your enquiry has been submitted successfully.</p>
              {communication?.whatsappEnabled && communication.whatsappNumber && (
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="glass mt-4 rounded-lg px-4 py-2 text-xs font-semibold text-aqua transition-all duration-200 ease-out hover:text-fg active:scale-95"
                >
                  Send via WhatsApp too
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="glass grid gap-4 rounded-xl p-6 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-haze">
              Your name
              <input required value={form.name} onChange={set("name")} className="field-glass rounded-lg px-3 py-2.5 text-sm" placeholder="Priya Sharma" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-haze">
              Work email
              <input required type="email" value={form.email} onChange={set("email")} className="field-glass rounded-lg px-3 py-2.5 text-sm" placeholder="priya@company.com" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-haze">
              Phone
              <input required value={form.phone} onChange={set("phone")} className="field-glass rounded-lg px-3 py-2.5 text-sm" placeholder="+91 …" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-haze">
              Company
              <input required value={form.company} onChange={set("company")} className="field-glass rounded-lg px-3 py-2.5 text-sm" placeholder="Company Pvt Ltd" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-haze sm:col-span-2">
              I&apos;m interested in
              <select required value={form.kind} onChange={set("kind")} className="field-glass rounded-lg px-3 py-2.5 text-sm">
                <option value="demo" className="bg-void">{KIND_LABEL.demo}</option>
                <option value="quote" className="bg-void">{KIND_LABEL.quote}</option>
                <option value="contact" className="bg-void">{KIND_LABEL.contact}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-haze sm:col-span-2">
              What should we know?
              <textarea required rows={4} value={form.message} onChange={set("message")} className="field-glass resize-none rounded-lg px-3 py-2.5 text-sm" placeholder="Industry, team size, current systems…" />
            </label>
            {error && <p className="animate-fade-in-up text-xs text-red-400 sm:col-span-2">{error}</p>}
            <button
              disabled={state === "sending"}
              className="btn-brand rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-60 sm:col-span-2"
            >
              {state === "sending" ? "Sending…" : "Request demo"}
            </button>
            {communication?.recaptchaEnabled && (
              <p className="text-[11px] text-haze sm:col-span-2">Protected by reCAPTCHA.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
