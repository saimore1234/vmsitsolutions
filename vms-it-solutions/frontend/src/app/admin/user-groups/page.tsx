"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Group { id: string; name: string; description: string | null; _count: { members: number } }

export default function UserGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setGroups(await api<Group[]>("/user-groups")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load groups"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name: "", description: "" }); setCreating(true); }
  function openEdit(g: Group) { setForm({ name: g.name, description: g.description ?? "" }); setEditing(g); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api(`/user-groups/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      else await api("/user-groups", { method: "POST", body: JSON.stringify(form) });
      setCreating(false); setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this group? Members will be unassigned.")) return;
    await api(`/user-groups/${id}`, { method: "DELETE" });
    load();
  }

  const open = creating || !!editing;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">User Groups</h1>
          <p className="mt-1 text-sm text-slate-500">Organise employees for bulk assignment — sales team, HR, finance, custom groups.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">+ Add group</button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-base font-semibold text-ink">{g.name}</div>
                {g.description && <p className="mt-1 text-sm text-slate-500">{g.description}</p>}
              </div>
              <Link href={`/admin/users?groupId=${g.id}`} className="rounded-full bg-cobalt/10 px-2.5 py-1 text-xs font-medium text-cobalt">
                {g._count.members} member{g._count.members === 1 ? "" : "s"}
              </Link>
            </div>
            <div className="mt-4 flex gap-3 text-xs">
              <button onClick={() => openEdit(g)} className="font-medium text-cobalt hover:text-cobalt-soft">Edit</button>
              <button onClick={() => remove(g.id)} className="text-slate-500 hover:text-red-600">Delete</button>
            </div>
          </div>
        ))}
        {!groups.length && <p className="text-sm text-slate-400">No groups yet.</p>}
      </div>

      {open && (
        <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5" onClick={() => { setCreating(false); setEditing(null); }}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="modal-panel w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">{editing ? "Edit group" : "Add group"}</h2>
            <label className="mt-4 grid gap-1.5 text-xs font-medium text-slate-600">
              Name
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
            </label>
            <label className="mt-3 grid gap-1.5 text-xs font-medium text-slate-600">
              Description
              <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
