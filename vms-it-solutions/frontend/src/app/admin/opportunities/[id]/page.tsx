"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Remark { id: string; content: string; createdAt: string }
interface QuotationItem { id: string; description: string; quantity: string | number; unitPrice: string | number; amount: string | number }
interface Quotation {
  id: string; quotationNumber: string; status: string; subtotal: string | number; discount: string | number;
  tax: string | number; total: string | number; currency: string; validUntil: string | null; createdAt: string;
  items?: QuotationItem[];
}
interface Opportunity {
  id: string; title: string; company: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  stage: string; value: string | number | null; currency: string; probability: number; expectedCloseDate: string | null;
  lostReason: string | null; wonAt: string | null; createdAt: string;
  lead: { id: string; name: string; email: string | null; phone: string | null } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  assignedToId: string | null;
  remarks: Remark[];
  quotations: Quotation[];
  customer: { id: string; companyName: string } | null;
}
interface TimelineEntry { id: string; action: string; detail: unknown; createdAt: string; user: { firstName: string; lastName: string } | null }
interface UserOption { id: string; firstName: string; lastName: string }

const STAGES = ["qualification", "quotation", "negotiation", "won", "lost"];
const STAGE_STYLE: Record<string, string> = {
  qualification: "bg-cobalt/10 text-cobalt", quotation: "bg-amber-100 text-amber-700",
  negotiation: "bg-cyan-100 text-cyan-700", won: "bg-emerald-100 text-emerald-700", lost: "bg-slate-100 text-slate-500",
};
const QUOTE_STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500", sent: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", expired: "bg-slate-100 text-slate-400",
};
const TABS = ["overview", "quotations", "notes", "timeline"] as const;
type Tab = (typeof TABS)[number];

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [editForm, setEditForm] = useState({ value: "", probability: "", expectedCloseDate: "", assignedToId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ items: [{ description: "", quantity: "1", unitPrice: "" }], discount: "0", tax: "0", validUntil: "" });
  const [quoteError, setQuoteError] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Opportunity>(`/opportunities/${id}`);
      setOpp(data);
      setEditForm({
        value: data.value ? String(data.value) : "",
        probability: String(data.probability),
        expectedCloseDate: data.expectedCloseDate ? data.expectedCloseDate.slice(0, 10) : "",
        assignedToId: data.assignedTo?.id ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load opportunity");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<{ items: UserOption[] }>("/users?limit=100").then((r) => setUsers(r.items ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    if (tab === "timeline" && !timeline) {
      api<TimelineEntry[]>(`/opportunities/${id}/timeline`).then(setTimeline).catch(() => setTimeline([]));
    }
  }, [tab, timeline, id]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api(`/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          value: editForm.value ? Number(editForm.value) : null,
          probability: editForm.probability ? Number(editForm.probability) : undefined,
          expectedCloseDate: editForm.expectedCloseDate ? new Date(editForm.expectedCloseDate).toISOString() : null,
          assignedToId: editForm.assignedToId || null,
        }),
      });
      load();
    } finally {
      setSavingEdit(false);
    }
  }

  async function changeStage(next: string) {
    if (next === "lost") {
      const reason = window.prompt("Reason for marking this opportunity as lost?");
      if (!reason) return;
      await api(`/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: next, lostReason: reason }) });
    } else {
      await api(`/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: next }) });
    }
    load();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api(`/opportunities/${id}/remarks`, { method: "POST", body: JSON.stringify({ content: noteText }) });
      setNoteText("");
      load();
    } finally {
      setSavingNote(false);
    }
  }

  async function createQuotation(e: React.FormEvent) {
    e.preventDefault();
    setQuoteError("");
    const items = quoteForm.items.filter((i) => i.description.trim() && i.unitPrice);
    if (!items.length) { setQuoteError("Add at least one line item"); return; }
    setSavingQuote(true);
    try {
      await api("/quotations", {
        method: "POST",
        body: JSON.stringify({
          opportunityId: id,
          items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) })),
          discount: Number(quoteForm.discount) || 0,
          tax: Number(quoteForm.tax) || 0,
          validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : undefined,
        }),
      });
      setQuoting(false);
      setQuoteForm({ items: [{ description: "", quantity: "1", unitPrice: "" }], discount: "0", tax: "0", validUntil: "" });
      load();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Could not create quotation");
    } finally {
      setSavingQuote(false);
    }
  }

  async function setQuoteStatus(quotationId: string, status: string) {
    await api(`/quotations/${quotationId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function convertToCustomer() {
    setConverting(true);
    try {
      const customer = await api<{ id: string }>(`/opportunities/${id}/convert-to-customer`, { method: "POST" });
      router.push(`/admin/customers/${customer.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert to customer");
    } finally {
      setConverting(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!opp) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/opportunities" className="text-xs font-medium text-slate-400 hover:text-cobalt">← Opportunities</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{opp.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider ${STAGE_STYLE[opp.stage] ?? "bg-slate-100"}`}>{opp.stage}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{[opp.company, opp.contactName, opp.contactEmail].filter(Boolean).join(" · ")}</p>
          {opp.lead && <p className="mt-0.5 text-xs text-slate-400">From lead: {opp.lead.name}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={opp.stage} onChange={(e) => changeStage(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {opp.customer ? (
            <Link href={`/admin/customers/${opp.customer.id}`} className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              View customer →
            </Link>
          ) : (
            <button onClick={convertToCustomer} disabled={converting} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
              {converting ? "Converting…" : "Convert to Customer"}
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition ${tab === t ? "border-b-2 border-cobalt text-cobalt" : "text-slate-500 hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <form onSubmit={saveEdit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Value ({opp.currency})
            <input type="number" min="0" value={editForm.value} onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Probability (%)
            <input type="number" min="0" max="100" value={editForm.probability} onChange={(e) => setEditForm((f) => ({ ...f, probability: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Expected close date
            <input type="date" value={editForm.expectedCloseDate} onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Assigned to
            <select value={editForm.assignedToId} onChange={(e) => setEditForm((f) => ({ ...f, assignedToId: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt">
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </label>
          {opp.lostReason && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">Lost reason: {opp.lostReason}</div>
          )}
          <div className="sm:col-span-2">
            <button disabled={savingEdit} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {tab === "quotations" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setQuoting(true)} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
              + New Quotation
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opp.quotations.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-3 font-medium text-ink">{q.quotationNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider ${QUOTE_STATUS_STYLE[q.status] ?? "bg-slate-100"}`}>{q.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{q.currency} {Number(q.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {q.status === "draft" && <button onClick={() => setQuoteStatus(q.id, "sent")} className="text-xs font-medium text-cobalt hover:underline">Mark Sent</button>}
                        {q.status === "sent" && (
                          <>
                            <button onClick={() => setQuoteStatus(q.id, "accepted")} className="text-xs font-medium text-emerald-600 hover:underline">Accept</button>
                            <button onClick={() => setQuoteStatus(q.id, "rejected")} className="text-xs font-medium text-red-600 hover:underline">Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!opp.quotations.length && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No quotations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          <form onSubmit={addNote} className="rounded-xl border border-slate-200 bg-white p-4">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
            />
            <div className="mt-2 flex justify-end">
              <button disabled={savingNote} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                {savingNote ? "Saving…" : "Add note"}
              </button>
            </div>
          </form>
          <div className="space-y-3">
            {opp.remarks.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p>{r.content}</p>
                <p className="mt-2 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!opp.remarks.length && <p className="text-sm text-slate-400">No notes yet.</p>}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-3">
          {(timeline ?? []).map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-cobalt" />
              <div>
                <p className="text-ink">
                  <span className="font-medium">{t.user ? `${t.user.firstName} ${t.user.lastName}` : "System"}</span>{" "}
                  {t.action.replace(/_/g, " ")}
                </p>
                <p className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {timeline && !timeline.length && <p className="text-sm text-slate-400">No activity recorded yet.</p>}
        </div>
      )}

      {quoting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => setQuoting(false)}>
          <form onSubmit={createQuotation} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">New quotation</h2>
              <button type="button" onClick={() => setQuoting(false)} className="text-slate-400 hover:text-ink">✕</button>
            </div>
            {quoteError && <p className="mt-3 text-sm text-red-600">{quoteError}</p>}
            <div className="mt-4 space-y-2">
              {quoteForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_120px_28px] gap-2">
                  <input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, description: e.target.value } : it) }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cobalt"
                  />
                  <input
                    type="number" min="1" placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it) }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cobalt"
                  />
                  <input
                    type="number" min="0" placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, unitPrice: e.target.value } : it) }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cobalt"
                  />
                  <button
                    type="button"
                    onClick={() => setQuoteForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="text-slate-400 hover:text-red-600"
                  >✕</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setQuoteForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: "1", unitPrice: "" }] }))}
                className="text-xs font-medium text-cobalt hover:underline"
              >
                + Add line item
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Discount
                <input type="number" min="0" value={quoteForm.discount} onChange={(e) => setQuoteForm((f) => ({ ...f, discount: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Tax
                <input type="number" min="0" value={quoteForm.tax} onChange={(e) => setQuoteForm((f) => ({ ...f, tax: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Valid until
                <input type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm((f) => ({ ...f, validUntil: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setQuoting(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={savingQuote} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                {savingQuote ? "Saving…" : "Create quotation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
