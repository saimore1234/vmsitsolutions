"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface RoleOption { id: string; name: string }
interface BranchOption { id: string; name: string }
interface GroupOption { id: string; name: string }
interface ManagerOption { id: string; firstName: string; lastName: string; email: string }

const GENDERS = ["male", "female", "other", "undisclosed"];

type FormState = {
  email: string; username: string; firstName: string; middleName: string; lastName: string; displayName: string;
  phone: string; alternatePhone: string; gender: string; dob: string; joiningDate: string;
  department: string; designation: string; location: string; managerId: string; roleId: string;
  branchIds: string[]; groupIds: string[]; language: string; timeZone: string; currency: string;
  bio: string; notes: string; password: string; confirmPassword: string; sendInvite: boolean; mustChangePassword: boolean;
};

const EMPTY: FormState = {
  email: "", username: "", firstName: "", middleName: "", lastName: "", displayName: "",
  phone: "", alternatePhone: "", gender: "", dob: "", joiningDate: "",
  department: "", designation: "", location: "", managerId: "", roleId: "",
  branchIds: [], groupIds: [], language: "en", timeZone: "Asia/Kolkata", currency: "INR",
  bio: "", notes: "", password: "", confirmPassword: "", sendInvite: true, mustChangePassword: false,
};

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ inviteUrl?: string; employeeId?: string } | null>(null);

  useEffect(() => {
    api<RoleOption[]>("/roles").then(setRoles).catch(() => {});
    api<{ items: BranchOption[] }>("/branches?limit=100").then((r) => setBranches(r.items)).catch(() => {});
    api<GroupOption[]>("/user-groups").then(setGroups).catch(() => {});
    api<{ items: ManagerOption[] }>("/users?limit=100").then((r) => setManagers(r.items)).catch(() => {});
  }, []);

  const bind = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  function toggleMulti(key: "branchIds" | "groupIds", id: string) {
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.email || !form.firstName || !form.lastName || !form.roleId) { setError("Email, first name, last name and role are required"); return; }
    if (!form.sendInvite) {
      if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
      if (form.password !== form.confirmPassword) { setError("Passwords don't match"); return; }
    }
    setSaving(true);
    try {
      const body = {
        email: form.email, username: form.username || undefined, firstName: form.firstName,
        middleName: form.middleName || undefined, lastName: form.lastName, displayName: form.displayName || undefined,
        phone: form.phone || undefined, alternatePhone: form.alternatePhone || undefined,
        gender: form.gender || undefined, dob: form.dob ? new Date(form.dob).toISOString() : undefined,
        joiningDate: form.joiningDate ? new Date(form.joiningDate).toISOString() : undefined,
        department: form.department || undefined, designation: form.designation || undefined,
        location: form.location || undefined, managerId: form.managerId || undefined, roleId: form.roleId,
        branchIds: form.branchIds, groupIds: form.groupIds, language: form.language, timeZone: form.timeZone,
        currency: form.currency, bio: form.bio || undefined, notes: form.notes || undefined,
        sendInvite: form.sendInvite, mustChangePassword: form.mustChangePassword,
        password: form.sendInvite ? undefined : form.password,
      };
      // Raw fetch (not the api() helper) because the response carries a sibling `inviteUrl`
      // field alongside `data` that api() would otherwise discard.
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not create user");

      if (json.inviteUrl) {
        setResult({ inviteUrl: json.inviteUrl, employeeId: json.data.employeeId });
      } else {
        router.push(`/admin/users/${json.data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  if (result?.inviteUrl) {
    return (
      <div className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-display text-lg font-semibold text-ink">Invitation created</h1>
        <p className="text-sm text-slate-500">
          SMTP sending isn&rsquo;t configured yet, so share this link with the new user directly — they&rsquo;ll set their own password.
        </p>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-ink break-all">{result.inviteUrl}</div>
        <div className="flex gap-3">
          <button onClick={() => navigator.clipboard.writeText(result.inviteUrl!)} className="rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white">Copy link</button>
          <button onClick={() => router.push("/admin/users")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink">Back to users</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Add user</h1>
          <p className="mt-1 text-sm text-slate-500">Employee ID is generated automatically once the user is created.</p>
        </div>
        <button disabled={saving} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
          {saving ? "Creating…" : "Create user"}
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Identity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="First name" required><input {...bind("firstName")} required className={inputCls} /></Field>
          <Field label="Middle name"><input {...bind("middleName")} className={inputCls} /></Field>
          <Field label="Last name" required><input {...bind("lastName")} required className={inputCls} /></Field>
          <Field label="Display name"><input {...bind("displayName")} placeholder="Shown in the admin UI" className={inputCls} /></Field>
          <Field label="Username"><input {...bind("username")} className={inputCls} /></Field>
          <Field label="Gender">
            <select {...bind("gender")} className={inputCls}>
              <option value="">—</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Date of birth"><input type="date" {...bind("dob")} className={inputCls} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Contact</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Email" required><input type="email" {...bind("email")} required className={inputCls} /></Field>
          <Field label="Mobile"><input {...bind("phone")} className={inputCls} /></Field>
          <Field label="Alternate mobile"><input {...bind("alternatePhone")} className={inputCls} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Employment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Department"><input {...bind("department")} className={inputCls} /></Field>
          <Field label="Designation"><input {...bind("designation")} className={inputCls} /></Field>
          <Field label="Location"><input {...bind("location")} className={inputCls} /></Field>
          <Field label="Joining date"><input type="date" {...bind("joiningDate")} className={inputCls} /></Field>
          <Field label="Manager">
            <select {...bind("managerId")} className={inputCls}>
              <option value="">None</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </select>
          </Field>
          <Field label="Role" required>
            <select {...bind("roleId")} required className={inputCls}>
              <option value="">Select a role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-600">Branches</div>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              {branches.length === 0 && <span className="text-xs text-slate-400">No branches configured</span>}
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleMulti("branchIds", b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-600">User groups</div>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              {groups.length === 0 && <span className="text-xs text-slate-400">No groups yet</span>}
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleMulti("groupIds", g.id)} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Preferences</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Language"><input {...bind("language")} className={inputCls} /></Field>
          <Field label="Time zone"><input {...bind("timeZone")} className={inputCls} /></Field>
          <Field label="Currency"><input {...bind("currency")} className={inputCls} /></Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Bio"><textarea rows={2} {...bind("bio")} className={inputCls} /></Field>
          <Field label="Notes (internal)"><textarea rows={2} {...bind("notes")} className={inputCls} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Access</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.sendInvite} onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))} />
            Send an invitation link instead of setting a password now
          </label>
          {!form.sendInvite && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" required><input type="password" {...bind("password")} className={inputCls} /></Field>
              <Field label="Confirm password" required><input type="password" {...bind("confirmPassword")} className={inputCls} /></Field>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.mustChangePassword} onChange={(e) => setForm((f) => ({ ...f, mustChangePassword: e.target.checked }))} />
            Force password change on next sign-in
          </label>
        </div>
      </section>
    </form>
  );
}

const inputCls = "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-600">
      {label}{required && <span className="text-red-500"> *</span>}
      {children}
    </label>
  );
}
