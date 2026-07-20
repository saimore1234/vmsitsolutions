"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";

interface Popup {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  trigger: string;
  delaySeconds: number;
  scrollPercent: number;
  frequency: string;
  deviceRules: string[] | null;
}

function currentDevice(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function eligibleByFrequency(p: Popup): boolean {
  if (sessionStorage.getItem(`popup_dismissed_${p.id}`)) return false;
  if (p.frequency === "always") return true;
  if (p.frequency === "once") return !localStorage.getItem(`popup_seen_${p.id}`);
  if (p.frequency === "day") {
    const last = localStorage.getItem(`popup_seen_${p.id}`);
    return last !== new Date().toDateString();
  }
  // session
  return !sessionStorage.getItem(`popup_seen_${p.id}`);
}

function markSeen(p: Popup) {
  if (p.frequency === "session") sessionStorage.setItem(`popup_seen_${p.id}`, "1");
  else if (p.frequency === "day") localStorage.setItem(`popup_seen_${p.id}`, new Date().toDateString());
  else if (p.frequency === "once") localStorage.setItem(`popup_seen_${p.id}`, "1");
}

function track(id: string, type: "view" | "dismiss" | "conversion") {
  fetch(`${API_URL}/popups/${id}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

export function PopupManager() {
  const path = usePathname();
  const [pool, setPool] = useState<Popup[]>([]);
  const [active, setActive] = useState<Popup | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/popups/public/active?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        const device = currentDevice();
        const eligible = (json.data as Popup[]).filter((p) => {
          const devices = p.deviceRules ?? [];
          if (devices.length && !devices.includes(device)) return false;
          return eligibleByFrequency(p);
        });
        setPool(eligible);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  useEffect(() => {
    if (!pool.length) return;
    const timers: number[] = [];
    const cleanups: (() => void)[] = [];

    function fire(p: Popup) {
      if (shownRef.current) return;
      shownRef.current = true;
      setActive(p);
      markSeen(p);
      track(p.id, "view");
    }

    for (const p of pool) {
      if (p.trigger === "immediate") {
        timers.push(window.setTimeout(() => fire(p), 300));
      } else if (p.trigger === "delay") {
        timers.push(window.setTimeout(() => fire(p), Math.max(0, p.delaySeconds) * 1000));
      } else if (p.trigger === "scroll") {
        const onScroll = () => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 100;
          if (pct >= p.scrollPercent) fire(p);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener("scroll", onScroll));
      } else if (p.trigger === "exit_intent") {
        const onLeave = (e: MouseEvent) => { if (e.clientY <= 0) fire(p); };
        document.addEventListener("mouseleave", onLeave);
        cleanups.push(() => document.removeEventListener("mouseleave", onLeave));
      }
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((c) => c());
    };
  }, [pool]);

  if (!active) return null;

  function close(track_ = true) {
    if (active && track_) track(active.id, "dismiss");
    if (active) sessionStorage.setItem(`popup_dismissed_${active.id}`, "1");
    setActive(null);
  }

  return <PopupCard popup={active} onClose={close} />;
}

function PopupCard({ popup, onClose }: { popup: Popup; onClose: (track?: boolean) => void }) {
  if (popup.type === "cookie_consent") return <CookieBanner popup={popup} onClose={onClose} />;
  if (popup.type === "newsletter") return <NewsletterModal popup={popup} onClose={onClose} />;
  if (popup.type === "lead_capture") return <LeadCaptureModal popup={popup} onClose={onClose} />;
  return <StandardModal popup={popup} onClose={onClose} />;
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-100 grid place-items-center bg-scrim p-5" onClick={() => onClose()}>
      <div className="glass modal-panel relative w-full max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onClose()} aria-label="Close" className="absolute right-4 top-4 text-haze transition-colors duration-200 ease-out hover:text-fg">✕</button>
        {children}
      </div>
    </div>
  );
}

function StandardModal({ popup, onClose }: { popup: Popup; onClose: (track?: boolean) => void }) {
  return (
    <ModalShell onClose={() => onClose()}>
      {popup.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={popup.imageUrl} alt={popup.title ?? ""} className="mb-4 h-36 w-full rounded-lg object-cover" />
      )}
      {popup.title && <h3 className="pr-6 font-display text-lg font-semibold text-fg">{popup.title}</h3>}
      {popup.content && <p className="mt-2 text-sm text-mist">{popup.content}</p>}
      {popup.ctaText && popup.ctaUrl && (
        <a
          href={popup.ctaUrl}
          onClick={() => track(popup.id, "conversion")}
          target={popup.ctaUrl.startsWith("http") ? "_blank" : undefined}
          rel={popup.ctaUrl.startsWith("http") ? "noopener noreferrer" : undefined}
          className="btn-brand mt-4 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
        >
          {popup.ctaText}
        </a>
      )}
    </ModalShell>
  );
}

function NewsletterModal({ popup, onClose }: { popup: Popup; onClose: (track?: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`${API_URL}/leads/newsletter`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      track(popup.id, "conversion");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <ModalShell onClose={() => onClose()}>
      {state === "done" ? (
        <p className="pr-4 text-sm text-mist">You&rsquo;re subscribed. Thanks for joining.</p>
      ) : (
        <form onSubmit={submit}>
          {popup.title && <h3 className="pr-6 font-display text-lg font-semibold text-fg">{popup.title}</h3>}
          {popup.content && <p className="mt-2 text-sm text-mist">{popup.content}</p>}
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="field-glass mt-4 w-full rounded-lg px-3 py-2.5 text-sm"
          />
          {state === "error" && <p className="mt-2 text-xs text-red-400">Could not subscribe — try again.</p>}
          <button disabled={state === "sending"} className="btn-brand mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {state === "sending" ? "Subscribing…" : (popup.ctaText || "Subscribe")}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function LeadCaptureModal({ popup, onClose }: { popup: Popup; onClose: (track?: boolean) => void }) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, kind: "general" }),
      });
      if (!res.ok) throw new Error();
      track(popup.id, "conversion");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <ModalShell onClose={() => onClose()}>
      {state === "done" ? (
        <p className="pr-4 text-sm text-mist">Thanks — our team will reach out within one business day.</p>
      ) : (
        <form onSubmit={submit}>
          {popup.title && <h3 className="pr-6 font-display text-lg font-semibold text-fg">{popup.title}</h3>}
          {popup.content && <p className="mt-2 text-sm text-mist">{popup.content}</p>}
          <input
            required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            className="field-glass mt-4 w-full rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@company.com"
            className="field-glass mt-3 w-full rounded-lg px-3 py-2.5 text-sm"
          />
          {state === "error" && <p className="mt-2 text-xs text-red-400">Could not submit — try again.</p>}
          <button disabled={state === "sending"} className="btn-brand mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {state === "sending" ? "Sending…" : (popup.ctaText || "Submit")}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function CookieBanner({ popup, onClose }: { popup: Popup; onClose: (track?: boolean) => void }) {
  function choose(accepted: boolean) {
    localStorage.setItem("cookie_consent", accepted ? "accepted" : "rejected");
    track(popup.id, accepted ? "conversion" : "dismiss");
    onClose(false);
  }
  return (
    <div className="glass-strong animate-fade-in-up fixed inset-x-0 bottom-0 z-100 border-t border-white/10 p-5">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-mist">{popup.content || "We use cookies to improve your experience."}</p>
        <div className="flex shrink-0 gap-3">
          <button onClick={() => choose(false)} className="glass rounded-lg px-4 py-2 text-sm font-medium text-fg transition-colors duration-200 ease-out hover:border-white/30">Reject</button>
          <button onClick={() => choose(true)} className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white">{popup.ctaText || "Accept"}</button>
        </div>
      </div>
    </div>
  );
}
