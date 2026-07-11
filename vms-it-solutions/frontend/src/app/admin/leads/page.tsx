"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface Lead {
  id: string; name: string; email: string | null; phone: string | null; company: string | null;
  message: string | null; kind: string; source: string; status: string; createdAt: string;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}
interface LeadList { items: Lead[]; pagination: { page: number; totalPages: number; total: number } }
interface UserOption { id: string; firstName: string; lastName: string }

const KINDS = ["contact", "demo", "quote", "general"];
const STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const STATUS_STYLE: Record<string, string> = {
  new: "bg-cobalt/10 text-cobalt", contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-cyan-100 text-cyan-700", proposal: "bg-violet-100 text-violet-700",
  won: "bg-emerald-100 text-emerald-700", lost: "bg-slate-100 text-slate-500",
};

export default function LeadsPage() {
  const router = useRouter();
  const [data, setData] = useState<LeadList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", kind: "general", status: "new", assignedToId: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [merging, setMerging] = useState<Lead | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) qs.set("search", search);
      if (status) qs.set("status", status);
      setData(await api<LeadList>(`/leads?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads");
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, next: string) {
    await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    load();
  }

  async function convertToOpportunity(lead: Lead) {
    setConverting(true);
    setConvertError("");
    try {
      const opp = await api<{ id: string }>(`/leads/${lead.id}/convert-to-opportunity`, { method: "POST" });
      router.push(`/admin/opportunities/${opp.id}`);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "Could not convert to opportunity");
    } finally {
      setConverting(false);
    }
  }

  async function convertToCustomer(lead: Lead) {
    setConverting(true);
    setConvertError("");
    try {
      const customer = await api<{ id: string }>(`/leads/${lead.id}/convert-to-customer`, { method: "POST" });
      router.push(`/admin/customers/${customer.id}`);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "Could not convert to customer");
    } finally {
      setConverting(false);
    }
  }

  async function duplicateLead(lead: Lead) {
    await api(`/leads/${lead.id}/duplicate`, { method: "POST" });
    setOpen(null);
    setPage(1);
    load();
  }

  async function mergeLead() {
    if (!merging || !mergeTargetId) return;
    await api(`/leads/${merging.id}/merge`, { method: "POST", body: JSON.stringify({ mergeLeadId: mergeTargetId }) });
    setMerging(null);
    setMergeTargetId("");
    setOpen(null);
    load();
  }

  function openCreate() {
    setForm({ name: "", email: "", phone: "", company: "", message: "", kind: "general", status: "new", assignedToId: "" });
    setFormError("");
    setCreating(true);
    api<{ items: UserOption[] }>("/users?limit=100").then((res) => setUsers(res.items ?? [])).catch(() => setUsers([]));
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    if (!form.email.trim() && !form.phone.trim()) { setFormError("Provide an email or phone number"); return; }
    setSaving(true);
    try {
      await api("/leads/manual", {
        method: "POST",
        body: JSON.stringify({ ...form, assignedToId: form.assignedToId || undefined }),
      });
      setCreating(false);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create lead");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    const res = await fetch(`${API_URL}/leads/export`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">Every enquiry from the website — contact, demo and quote forms.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-cobalt">
            Export CSV
          </button>
          <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
            + Add Lead
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, email, company…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((l) => (
              <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => setOpen(l)}>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{l.name}</div>
                  {l.company && <div className="text-xs text-slate-400">{l.company}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{l.email}</div>
                  <div className="text-xs">{l.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">{l.kind}</span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={l.status}
                    onChange={(e) => updateStatus(l.id, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider outline-none ${STATUS_STYLE[l.status] ?? "bg-slate-100"}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data && !data.items.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                No leads match. New website enquiries land here automatically.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.pagination.total} leads</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setOpen(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{open.name}</h2>
                <p className="text-sm text-slate-500">{[open.company, open.email, open.phone].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-ink">✕</button>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              {open.message || "No message left."}
            </div>
            <div className="mt-4 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              {open.kind} · via {open.source} · {new Date(open.createdAt).toLocaleString()}
            </div>
            {convertError && <p className="mt-3 text-sm text-red-600">{convertError}</p>}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button disabled={converting} onClick={() => convertToOpportunity(open)} className="rounded-lg bg-cobalt px-3 py-2 text-xs font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                Create Opportunity
              </button>
              <button disabled={converting} onClick={() => convertToCustomer(open)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition disabled:opacity-60">
                Create Customer
              </button>
              <button onClick={() => duplicateLead(open)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-ink transition hover:border-cobalt">
                Duplicate
              </button>
              <button onClick={() => { setMerging(open); setMergeTargetId(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-ink transition hover:border-cobalt">
                Merge into another lead
              </button>
            </div>
          </div>
        </div>
      )}

      {merging && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setMerging(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold text-ink">Merge &quot;{merging.name}&quot;</h2>
            <p className="mt-1 text-sm text-slate-500">Paste the ID of the lead to merge into this one. Its remarks move here and it is deleted.</p>
            <input
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              placeholder="Lead ID to merge in"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setMerging(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={!mergeTargetId} onClick={mergeLead} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setCreating(false)}>
          <form
            onSubmit={createLead}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Add lead</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-ink">✕</button>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Company
                <input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Type
                <select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                >
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {users.length > 0 && (
                <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                  Assign to
                  <select
                    value={form.assignedToId}
                    onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </label>
              )}
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                Message
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">
                Cancel
              </button>
              <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                {saving ? "Saving…" : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
