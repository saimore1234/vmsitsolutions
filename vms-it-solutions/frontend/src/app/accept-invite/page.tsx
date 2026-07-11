"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";

function AcceptInviteForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [invite, setInvite] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("Missing invitation token"); setChecking(false); return; }
    fetch(`${API_URL}/invitations/check?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setInvite(json.data); else setError(json.message || "Invalid or expired invitation"); })
      .catch(() => setError("Could not verify invitation"))
      .finally(() => setChecking(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not activate account");
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-cobalt font-display text-lg font-bold text-white">V</span>
          <h1 className="mt-4 font-display text-xl font-semibold text-white">Accept invitation</h1>
        </div>

        {checking && <p className="text-center text-sm text-slate-x">Checking invitation…</p>}

        {!checking && error && !done && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        {!checking && invite && !done && (
          <form onSubmit={submit}>
            <p className="mb-4 text-center text-sm text-slate-x">
              Welcome, <span className="text-white">{invite.firstName} {invite.lastName}</span> — set a password for <span className="text-white">{invite.email}</span>.
            </p>
            <label className="grid gap-1.5 text-xs font-medium text-slate-x">
              Password
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-cobalt" />
            </label>
            <label className="mt-4 grid gap-1.5 text-xs font-medium text-slate-x">
              Confirm password
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-cobalt" />
            </label>
            {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
            <button disabled={submitting} className="mt-6 w-full rounded-lg bg-cobalt py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
              {submitting ? "Activating…" : "Activate account"}
            </button>
          </form>
        )}

        {done && (
          <p className="text-center text-sm text-emerald-400">Account activated — redirecting you to sign in…</p>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
