"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, setAccessToken } from "@/lib/api";

interface Logo { kind: string; url: string }

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logos, setLogos] = useState<Logo[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/settings/branding`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setLogos(json.data.logos); })
      .catch(() => {});
  }, []);

  const loginLogo = logos.find((l) => l.kind === "login") ?? logos.find((l) => l.kind === "dark") ?? logos.find((l) => l.kind === "primary");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Sign in failed");
      setAccessToken(json.data.accessToken);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-8">
        <div className="mb-8 text-center">
          {loginLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loginLogo.url} alt="" className="mx-auto h-10 w-auto object-contain" />
          ) : (
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-cobalt font-display text-lg font-bold text-white">V</span>
          )}
          <h1 className="mt-4 font-display text-xl font-semibold text-white">Admin portal</h1>
          <p className="mt-1 font-mono-x text-[11px] uppercase tracking-widest text-slate-x">VMS IT Solutions</p>
        </div>

        <label className="grid gap-1.5 text-xs font-medium text-slate-x">
          Email
          <input
            type="email" required autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-cobalt"
            placeholder="admin@vmsitsolutions.com"
          />
        </label>
        <label className="mt-4 grid gap-1.5 text-xs font-medium text-slate-x">
          Password
          <input
            type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-cobalt"
          />
        </label>

        {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

        <button
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-cobalt py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
