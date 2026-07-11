"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Popup {
  id: string;
  name: string;
  type: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  trigger: string;
  delaySeconds: number;
  scrollPercent: number;
  frequency: string;
  pageRules: string[] | null;
  deviceRules: string[] | null;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  views: number;
  dismissals: number;
  conversions: number;
  createdAt: string;
}
interface PopupList { items: Popup[]; pagination: { page: number; totalPages: number; total: number } }

const TYPES = ["announcement", "newsletter", "offer", "discount", "exit_intent", "lead_capture", "cookie_consent", "download_brochure", "book_demo", "whatsapp", "schedule"];
const TRIGGERS = ["immediate", "delay", "scroll", "exit_intent"];
const FREQUENCIES = ["always", "session", "day", "once"];
const DEVICES = ["desktop", "tablet", "mobile"];

const TYPE_LABEL: Record<string, string> = {
  announcement: "Announcement", newsletter: "Newsletter", offer: "Offer", discount: "Discount",
  exit_intent: "Exit intent", lead_capture: "Lead capture", cookie_consent: "Cookie consent",
  download_brochure: "Download brochure", book_demo: "Book demo", whatsapp: "WhatsApp", schedule: "Scheduled",
};

type FormState = {
  name: string; type: string; title: string; content: string; imageUrl: string; ctaText: string; ctaUrl: string;
  isActive: boolean; trigger: string; delaySeconds: number; scrollPercent: number; frequency: string;
  pageRules: string; deviceRules: string[]; priority: number; startAt: string; endAt: string;
};

const EMPTY_FORM: FormState = {
  name: "", type: "announcement", title: "", content: "", imageUrl: "", ctaText: "", ctaUrl: "",
  isActive: true, trigger: "delay", delaySeconds: 5, scrollPercent: 50, frequency: "session",
  pageRules: "", deviceRules: [], priority: 0, startAt: "", endAt: "",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function popupToForm(p: Popup): FormState {
  return {
    name: p.name, type: p.type, title: p.title ?? "", content: p.content ?? "", imageUrl: p.imageUrl ?? "",
    ctaText: p.ctaText ?? "", ctaUrl: p.ctaUrl ?? "", isActive: p.isActive, trigger: p.trigger,
    delaySeconds: p.delaySeconds, scrollPercent: p.scrollPercent, frequency: p.frequency,
    pageRules: (p.pageRules ?? []).join(", "), deviceRules: p.deviceRules ?? [], priority: p.priority,
    startAt: toLocalInput(p.startAt), endAt: toLocalInput(p.endAt),
  };
}

export default function PopupsPage() {
  const [data, setData] = useState<PopupList | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Popup | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<PopupList>(`/popups?page=${page}&limit=15&sortBy=priority&sortDir=desc`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load popups");
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditing("new");
  }

  function openEdit(p: Popup) {
    setForm(popupToForm(p));
    setFormError("");
    setEditing(p);
  }

  async function toggleActive(p: Popup) {
    await api(`/popups/${p.id}`, { method: "PATCH", body: JSON.stringify({ ...stripReadonly(p), isActive: !p.isActive }) });
    load();
  }

  function stripReadonly(p: Popup) {
    const { id: _id, views: _v, dismissals: _d, conversions: _c, createdAt: _ca, ...rest } = p;
    return rest;
  }

  async function remove(id: string) {
    if (!confirm("Delete this popup permanently?")) return;
    await api(`/popups/${id}`, { method: "DELETE" });
    load();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name, type: form.type, title: form.title || null, content: form.content || null,
        imageUrl: form.imageUrl || null, ctaText: form.ctaText || null, ctaUrl: form.ctaUrl || null,
        isActive: form.isActive, trigger: form.trigger, delaySeconds: form.delaySeconds,
        scrollPercent: form.scrollPercent, frequency: form.frequency,
        pageRules: form.pageRules.split(",").map((s) => s.trim()).filter(Boolean),
        deviceRules: form.deviceRules, priority: form.priority,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      };
      if (editing === "new") {
        await api("/popups", { method: "POST", body: JSON.stringify(body) });
      } else if (editing) {
        await api(`/popups/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      setEditing(null);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save popup");
    } finally {
      setSaving(false);
    }
  }

  function toggleDevice(d: string) {
    setForm((f) => ({
      ...f,
      deviceRules: f.deviceRules.includes(d) ? f.deviceRules.filter((x) => x !== d) : [...f.deviceRules, d],
    }));
  }

  const bind = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Popup Builder</h1>
          <p className="mt-1 text-sm text-slate-500">Announcements, offers, exit-intent capture and lead forms shown on the public site.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
          + Add Popup
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Popup</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Views / Conv.</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="cursor-pointer font-medium text-ink hover:text-cobalt" onClick={() => openEdit(p)}>{p.name}</div>
                  {p.title && <div className="text-xs text-slate-400">{p.title}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">{TYPE_LABEL[p.type] ?? p.type}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {p.trigger}{p.trigger === "delay" ? ` · ${p.delaySeconds}s` : p.trigger === "scroll" ? ` · ${p.scrollPercent}%` : ""}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`rounded-full px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.views} / {p.conversions}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.priority}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(p.id)} className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {data && !data.items.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                No popups yet. Create one to start capturing leads and announcements on the website.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.pagination.total} popups</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-5" onClick={() => setEditing(null)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="modal-panel grid max-h-[90vh] w-full max-w-4xl grid-cols-1 gap-0 overflow-hidden rounded-2xl bg-white lg:grid-cols-[1.3fr_1fr]"
          >
            <div className="max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">{editing === "new" ? "Add popup" : "Edit popup"}</h2>
                <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-ink">✕</button>
              </div>

              {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

              <section className="mt-4 space-y-4">
                <h3 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Content</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Internal name
                    <input {...bind("name")} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Type
                    <select {...bind("type")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                      {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                    Headline
                    <input {...bind("title")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                    Body text
                    <textarea rows={3} {...bind("content")} className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                    Image URL
                    <input {...bind("imageUrl")} placeholder="https://…" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Button text
                    <input {...bind("ctaText")} placeholder="Get started" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Button link
                    <input {...bind("ctaUrl")} placeholder="/contact or https://wa.me/…" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                </div>
              </section>

              <section className="mt-6 space-y-4">
                <h3 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Behaviour</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Trigger
                    <select {...bind("trigger")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                      {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Frequency cap
                    <select {...bind("frequency")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                      {FREQUENCIES.map((f) => <option key={f} value={f}>{f === "always" ? "Every page load" : f === "session" ? "Once per session" : f === "day" ? "Once per day" : "Once ever"}</option>)}
                    </select>
                  </label>
                  {form.trigger === "delay" && (
                    <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                      Delay (seconds)
                      <input type="number" min={0} max={600} value={form.delaySeconds}
                        onChange={(e) => setForm((f) => ({ ...f, delaySeconds: Number(e.target.value) }))}
                        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                    </label>
                  )}
                  {form.trigger === "scroll" && (
                    <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                      Scroll depth (%)
                      <input type="number" min={0} max={100} value={form.scrollPercent}
                        onChange={(e) => setForm((f) => ({ ...f, scrollPercent: Number(e.target.value) }))}
                        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                    </label>
                  )}
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Priority (higher shows first)
                    <input type="number" min={0} max={100} value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                    Active
                  </label>
                </div>
              </section>

              <section className="mt-6 space-y-4">
                <h3 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Targeting</h3>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Pages (comma-separated paths; use a trailing * for prefix match, leave empty for all pages)
                  <input {...bind("pageRules")} placeholder="/, /services*" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                </label>
                <div className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Devices (none selected = all devices)
                  <div className="flex gap-4">
                    {DEVICES.map((d) => (
                      <label key={d} className="flex items-center gap-1.5 font-normal capitalize">
                        <input type="checkbox" checked={form.deviceRules.includes(d)} onChange={() => toggleDevice(d)} />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Starts
                    <input type="datetime-local" {...bind("startAt")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                    Ends
                    <input type="datetime-local" {...bind("endAt")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
                  </label>
                </div>
              </section>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">
                  Cancel
                </button>
                <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                  {saving ? "Saving…" : editing === "new" ? "Create popup" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="hidden flex-col items-center justify-center bg-slate-100 p-8 lg:flex">
              <p className="mb-4 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Live preview</p>
              <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <h4 className="font-display text-base font-semibold text-ink">{form.title || "Your headline here"}</h4>
                <p className="mt-2 text-sm text-slate-500">{form.content || "Popup body copy appears here."}</p>
                {form.ctaText && (
                  <button type="button" className="mt-4 w-full rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white">
                    {form.ctaText}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
