"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Permission { id: string; resource: string; action: string }
interface Role {
  id: string; name: string; description: string | null; isSystem: boolean;
  permissions: { permission: Permission }[];
  _count: { users: number };
}

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "import", "print", "manage"];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api<Role[]>("/roles"), api<Permission[]>("/roles/permissions")]);
      setRoles(r);
      setPermissions(p);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load roles"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resources = [...new Set(permissions.map((p) => p.resource))].sort();
  const permId = (resource: string, action: string) => permissions.find((p) => p.resource === resource && p.action === action)?.id;

  function openCreate() {
    setName(""); setDescription(""); setSelectedPerms(new Set()); setFormError(""); setEditing("new");
  }
  function openEdit(role: Role) {
    setName(role.name); setDescription(role.description ?? "");
    setSelectedPerms(new Set(role.permissions.map((rp) => rp.permission.id)));
    setFormError(""); setEditing(role);
  }

  function toggle(id: string | undefined) {
    if (!id) return;
    setSelectedPerms((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleRow(resource: string) {
    const ids = ACTIONS.map((a) => permId(resource, a)).filter(Boolean) as string[];
    const allOn = ids.every((id) => selectedPerms.has(id));
    setSelectedPerms((s) => {
      const next = new Set(s);
      ids.forEach((id) => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = { name, description: description || undefined, permissionIds: [...selectedPerms] };
      if (editing === "new") await api("/roles", { method: "POST", body: JSON.stringify(body) });
      else if (editing) await api(`/roles/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save role");
    } finally { setSaving(false); }
  }

  async function remove(role: Role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try { await api(`/roles/${role.id}`, { method: "DELETE" }); load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Could not delete role"); }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-slate-500">Built-in and custom roles with a granular resource × action permission matrix.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">+ Add role</button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roles.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="cursor-pointer font-medium text-ink hover:text-cobalt" onClick={() => openEdit(r)}>{r.name}</div>
                  {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
                  {r.isSystem && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">System</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{r._count.users}</td>
                <td className="px-4 py-3 text-slate-500">{r.name === "Super Admin" ? "All (bypass)" : `${r.permissions.length} grants`}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r)} disabled={r.isSystem || r._count.users > 0} className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-30">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-5" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">{editing === "new" ? "Add role" : "Edit role"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-ink">✕</button>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required disabled={editing !== "new" && editing.isSystem}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt disabled:bg-slate-50" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 font-mono-x uppercase tracking-widest text-slate-400">
                    <th className="px-3 py-2">Resource</th>
                    {ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center">{a}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resources.map((resource) => (
                    <tr key={resource}>
                      <td className="cursor-pointer px-3 py-2 font-medium text-ink hover:text-cobalt" onClick={() => toggleRow(resource)}>{resource}</td>
                      {ACTIONS.map((action) => {
                        const id = permId(resource, action);
                        return (
                          <td key={action} className="px-2 py-2 text-center">
                            {id && <input type="checkbox" checked={selectedPerms.has(id)} onChange={() => toggle(id)} />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Cancel</button>
              <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save role"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
