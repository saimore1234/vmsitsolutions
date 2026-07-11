"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface CrmProject { id: string; title: string; status: string; budget: string | number | null; currency: string; startDate: string | null; endDate: string | null }
interface SupportTicket { id: string; subject: string; priority: string; status: string; createdAt: string }
interface AmcContract { id: string; contractNumber: string; startDate: string; endDate: string; status: string; value: string | number | null; currency: string }
interface Customer {
  id: string; companyName: string; contactName: string | null; email: string | null; phone: string | null;
  billingAddress: string | null; shippingAddress: string | null; gstNumber: string | null; panNumber: string | null;
  status: string; convertedAt: string;
  opportunity: { id: string; title: string; stage: string } | null;
  accountManager: { id: string; firstName: string; lastName: string } | null;
  crmProjects: CrmProject[]; supportTickets: SupportTicket[]; amcContracts: AmcContract[];
}
interface Dashboard { projects: Record<string, number>; supportTickets: Record<string, number>; amcContracts: Record<string, number>; wonQuotationValue: number }
interface TimelineEntry { id: string; action: string; createdAt: string; user: { firstName: string; lastName: string } | null }

const TABS = ["overview", "projects", "support", "amc", "timeline"] as const;
type Tab = (typeof TABS)[number];

const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"];
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"];
const AMC_STATUSES = ["active", "expired", "cancelled", "renewed"];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);

  const [addingProject, setAddingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", budget: "" });
  const [addingTicket, setAddingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", priority: "medium" });
  const [addingAmc, setAddingAmc] = useState(false);
  const [amcForm, setAmcForm] = useState({ contractNumber: "", startDate: "", endDate: "", value: "" });

  const load = useCallback(async () => {
    try {
      setCustomer(await api<Customer>(`/customers/${id}`));
      setDashboard(await api<Dashboard>(`/customers/${id}/dashboard`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customer");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === "timeline" && !timeline) {
      api<TimelineEntry[]>(`/customers/${id}/timeline`).then(setTimeline).catch(() => setTimeline([]));
    }
  }, [tab, timeline, id]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectForm.title.trim()) return;
    await api("/crm-projects", { method: "POST", body: JSON.stringify({ customerId: id, title: projectForm.title, budget: projectForm.budget ? Number(projectForm.budget) : undefined }) });
    setAddingProject(false);
    setProjectForm({ title: "", budget: "" });
    load();
  }
  async function updateProjectStatus(projectId: string, status: string) {
    await api(`/crm-projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketForm.subject.trim()) return;
    await api("/support-tickets", { method: "POST", body: JSON.stringify({ customerId: id, subject: ticketForm.subject, priority: ticketForm.priority }) });
    setAddingTicket(false);
    setTicketForm({ subject: "", priority: "medium" });
    load();
  }
  async function updateTicketStatus(ticketId: string, status: string) {
    await api(`/support-tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function createAmc(e: React.FormEvent) {
    e.preventDefault();
    if (!amcForm.contractNumber.trim() || !amcForm.startDate || !amcForm.endDate) return;
    await api("/amc-contracts", {
      method: "POST",
      body: JSON.stringify({
        customerId: id, contractNumber: amcForm.contractNumber,
        startDate: new Date(amcForm.startDate).toISOString(), endDate: new Date(amcForm.endDate).toISOString(),
        value: amcForm.value ? Number(amcForm.value) : undefined,
      }),
    });
    setAddingAmc(false);
    setAmcForm({ contractNumber: "", startDate: "", endDate: "", value: "" });
    load();
  }
  async function updateAmcStatus(amcId: string, status: string) {
    await api(`/amc-contracts/${amcId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!customer) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-xs font-medium text-slate-400 hover:text-cobalt">← Customers</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{customer.companyName}</h1>
          <p className="mt-1 text-sm text-slate-500">{[customer.contactName, customer.email, customer.phone].filter(Boolean).join(" · ")}</p>
          {customer.opportunity && (
            <Link href={`/admin/opportunities/${customer.opportunity.id}`} className="mt-0.5 inline-block text-xs text-slate-400 hover:text-cobalt">
              From opportunity: {customer.opportunity.title}
            </Link>
          )}
        </div>
        {customer.accountManager && (
          <div className="text-xs text-slate-400">Account manager: {customer.accountManager.firstName} {customer.accountManager.lastName}</div>
        )}
      </header>

      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Won Value</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">₹{dashboard.wonQuotationValue.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Projects</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">{Object.values(dashboard.projects).reduce((a, b) => a + b, 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Open Tickets</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">{dashboard.supportTickets.open ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Active AMC</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">{dashboard.amcContracts.active ?? 0}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize transition ${tab === t ? "border-b-2 border-cobalt text-cobalt" : "text-slate-500 hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <div><p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">GST Number</p><p className="mt-1 text-sm text-ink">{customer.gstNumber || "—"}</p></div>
          <div><p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">PAN Number</p><p className="mt-1 text-sm text-ink">{customer.panNumber || "—"}</p></div>
          <div><p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Billing Address</p><p className="mt-1 text-sm text-ink">{customer.billingAddress || "—"}</p></div>
          <div><p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Shipping Address</p><p className="mt-1 text-sm text-ink">{customer.shippingAddress || "—"}</p></div>
          <div><p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Customer Since</p><p className="mt-1 text-sm text-ink">{new Date(customer.convertedAt).toLocaleDateString()}</p></div>
        </div>
      )}

      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setAddingProject(true)} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">+ New Project</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3">Project</th><th className="px-4 py-3">Budget</th><th className="px-4 py-3">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customer.crmProjects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-ink">{p.title}</td>
                    <td className="px-4 py-3 text-slate-500">{p.budget ? `${p.currency} ${Number(p.budget).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">
                      <select value={p.status} onChange={(e) => updateProjectStatus(p.id, e.target.value)} className="rounded-full border-0 bg-slate-100 px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider text-slate-600 outline-none">
                        {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!customer.crmProjects.length && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">No projects yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "support" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setAddingTicket(true)} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">+ New Ticket</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3">Subject</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Opened</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customer.supportTickets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-ink">{t.subject}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{t.priority}</td>
                    <td className="px-4 py-3">
                      <select value={t.status} onChange={(e) => updateTicketStatus(t.id, e.target.value)} className="rounded-full border-0 bg-slate-100 px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider text-slate-600 outline-none">
                        {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!customer.supportTickets.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">No support tickets yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "amc" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setAddingAmc(true)} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">+ New Contract</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3">Contract</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customer.amcContracts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-ink">{a.contractNumber}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-500">{a.value ? `${a.currency} ${Number(a.value).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">
                      <select value={a.status} onChange={(e) => updateAmcStatus(a.id, e.target.value)} className="rounded-full border-0 bg-slate-100 px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider text-slate-600 outline-none">
                        {AMC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!customer.amcContracts.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">No AMC contracts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-3">
          {(timeline ?? []).map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-cobalt" />
              <div>
                <p className="text-ink"><span className="font-medium">{t.user ? `${t.user.firstName} ${t.user.lastName}` : "System"}</span> {t.action.replace(/_/g, " ")}</p>
                <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {timeline && !timeline.length && <p className="text-sm text-slate-400">No activity recorded yet.</p>}
        </div>
      )}

      {addingProject && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setAddingProject(false)}>
          <form onSubmit={createProject} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">New project</h2>
            <div className="mt-4 space-y-3">
              <input placeholder="Title" value={projectForm.title} onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" required />
              <input type="number" min="0" placeholder="Budget" value={projectForm.budget} onChange={(e) => setProjectForm((f) => ({ ...f, budget: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAddingProject(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white hover:bg-cobalt-soft">Create</button>
            </div>
          </form>
        </div>
      )}

      {addingTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setAddingTicket(false)}>
          <form onSubmit={createTicket} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">New support ticket</h2>
            <div className="mt-4 space-y-3">
              <input placeholder="Subject" value={ticketForm.subject} onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" required />
              <select value={ticketForm.priority} onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cobalt">
                {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAddingTicket(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white hover:bg-cobalt-soft">Create</button>
            </div>
          </form>
        </div>
      )}

      {addingAmc && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setAddingAmc(false)}>
          <form onSubmit={createAmc} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">New AMC contract</h2>
            <div className="mt-4 space-y-3">
              <input placeholder="Contract number" value={amcForm.contractNumber} onChange={(e) => setAmcForm((f) => ({ ...f, contractNumber: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" required />
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Start
                  <input type="date" value={amcForm.startDate} onChange={(e) => setAmcForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" required />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  End
                  <input type="date" value={amcForm.endDate} onChange={(e) => setAmcForm((f) => ({ ...f, endDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" required />
                </label>
              </div>
              <input type="number" min="0" placeholder="Value" value={amcForm.value} onChange={(e) => setAmcForm((f) => ({ ...f, value: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAddingAmc(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white hover:bg-cobalt-soft">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
