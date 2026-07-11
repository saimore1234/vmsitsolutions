"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface UserRow {
  id: string; employeeId: string | null; email: string; username: string | null;
  firstName: string; lastName: string; displayName: string | null;
  avatarUrl: string | null; avatarThumbUrl: string | null;
  department: string | null; designation: string | null; status: string;
  isActive: boolean; isLocked: boolean; lastLoginAt: string | null; createdAt: string;
  role: { id: string; name: string; slug: string };
}
interface UserList { items: UserRow[]; pagination: { page: number; totalPages: number; total: number } }
interface Stats {
  total: number; active: number; inactive: number; locked: number; suspended: number;
  pendingInvitations: number; draft: number; archived: number; activeSessions: number;
  byDepartment: { department: string; count: number }[];
  byRole: { roleId: string; role: string; count: number }[];
}
interface RoleOption { id: string; name: string; slug: string }
interface GroupOption { id: string; name: string }

const STATUSES = ["draft", "invited", "active", "inactive", "suspended", "locked", "deleted", "archived"];
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500", invited: "bg-amber-100 text-amber-700", active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500", suspended: "bg-orange-100 text-orange-700", locked: "bg-red-100 text-red-700",
  deleted: "bg-red-100 text-red-700", archived: "bg-slate-100 text-slate-500",
};

export default function UsersPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<UserList | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleId, setRoleId] = useState("");
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) qs.set("search", search);
      if (status) qs.set("status", status);
      if (roleId) qs.set("roleId", roleId);
      if (groupId) qs.set("groupId", groupId);
      const [list, s] = await Promise.all([
        api<UserList>(`/users?${qs}`),
        api<Stats>("/users/stats"),
      ]);
      setData(list);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users");
    }
  }, [page, search, status, roleId, groupId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api<RoleOption[]>("/roles").then((r) => setRoles(r)).catch(() => {});
    api<GroupOption[]>("/user-groups").then((g) => setGroups(g)).catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    if (!data) return;
    setSelected((s) => s.size === data.items.length ? new Set() : new Set(data.items.map((u) => u.id)));
  }

  async function bulkStatus(next: string) {
    if (!selected.size) return;
    setBusy(true);
    try {
      await api("/users/bulk/status", { method: "POST", body: JSON.stringify({ ids: [...selected], status: next }) });
      setSelected(new Set());
      load();
    } finally { setBusy(false); }
  }

  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} user(s)?`)) return;
    setBusy(true);
    try {
      await api("/users/bulk/delete", { method: "POST", body: JSON.stringify({ ids: [...selected] }) });
      setSelected(new Set());
      load();
    } finally { setBusy(false); }
  }

  async function bulkAssignRole(newRoleId: string) {
    if (!selected.size || !newRoleId) return;
    setBusy(true);
    try {
      await api("/users/bulk/assign-role", { method: "POST", body: JSON.stringify({ ids: [...selected], roleId: newRoleId }) });
      setSelected(new Set());
      load();
    } finally { setBusy(false); }
  }

  async function bulkAssignGroup(groupId: string) {
    if (!selected.size || !groupId) return;
    setBusy(true);
    try {
      await api("/users/bulk/assign-group", { method: "POST", body: JSON.stringify({ ids: [...selected], groupId, action: "add" }) });
      setSelected(new Set());
      load();
    } finally { setBusy(false); }
  }

  async function exportCsv() {
    const res = await fetch(`${API_URL}/users/export`, { credentials: "include", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsv(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/users/import`, {
        method: "POST", credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Import failed");
      alert(`Imported ${json.data.created} user(s)${json.data.failed ? `, ${json.data.failed} failed` : ""}`);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const tiles = stats ? [
    ["Total users", stats.total], ["Active", stats.active], ["Inactive", stats.inactive],
    ["Locked", stats.locked], ["Suspended", stats.suspended], ["Pending invites", stats.pendingInvitations],
    ["Active sessions", stats.activeSessions],
  ] as const : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Employees, roles, groups and access across the organisation.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-cobalt">
            Export CSV
          </button>
          <button onClick={() => importRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-cobalt">
            Import CSV
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
          <Link href="/admin/users/new" className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
            + Add User
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <input
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, email, employee ID…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt">
          <option value="">All groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cobalt/30 bg-cobalt/5 p-3">
          <span className="text-sm font-medium text-ink">{selected.size} selected</span>
          <select disabled={busy} onChange={(e) => { if (e.target.value) bulkStatus(e.target.value); e.target.value = ""; }} defaultValue="" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none">
            <option value="" disabled>Set status…</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select disabled={busy} onChange={(e) => { if (e.target.value) bulkAssignRole(e.target.value); e.target.value = ""; }} defaultValue="" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none">
            <option value="" disabled>Assign role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select disabled={busy} onChange={(e) => { if (e.target.value) bulkAssignGroup(e.target.value); e.target.value = ""; }} defaultValue="" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none">
            <option value="" disabled>Add to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button disabled={busy} onClick={bulkDelete} className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={!!data && selected.size === data.items.length && data.items.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                    {u.avatarThumbUrl || u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarThumbUrl ?? u.avatarUrl ?? ""} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-cobalt/10 text-xs font-semibold text-cobalt">
                        {u.firstName[0]}{u.lastName[0]}
                      </span>
                    )}
                    <div>
                      <div className="font-medium text-ink hover:text-cobalt">{u.displayName || `${u.firstName} ${u.lastName}`}</div>
                      <div className="text-xs text-slate-400">{u.email}{u.employeeId ? ` · ${u.employeeId}` : ""}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{u.department ?? "—"}</div>
                  {u.designation && <div className="text-xs text-slate-400">{u.designation}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">{u.role.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 font-mono-x text-[10px] uppercase tracking-wider ${STATUS_STYLE[u.status] ?? "bg-slate-100"}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</td>
              </tr>
            ))}
            {data && !data.items.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No users match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.pagination.total} users</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
