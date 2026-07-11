"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface Opportunity {
  id: string; title: string; company: string | null; contactName: string | null; contactEmail: string | null;
  stage: string; value: string | number | null; currency: string; probability: number;
  expectedCloseDate: string | null; createdAt: string;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  lead: { id: string; name: string } | null;
  _count: { quotations: number; remarks: number };
}
interface OppList { items: Opportunity[]; pagination: { page: number; totalPages: number; total: number } }
interface UserOption { id: string; firstName: string; lastName: string }

const STAGES = ["qualification", "quotation", "negotiation", "won", "lost"];
const STAGE_STYLE: Record<string, string> = {
  qualification: "bg-cobalt/10 text-cobalt", quotation: "bg-amber-100 text-amber-700",
  negotiation: "bg-cyan-100 text-cyan-700", won: "bg-emerald-100 text-emerald-700", lost: "bg-slate-100 text-slate-500",
};

export default function OpportunitiesPage() {
  const [data, setData] = useState<OppList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", contactName: "", contactEmail: "", contactPhone: "", value: "", probability: "10", expectedCloseDate: "", assignedToId: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) qs.set("search", search);
      if (stage) qs.set("stage", stage);
      setData(await api<OppList>(`/opportunities?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load opportunities");
    }
  }, [page, search, stage]);

  useEffect(() => { load(); }, [load]);

  async function updateStage(id: string, next: string) {
    if (next === "lost") {
      const reason = window.prompt("Reason for marking this opportunity as lost?");
      if (!reason) return;
      await api(`/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: next, lostReason: reason }) });
    } else {
      await api(`/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: next }) });
    }
    load();
  }

  function openCreate() {
    setForm({ title: "", company: "", contactName: "", contactEmail: "", contactPhone: "", value: "", probability: "10", expectedCloseDate: "", assignedToId: "" });
    setFormError("");
    setCreating(true);
    api<{ items: UserOption[] }>("/users?limit=100").then((res) => setUsers(res.items ?? [])).catch(() => setUsers([]));
  }

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    setSaving(true);
    try {
      await api("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          value: form.value ? Number(form.value) : undefined,
          probability: form.probability ? Number(form.probability) : undefined,
          expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : undefined,
          assignedToId: form.assignedToId || undefined,
        }),
      });
      setCreating(false);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create opportunity");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    const res = await fetch(`${API_URL}/opportunities/export`, { credentials: "include", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opportunities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-500">Qualified leads moving through quotation and negotiation toward a won deal.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-cobalt">
            Export CSV
          </button>
          <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
            + Add Opportunity
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search title, company, contact…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        />
        <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Opportunity</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Probability</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Expected Close</th>
              <th className="px-4 py-3">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((o) => (
              <tr key={o.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/opportunities/${o.id}`} className="font-medium text-ink hover:text-cobalt">{o.title}</Link>
                  {o.company && <div className="text-xs text-slate-400">{o.company}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{o.contactName}</div>
                  <div className="text-xs">{o.contactEmail}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{o.value ? `${o.currency} ${Number(o.value).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{o.probability}%</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={o.stage}
                    onChange={(e) => updateStage(o.id, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider outline-none ${STAGE_STYLE[o.stage] ?? "bg-slate-100"}`}
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{o.assignedTo ? `${o.assignedTo.firstName} ${o.assignedTo.lastName}` : "Unassigned"}</td>
              </tr>
            ))}
            {data && !data.items.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                No opportunities yet. Convert a qualified lead to get started.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.pagination.total} opportunities</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setCreating(false)}>
          <form onSubmit={createOpportunity} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Add opportunity</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-ink">✕</button>
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                Title
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" required />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Company
                <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Contact name
                <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Contact email
                <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Contact phone
                <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Value (INR)
                <input type="number" min="0" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Probability (%)
                <input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Expected close date
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              {users.length > 0 && (
                <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                  Assign to
                  <select value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                {saving ? "Saving…" : "Create opportunity"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
