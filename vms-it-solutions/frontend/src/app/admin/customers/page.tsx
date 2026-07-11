"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface Customer {
  id: string; companyName: string; contactName: string | null; email: string | null; phone: string | null;
  status: string; convertedAt: string;
  accountManager: { id: string; firstName: string; lastName: string } | null;
  _count: { crmProjects: number; supportTickets: number; amcContracts: number };
}
interface CustomerList { items: Customer[]; pagination: { page: number; totalPages: number; total: number } }
interface UserOption { id: string; firstName: string; lastName: string }

const STATUSES = ["active", "inactive", "churned"];
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700", inactive: "bg-slate-100 text-slate-500", churned: "bg-red-100 text-red-700",
};

export default function CustomersPage() {
  const [data, setData] = useState<CustomerList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", phone: "", gstNumber: "", accountManagerId: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) qs.set("search", search);
      if (status) qs.set("status", status);
      setData(await api<CustomerList>(`/customers?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customers");
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ companyName: "", contactName: "", email: "", phone: "", gstNumber: "", accountManagerId: "" });
    setFormError("");
    setCreating(true);
    api<{ items: UserOption[] }>("/users?limit=100").then((res) => setUsers(res.items ?? [])).catch(() => setUsers([]));
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.companyName.trim()) { setFormError("Company name is required"); return; }
    setSaving(true);
    try {
      await api("/customers", { method: "POST", body: JSON.stringify({ ...form, accountManagerId: form.accountManagerId || undefined }) });
      setCreating(false);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create customer");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    const res = await fetch(`${API_URL}/customers/export`, { credentials: "include", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">Won opportunities and directly onboarded accounts — projects, support and AMC live here.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-cobalt">
            Export CSV
          </button>
          <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
            + Add Customer
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search company, contact, email…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Support</th>
              <th className="px-4 py-3">AMC</th>
              <th className="px-4 py-3">Account Manager</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-ink hover:text-cobalt">{c.companyName}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{c.contactName}</div>
                  <div className="text-xs">{c.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider ${STATUS_STYLE[c.status] ?? "bg-slate-100"}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{c._count.crmProjects}</td>
                <td className="px-4 py-3 text-slate-500">{c._count.supportTickets}</td>
                <td className="px-4 py-3 text-slate-500">{c._count.amcContracts}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{c.accountManager ? `${c.accountManager.firstName} ${c.accountManager.lastName}` : "Unassigned"}</td>
              </tr>
            ))}
            {data && !data.items.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                No customers yet. Convert a won opportunity or add one manually.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.pagination.total} customers</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setCreating(false)}>
          <form onSubmit={createCustomer} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Add customer</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-ink">✕</button>
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                Company name
                <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" required />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Contact name
                <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Email
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Phone
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                GST number
                <input value={form.gstNumber} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              {users.length > 0 && (
                <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">
                  Account manager
                  <select value={form.accountManagerId} onChange={(e) => setForm((f) => ({ ...f, accountManagerId: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                {saving ? "Saving…" : "Create customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
