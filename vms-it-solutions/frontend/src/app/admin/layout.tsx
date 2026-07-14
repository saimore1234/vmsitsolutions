"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api, API_URL, getAccessToken, setAccessToken } from "@/lib/api";
import { MeContext, type Me } from "@/lib/me-context";

const NAV = [
  { href: "/admin", label: "Dashboard", perm: "dashboard:view" },
  { href: "/admin/leads", label: "Leads", perm: "leads:view" },
  { href: "/admin/opportunities", label: "Opportunities", perm: "opportunities:view" },
  { href: "/admin/customers", label: "Customers", perm: "customers:view" },
  { href: "/admin/popups", label: "Popup Builder", perm: "popups:view" },
  { href: "/admin/users", label: "User Management", perm: "users:view" },
  { href: "/admin/user-groups", label: "User Groups", perm: "users:view" },
  { href: "/admin/roles", label: "Roles & Permissions", perm: "roles:view" },
  { href: "/admin/settings/company", label: "Company information", perm: "settings:view" },
  { href: "/admin/settings/branding", label: "Branding", perm: "settings:view" },
  { href: "/admin/settings/communication", label: "Communication", perm: "settings:view" },
];

interface Logo { kind: string; url: string; thumbUrl: string | null }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [logos, setLogos] = useState<Logo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // api() transparently refreshes via the httpOnly cookie if the access token is stale/missing
        const user = await api<Me>("/auth/me");
        if (!cancelled) setMe(user);
      } catch {
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    fetch(`${API_URL}/settings/branding`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json.success) setLogos(json.data.logos); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [router]);

  const logo = (kind: string) => logos.find((l) => l.kind === kind);
  const sidebarLogo = logo("sidebar") ?? logo("dark") ?? logo("primary");
  const loaderLogo = logo("loader");

  async function signOut() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      });
    } finally {
      setAccessToken(null);
      router.replace("/login");
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center gap-4 bg-ink text-slate-x">
        {loaderLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loaderLogo.url} alt="" className="h-10 w-10 animate-pulse object-contain" />
        )}
        <p className="font-mono-x text-xs uppercase tracking-widest">Loading portal…</p>
      </div>
    );
  }
  if (!me) return null;

  const can = (perm: string) => me.role.slug === "super-admin" || me.permissions.includes(perm) || me.permissions.includes(perm.split(":")[0] + ":manage");

  return (
    <MeContext.Provider value={me}>
      <div className="flex min-h-screen bg-paper">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ink text-white md:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
            {sidebarLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sidebarLogo.thumbUrl ?? sidebarLogo.url} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cobalt font-display text-sm font-bold">V</span>
            )}
            <div>
              <div className="font-display text-sm font-semibold leading-tight">VMS Portal</div>
              <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-x">{me.role.name}</div>
            </div>
          </div>
          <nav className="scrollbar-hidden min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {NAV.filter((n) => can(n.perm)).map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`block rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                    active ? "bg-cobalt text-white" : "text-slate-x hover:bg-ink-3 hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 border-t border-line p-3">
            <div className="px-3 pb-2">
              <div className="truncate text-[13px] font-medium">{me.firstName} {me.lastName}</div>
              <div className="truncate font-mono-x text-[10px] text-slate-x">{me.email}</div>
            </div>
            <button onClick={signOut} className="w-full rounded-lg border border-line px-3 py-2 text-left text-[13px] text-slate-x transition hover:border-red-500/50 hover:text-red-400">
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-h-screen flex-1 md:ml-60">
          <div className="mx-auto max-w-6xl p-6 lg:p-10">{children}</div>
        </main>
      </div>
    </MeContext.Provider>
  );
}
