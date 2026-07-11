"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL, getAccessToken } from "@/lib/api";

interface Logo { id: string; kind: string; url: string; thumbUrl: string | null; updatedAt: string }
interface LogoSettings {
  width: number; height: number; position: string; padding: number; background: string | null;
  borderRadius: number; headerLogoHeight: number; footerLogoHeight: number; mobileLogoHeight: number;
  stickyHeaderLogo: boolean; darkModeLogoEnabled: boolean; retinaLogo: boolean; enableSvgLogo: boolean;
  maxUploadSizeMb: number;
}
interface HistoryEntry { id: string; url: string; createdAt: string }

interface KindDef { kind: string; label: string; hint: string }
const GROUPS: { title: string; kinds: KindDef[] }[] = [
  {
    title: "Core identity",
    kinds: [
      { kind: "primary", label: "Company logo (primary)", hint: "PNG, SVG or WEBP" },
      { kind: "dark", label: "Dark-background logo", hint: "Light-colored variant for dark headers/footers" },
      { kind: "light", label: "Light-background logo", hint: "Dark-colored variant for light backgrounds" },
      { kind: "favicon", label: "Favicon", hint: "ICO, PNG or SVG · square" },
    ],
  },
  {
    title: "Application chrome",
    kinds: [
      { kind: "login", label: "Login page logo", hint: "Shown above the sign-in form" },
      { kind: "sidebar", label: "Sidebar logo", hint: "Admin portal sidebar" },
      { kind: "dashboard", label: "Admin panel logo", hint: "Reserved for a future dashboard header" },
      { kind: "mobile", label: "Mobile logo", hint: "Shown on small screens instead of the primary logo" },
      { kind: "footer", label: "Footer logo", hint: "Public site footer" },
      { kind: "loader", label: "Loader logo", hint: "Shown while the admin portal is authenticating" },
    ],
  },
  {
    title: "Documents (stored for future email/invoice modules)",
    kinds: [
      { kind: "email", label: "Email header logo", hint: "Not yet consumed — SMTP sending is not wired up" },
      { kind: "invoice", label: "Invoice logo", hint: "Not yet consumed — invoicing module not built" },
      { kind: "quotation", label: "Quotation logo", hint: "Not yet consumed — quotation module not built" },
      { kind: "letterhead", label: "Letterhead logo", hint: "Not yet consumed — document generation not built" },
      { kind: "watermark", label: "Watermark", hint: "PNG with transparency recommended" },
    ],
  },
  {
    title: "Social & default imagery",
    kinds: [
      { kind: "og_image", label: "Open Graph image", hint: "1200×630 recommended — used for social share previews" },
      { kind: "default_banner", label: "Default banner image", hint: "Fallback banner when a page has none set" },
      { kind: "default_thumbnail", label: "Default thumbnail", hint: "Fallback thumbnail for cards/listings" },
    ],
  },
];

const ACCEPT = ".png,.jpg,.jpeg,.svg,.webp,.ico,image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon";

async function compressImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.type.includes("icon") || file.size < 1_000_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name, { type: blob.type });
  } catch {
    return file; // best-effort — fall back to the original file on any decode error
  }
}

function LogoCard({ def, logo, onChanged }: { def: KindDef; logo: Logo | undefined; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch(`${API_URL}/settings/branding/logos/${def.kind}`, {
        method: "POST",
        credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Upload failed");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the ${def.label.toLowerCase()}?`)) return;
    setBusy(true);
    try {
      await api(`/settings/branding/logos/${def.kind}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory() {
    if (history) { setHistory(null); return; }
    const res = await api<HistoryEntry[]>(`/settings/branding/logos/${def.kind}/history`);
    setHistory(res);
  }

  async function restore(historyId: string) {
    setBusy(true);
    try {
      await api(`/settings/branding/logos/${def.kind}/restore`, { method: "POST", body: JSON.stringify({ historyId }) });
      setHistory(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{def.label}</div>
          <div className="mt-0.5 text-xs text-slate-400">{def.hint}</div>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-3 grid h-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed transition ${
          dragOver ? "border-cobalt bg-cobalt/5" : "border-slate-200 bg-slate-50"
        }`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.thumbUrl ?? logo.url} alt={def.label} className="max-h-24 max-w-full object-contain p-2" />
        ) : (
          <span className="text-xs text-slate-400">{busy ? "Uploading…" : "Drop image or click to upload"}</span>
        )}
        <input
          ref={inputRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-cobalt hover:text-cobalt-soft">
          {logo ? "Replace" : "Upload"}
        </button>
        {logo && (
          <>
            <a href={logo.url} download target="_blank" rel="noreferrer" className="text-slate-500 hover:text-ink">Download</a>
            <button type="button" onClick={remove} className="text-slate-500 hover:text-red-600">Delete</button>
          </>
        )}
        <button type="button" onClick={toggleHistory} className="text-slate-500 hover:text-ink">History</button>
      </div>

      {history && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          {history.length === 0 && <p className="text-xs text-slate-400">No previous versions.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.url} alt="" className="h-8 w-8 rounded object-contain" />
                <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
              <button type="button" onClick={() => restore(h.id)} className="font-medium text-cobalt hover:text-cobalt-soft">Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrandingPage() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [settings, setSettings] = useState<LogoSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ logos: Logo[]; settings: LogoSettings }>("/settings/branding");
    setLogos(res.logos);
    setSettings(res.settings);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byKind = (kind: string) => logos.find((l) => l.kind === kind);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    try {
      const saved = await api<LogoSettings>("/settings/branding/logo-settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings(saved);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSavingSettings(false);
    }
  }

  const primary = byKind("primary");
  const dark = byKind("dark") ?? primary;
  const light = byKind("light") ?? primary;
  const login = byKind("login") ?? dark;
  const sidebar = byKind("sidebar") ?? dark;
  const footer = byKind("footer") ?? dark;
  const mobile = byKind("mobile") ?? primary;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Branding</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload every logo variant the site and admin portal use. Raster uploads are auto-converted to WebP with a generated
          thumbnail; changes appear below immediately and on the public site within its normal cache window.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{group.title}</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {group.kinds.map((def) => (
                  <LogoCard key={def.kind} def={def} logo={byKind(def.kind)} onChanged={load} />
                ))}
              </div>
            </section>
          ))}

          {settings && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Logo settings</h2>
              <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Header logo height (px)
                  <input type="number" min={16} max={200} value={settings.headerLogoHeight}
                    onChange={(e) => setSettings((s) => s && { ...s, headerLogoHeight: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Footer logo height (px)
                  <input type="number" min={16} max={200} value={settings.footerLogoHeight}
                    onChange={(e) => setSettings((s) => s && { ...s, footerLogoHeight: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Mobile logo height (px)
                  <input type="number" min={16} max={200} value={settings.mobileLogoHeight}
                    onChange={(e) => setSettings((s) => s && { ...s, mobileLogoHeight: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Position
                  <select value={settings.position} onChange={(e) => setSettings((s) => s && { ...s, position: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cobalt">
                    <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Padding (px)
                  <input type="number" min={0} max={100} value={settings.padding}
                    onChange={(e) => setSettings((s) => s && { ...s, padding: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Border radius (px)
                  <input type="number" min={0} max={100} value={settings.borderRadius}
                    onChange={(e) => setSettings((s) => s && { ...s, borderRadius: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Background
                  <input value={settings.background ?? ""} placeholder="transparent or #hex"
                    onChange={(e) => setSettings((s) => s && { ...s, background: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Max upload size (MB)
                  <input type="number" min={1} max={50} value={settings.maxUploadSizeMb}
                    onChange={(e) => setSettings((s) => s && { ...s, maxUploadSizeMb: Number(e.target.value) })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cobalt" />
                </label>

                <div className="flex flex-wrap gap-5 sm:col-span-2">
                  {([
                    ["stickyHeaderLogo", "Sticky header logo"],
                    ["darkModeLogoEnabled", "Use dark-variant logo on dark backgrounds"],
                    ["retinaLogo", "Retina (high-res) logo"],
                    ["enableSvgLogo", "Prefer SVG when available"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings((s) => s && { ...s, [key]: e.target.checked })} />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="sm:col-span-2">
                  <button disabled={savingSettings} className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft disabled:opacity-60">
                    {savingSettings ? "Saving…" : savedFlash ? "Saved ✓" : "Save logo settings"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-5">
            <p className="mb-4 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Live preview</p>

            <div className="space-y-4">
              <PreviewBlock label="Header (dark)">
                <div className="flex h-14 items-center bg-ink px-4">
                  <LogoImg logo={dark} height={settings?.headerLogoHeight ?? 40} fallback="V" />
                </div>
              </PreviewBlock>

              <PreviewBlock label="Footer (dark)">
                <div className="flex h-14 items-center bg-ink px-4">
                  <LogoImg logo={footer} height={settings?.footerLogoHeight ?? 32} fallback="V" />
                </div>
              </PreviewBlock>

              <PreviewBlock label="Login page">
                <div className="grid h-20 place-items-center bg-ink">
                  <LogoImg logo={login} height={36} fallback="V" />
                </div>
              </PreviewBlock>

              <PreviewBlock label="Admin sidebar">
                <div className="flex h-14 items-center bg-ink px-4">
                  <LogoImg logo={sidebar} height={32} fallback="V" />
                </div>
              </PreviewBlock>

              <PreviewBlock label="Mobile header">
                <div className="mx-auto flex h-12 w-40 items-center bg-ink px-3">
                  <LogoImg logo={mobile} height={settings?.mobileLogoHeight ?? 32} fallback="V" />
                </div>
              </PreviewBlock>

              <PreviewBlock label="Light background">
                <div className="flex h-14 items-center bg-white px-4">
                  <LogoImg logo={light} height={32} fallback="V" dark />
                </div>
              </PreviewBlock>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-slate-500">{label}</div>
      <div className="overflow-hidden rounded-lg border border-slate-200">{children}</div>
    </div>
  );
}

function LogoImg({ logo, height, fallback, dark }: { logo: Logo | undefined; height: number; fallback: string; dark?: boolean }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo.url} alt="" style={{ height, width: "auto" }} className="object-contain" />;
  }
  return (
    <span
      className={`grid place-items-center rounded-lg font-display text-sm font-bold ${dark ? "bg-slate-200 text-ink" : "bg-cobalt text-white"}`}
      style={{ height: Math.min(height, 32), width: Math.min(height, 32) }}
    >
      {fallback}
    </span>
  );
}
