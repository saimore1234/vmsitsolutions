"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export function CareerApplyForm({ careerId }: { careerId: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", coverNote: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch(`${API_URL}/careers/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ careerId, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not submit your application");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="glass animate-scale-in rounded-xl p-6 text-center">
        <div className="font-display text-lg font-semibold text-fg">Application received</div>
        <p className="mt-2 text-sm text-haze">We&apos;ll review it and be in touch if there&apos;s a fit.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass grid gap-4 rounded-xl p-6">
      <h3 className="font-display text-base font-semibold text-fg">Apply for this role</h3>
      <label className="grid gap-1.5 text-xs font-medium text-haze">
        Full name
        <input required value={form.name} onChange={set("name")} className="field-glass rounded-lg px-3 py-2.5 text-sm" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-haze">
        Email
        <input required type="email" value={form.email} onChange={set("email")} className="field-glass rounded-lg px-3 py-2.5 text-sm" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-haze">
        Phone
        <input value={form.phone} onChange={set("phone")} className="field-glass rounded-lg px-3 py-2.5 text-sm" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-haze">
        Cover note
        <textarea rows={4} value={form.coverNote} onChange={set("coverNote")} className="field-glass resize-none rounded-lg px-3 py-2.5 text-sm" placeholder="Why you, why this role…" />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button disabled={state === "sending"} className="btn-brand rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {state === "sending" ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
