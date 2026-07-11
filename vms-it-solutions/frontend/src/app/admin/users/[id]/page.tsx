"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface UserDetail {
  id: string; employeeId: string | null; email: string; username: string | null;
  firstName: string; middleName: string | null; lastName: string; displayName: string | null;
  phone: string | null; alternatePhone: string | null; avatarUrl: string | null; avatarThumbUrl: string | null;
  gender: string | null; dob: string | null; joiningDate: string | null;
  department: string | null; designation: string | null; location: string | null;
  bio: string | null; notes: string | null; language: string | null; timeZone: string | null; currency: string | null;
  status: string; isActive: boolean; isLocked: boolean; emailVerified: boolean; mustChangePassword: boolean;
  invitedAt: string | null; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  role: { id: string; name: string; slug: string };
  manager: { id: string; firstName: string; lastName: string; email: string } | null;
  branches: { isPrimary: boolean; branch: { id: string; name: string } }[];
  groups: { group: { id: string; name: string } }[];
  _count: { documents: number; directReports: number };
}
interface RoleOption { id: string; name: string; permissions: { permission: { resource: string; action: string } }[] }
interface BranchOption { id: string; name: string }
interface GroupOption { id: string; name: string }
interface ManagerOption { id: string; firstName: string; lastName: string }
interface DocumentRow { id: string; kind: string; name: string; url: string; mimeType: string; sizeBytes: number; uploadedAt: string }
interface SessionRow { id: string; ip: string | null; userAgent: string | null; createdAt: string; expiresAt: string; browser: string; os: string; device: string }
interface ActivityRow { id: string; action: string; resource: string; detail: unknown; ip: string | null; createdAt: string; user: { firstName: string; lastName: string } | null }

const TABS = ["overview", "personal", "access", "documents", "sessions", "activity"] as const;
const STATUSES = ["draft", "invited", "active", "inactive", "suspended", "locked", "deleted", "archived"];
const DOC_KINDS = ["resume", "pan", "aadhaar", "passport", "driving_license", "offer_letter", "certificate", "contract", "other"];
const inputCls = "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const [error, setError] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setUser(await api<UserDetail>(`/users/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load user"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    await fetch(`${API_URL}/users/${id}/photo`, {
      method: "POST", credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      body: form,
    });
    load();
  }

  async function setStatus(status: string) {
    if (!confirm(`Change status to "${status}"?`)) return;
    await api(`/users/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
    load();
  }

  async function forceLogout() {
    if (!confirm("End all active sessions for this user?")) return;
    await api(`/users/${id}/force-logout`, { method: "POST" });
    load();
  }

  async function resetPassword() {
    const pw = prompt("New password (min 8 characters):");
    if (!pw) return;
    await api(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: pw }) });
    alert("Password reset");
  }

  async function sendInvite() {
    // Raw fetch (not api()) because the response carries a sibling `inviteUrl` field that api() would discard.
    const res = await fetch(`${API_URL}/users/${id}/invite`, {
      method: "POST", credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    });
    const json = await res.json();
    load();
    if (json.inviteUrl) { navigator.clipboard.writeText(json.inviteUrl); alert(`Invite link copied to clipboard:\n${json.inviteUrl}`); }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!user) return <p className="font-mono-x text-xs uppercase tracking-widest text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/admin/users")} className="text-xs text-slate-500 hover:text-ink">← Back to users</button>

      <header className="flex flex-wrap items-start justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-cobalt/10 text-lg font-semibold text-cobalt">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            )}
            <button onClick={() => avatarInput.current?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-cobalt px-1.5 py-1 text-[10px] text-white">Edit</button>
            <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{user.displayName || `${user.firstName} ${user.lastName}`}</h1>
            <p className="text-sm text-slate-500">{user.designation ?? user.role.name} {user.department && `· ${user.department}`}</p>
            <p className="mt-1 font-mono-x text-[11px] uppercase tracking-widest text-slate-400">{user.employeeId ?? "No employee ID"} · {user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={user.status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(user.status === "invited" || user.status === "draft") && (
            <button onClick={sendInvite} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-ink hover:border-cobalt">
              {user.status === "invited" ? "Resend invite" : "Send invite"}
            </button>
          )}
          <button onClick={resetPassword} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-ink hover:border-cobalt">Reset password</button>
          <button onClick={forceLogout} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">Force logout</button>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${tab === t ? "border-cobalt text-cobalt" : "border-transparent text-slate-500 hover:text-ink"}`}
          >
            {t === "access" ? "Roles & Access" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab user={user} />}
      {tab === "personal" && <PersonalTab user={user} onSaved={load} />}
      {tab === "access" && <AccessTab user={user} onSaved={load} />}
      {tab === "documents" && <DocumentsTab userId={user.id} />}
      {tab === "sessions" && <SessionsTab userId={user.id} />}
      {tab === "activity" && <ActivityTab userId={user.id} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-600">
      {label}{required && <span className="text-red-500"> *</span>}
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-ink">{value ?? "—"}</span>
    </div>
  );
}

function OverviewTab({ user }: { user: UserDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Contact">
        <Row label="Email" value={user.email} />
        <Row label="Mobile" value={user.phone} />
        <Row label="Alternate mobile" value={user.alternatePhone} />
        <Row label="Location" value={user.location} />
      </Card>
      <Card title="Employment">
        <Row label="Department" value={user.department} />
        <Row label="Designation" value={user.designation} />
        <Row label="Manager" value={user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : null} />
        <Row label="Joining date" value={user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : null} />
        <Row label="Direct reports" value={user._count.directReports} />
      </Card>
      <Card title="Account">
        <Row label="Status" value={user.status} />
        <Row label="Role" value={user.role.name} />
        <Row label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
        <Row label="Last login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"} />
        <Row label="Created" value={new Date(user.createdAt).toLocaleDateString()} />
      </Card>
      <Card title="Groups & branches">
        <Row label="Branches" value={user.branches.length ? user.branches.map((b) => b.branch.name).join(", ") : null} />
        <Row label="Groups" value={user.groups.length ? user.groups.map((g) => g.group.name).join(", ") : null} />
      </Card>
      {user.bio && <Card title="Bio"><p className="text-sm text-slate-600">{user.bio}</p></Card>}
    </div>
  );
}

function PersonalTab({ user, onSaved }: { user: UserDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: user.firstName, middleName: user.middleName ?? "", lastName: user.lastName, displayName: user.displayName ?? "",
    username: user.username ?? "", phone: user.phone ?? "", alternatePhone: user.alternatePhone ?? "",
    gender: user.gender ?? "", dob: user.dob?.slice(0, 10) ?? "", location: user.location ?? "",
    language: user.language ?? "en", timeZone: user.timeZone ?? "Asia/Kolkata", currency: user.currency ?? "INR",
    bio: user.bio ?? "", notes: user.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bind = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, dob: form.dob ? new Date(form.dob).toISOString() : null }),
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card title="Personal information">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" required><input {...bind("firstName")} required className={inputCls} /></Field>
          <Field label="Middle name"><input {...bind("middleName")} className={inputCls} /></Field>
          <Field label="Last name" required><input {...bind("lastName")} required className={inputCls} /></Field>
          <Field label="Display name"><input {...bind("displayName")} className={inputCls} /></Field>
          <Field label="Username"><input {...bind("username")} className={inputCls} /></Field>
          <Field label="Gender">
            <select {...bind("gender")} className={inputCls}>
              <option value="">—</option>
              <option value="male">male</option><option value="female">female</option><option value="other">other</option><option value="undisclosed">undisclosed</option>
            </select>
          </Field>
          <Field label="Date of birth"><input type="date" {...bind("dob")} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mobile"><input {...bind("phone")} className={inputCls} /></Field>
          <Field label="Alternate mobile"><input {...bind("alternatePhone")} className={inputCls} /></Field>
          <Field label="Location"><input {...bind("location")} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title="Preferences">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Language"><input {...bind("language")} className={inputCls} /></Field>
          <Field label="Time zone"><input {...bind("timeZone")} className={inputCls} /></Field>
          <Field label="Currency"><input {...bind("currency")} className={inputCls} /></Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Bio"><textarea rows={2} {...bind("bio")} className={inputCls} /></Field>
          <Field label="Notes (internal)"><textarea rows={2} {...bind("notes")} className={inputCls} /></Field>
        </div>
      </Card>
      <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}

function AccessTab({ user, onSaved }: { user: UserDetail; onSaved: () => void }) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [roleId, setRoleId] = useState(user.role.id);
  const [managerId, setManagerId] = useState(user.manager?.id ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [designation, setDesignation] = useState(user.designation ?? "");
  const [joiningDate, setJoiningDate] = useState(user.joiningDate?.slice(0, 10) ?? "");
  const [branchIds, setBranchIds] = useState(user.branches.map((b) => b.branch.id));
  const [groupIds, setGroupIds] = useState(user.groups.map((g) => g.group.id));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<RoleOption[]>("/roles").then(setRoles).catch(() => {});
    api<{ items: BranchOption[] }>("/branches?limit=100").then((r) => setBranches(r.items)).catch(() => {});
    api<GroupOption[]>("/user-groups").then(setGroups).catch(() => {});
    api<{ items: ManagerOption[] }>("/users?limit=100").then((r) => setManagers(r.items.filter((m) => m.id !== user.id))).catch(() => {});
  }, [user.id]);

  function toggle(setter: typeof setBranchIds, list: string[], id: string) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          roleId, managerId: managerId || null, department: department || null, designation: designation || null,
          joiningDate: joiningDate ? new Date(joiningDate).toISOString() : null, branchIds, groupIds,
        }),
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  const currentRole = roles.find((r) => r.id === roleId);
  const permsByResource = new Map<string, string[]>();
  for (const rp of currentRole?.permissions ?? []) {
    const list = permsByResource.get(rp.permission.resource) ?? [];
    list.push(rp.permission.action);
    permsByResource.set(rp.permission.resource, list);
  }

  return (
    <div className="space-y-6">
      <Card title="Role & reporting">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputCls}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Manager">
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </select>
          </Field>
          <Field label="Department"><input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} /></Field>
          <Field label="Designation"><input value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} /></Field>
          <Field label="Joining date"><input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className={inputCls} /></Field>
        </div>
      </Card>

      <Card title="Branches & groups">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-600">Branches</div>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => toggle(setBranchIds, branchIds, b.id)} />{b.name}
                </label>
              ))}
              {!branches.length && <span className="text-xs text-slate-400">None configured</span>}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-600">User groups</div>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggle(setGroupIds, groupIds, g.id)} />{g.name}
                </label>
              ))}
              {!groups.length && <span className="text-xs text-slate-400">None yet</span>}
            </div>
          </div>
        </div>
      </Card>

      <button onClick={save} disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save access"}
      </button>

      <Card title={`Effective permissions — ${currentRole?.name ?? ""}`}>
        {currentRole?.name === "Super Admin" ? (
          <p className="text-sm text-slate-500">Super Admin bypasses all permission checks.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...permsByResource.entries()].map(([resource, actions]) => (
              <div key={resource} className="rounded-lg bg-slate-50 p-2.5">
                <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-500">{resource}</div>
                <div className="mt-1 text-xs text-slate-600">{actions.join(", ")}</div>
              </div>
            ))}
            {!permsByResource.size && <p className="text-sm text-slate-400">No permissions granted.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

function DocumentsTab({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [kind, setKind] = useState("resume");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => setDocs(await api<DocumentRow[]>(`/users/${userId}/documents`)), [userId]);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    await fetch(`${API_URL}/users/${userId}/documents`, {
      method: "POST", credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      body: form,
    });
    load();
  }

  async function remove(docId: string) {
    if (!confirm("Delete this document?")) return;
    await api(`/users/${userId}/documents/${docId}`, { method: "DELETE" });
    load();
  }

  return (
    <Card title="Documents">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink hover:border-cobalt">Upload</button>
        <input ref={inputRef} type="file" accept=".pdf,image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      <div className="divide-y divide-slate-100">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">{d.kind}</span>
              <a href={d.url} target="_blank" rel="noreferrer" className="ml-2 text-ink hover:text-cobalt">{d.name}</a>
              <span className="ml-2 text-xs text-slate-400">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
            </div>
            <button onClick={() => remove(d.id)} className="text-xs text-slate-400 hover:text-red-600">Delete</button>
          </div>
        ))}
        {!docs.length && <p className="py-4 text-sm text-slate-400">No documents uploaded.</p>}
      </div>
    </Card>
  );
}

function SessionsTab({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const load = useCallback(async () => setSessions(await api<SessionRow[]>(`/users/${userId}/sessions`)), [userId]);
  useEffect(() => { load(); }, [load]);

  async function revoke(id: string) {
    await api(`/users/${userId}/sessions/${id}/revoke`, { method: "POST" });
    load();
  }

  return (
    <Card title="Active sessions">
      <div className="divide-y divide-slate-100">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <div className="font-medium text-ink">{s.browser} on {s.os} <span className="text-xs capitalize text-slate-400">({s.device})</span></div>
              <div className="text-xs text-slate-400">{s.ip} · signed in {new Date(s.createdAt).toLocaleString()}</div>
            </div>
            <button onClick={() => revoke(s.id)} className="text-xs text-slate-400 hover:text-red-600">Revoke</button>
          </div>
        ))}
        {!sessions.length && <p className="py-4 text-sm text-slate-400">No active sessions.</p>}
      </div>
    </Card>
  );
}

function ActivityTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<ActivityRow[]>([]);
  useEffect(() => { api<ActivityRow[]>(`/users/${userId}/activity`).then(setItems).catch(() => {}); }, [userId]);

  return (
    <Card title="Recent activity">
      <div className="divide-y divide-slate-100">
        {items.map((a) => (
          <div key={a.id} className="py-2.5 text-sm">
            <div className="text-ink">
              <span className="font-medium">{a.user ? `${a.user.firstName} ${a.user.lastName}` : "System"}</span>{" "}
              <span className="text-slate-500">{a.action.replace(/_/g, " ")} · {a.resource}</span>
            </div>
            <div className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}{a.ip ? ` · ${a.ip}` : ""}</div>
          </div>
        ))}
        {!items.length && <p className="py-4 text-sm text-slate-400">No recorded activity.</p>}
      </div>
    </Card>
  );
}
