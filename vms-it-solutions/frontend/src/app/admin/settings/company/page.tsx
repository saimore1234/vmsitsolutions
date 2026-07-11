"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Company = Record<string, string | number | null>;

const GROUPS: { title: string; fields: { key: string; label: string; type?: "textarea" }[] }[] = [
  {
    title: "Identity",
    fields: [
      { key: "companyName", label: "Company name" },
      { key: "shortName", label: "Short name" },
      { key: "tagline", label: "Tagline" },
      { key: "website", label: "Website URL" },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "email", label: "General email" },
      { key: "supportEmail", label: "Support email" },
      { key: "salesEmail", label: "Sales email" },
      { key: "phone", label: "Phone" },
      { key: "mobile", label: "Mobile" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "workingHours", label: "Working hours" },
    ],
  },
  {
    title: "Registered address",
    fields: [
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
      { key: "pincode", label: "Pincode" },
    ],
  },
  {
    title: "Statutory",
    fields: [
      { key: "gstNumber", label: "GST number" },
      { key: "panNumber", label: "PAN number" },
      { key: "cinNumber", label: "CIN number" },
    ],
  },
  {
    title: "About",
    fields: [
      { key: "mission", label: "Mission", type: "textarea" },
      { key: "vision", label: "Vision", type: "textarea" },
      { key: "description", label: "Company description", type: "textarea" },
      { key: "ceoMessage", label: "CEO message", type: "textarea" },
      { key: "aboutCompany", label: "About company", type: "textarea" },
    ],
  },
];

export default function CompanySettingsPage() {
  const [form, setForm] = useState<Company>({});
  const [state, setState] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Company>("/settings/company")
      .then((data) => { setForm(data ?? {}); setState("ready"); })
      .catch((e) => { setError(e.message); setState("error"); });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError("");
    try {
      const saved = await api<Company>("/settings/company", { method: "PATCH", body: JSON.stringify(form) });
      setForm(saved);
      setState("saved");
      setTimeout(() => setState("ready"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  const bind = (key: string) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (state === "loading") return <p className="font-mono-x text-xs uppercase tracking-widest text-slate-400">Loading settings…</p>;

  return (
    <form onSubmit={save} className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Company settings</h1>
          <p className="mt-1 text-sm text-slate-500">These details appear across the public website — header, footer, contact section and legal pages.</p>
        </div>
        <button
          disabled={state === "saving"}
          className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save changes"}
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{group.title}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {group.fields.map((f) => (
              <label key={f.key} className={`grid gap-1.5 text-xs font-medium text-slate-600 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                {f.label}
                {f.type === "textarea" ? (
                  <textarea rows={3} {...bind(f.key)} className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                ) : (
                  <input {...bind(f.key)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}
    </form>
  );
}
