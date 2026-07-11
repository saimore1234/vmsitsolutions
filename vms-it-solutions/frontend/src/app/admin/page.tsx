"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Stats {
  cards: {
    totalLeads: number; newLeads: number; conversionRate: number; pageViews30d: number;
    blogViews: number; openJobs: number; pendingApplications: number; usersCount: number;
  };
  leadsBySource: { source: string; _count: number }[];
  leadsByStatus: { status: string; _count: number }[];
  topPages: { path: string; _count: number }[];
  leadTrend: { date: string; count: number }[];
  recentLeads: { id: string; name: string; company: string | null; kind: string; status: string; createdAt: string }[];
  recentActivity: { id: string; action: string; resource: string; createdAt: string; user: { firstName: string; lastName: string } | null }[];
  pipeline: {
    cards: { openPipelineValue: number; weightedForecast: number; wonRevenueTotal: number; wonRevenue30d: number; customersCount: number; quotationAcceptRate: number };
    stageFunnel: { stage: string; count: number }[];
    topOpenOpportunities: { id: string; title: string; company: string | null; stage: string; value: string | number | null; currency: string; probability: number }[];
  };
}

const STAGE_ORDER = ["qualification", "quotation", "negotiation", "won", "lost"];
const STAGE_STYLE: Record<string, string> = {
  qualification: "bg-cobalt/10 text-cobalt", quotation: "bg-amber-100 text-amber-700",
  negotiation: "bg-cyan-100 text-cyan-700", won: "bg-emerald-100 text-emerald-700", lost: "bg-slate-100 text-slate-500",
};
function money(n: number) {
  return `₹${Math.round(n).toLocaleString()}`;
}

function TrendChart({ points }: { points: { date: string; count: number }[] }) {
  const w = 560, h = 120, pad = 6;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = (w - pad * 2) / Math.max(1, points.length - 1);
  const y = (c: number) => h - pad - (c / max) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * step},${y(p.count)}`).join(" ");
  const area = `${path} L${pad + (points.length - 1) * step},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="Leads over the last 30 days">
      <path d={area} fill="#2d5bff" opacity="0.08" />
      <path d={path} fill="none" stroke="#2d5bff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/dashboard/stats").then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="font-mono-x text-xs uppercase tracking-widest text-slate-400">Loading dashboard…</p>;

  const cards = [
    { label: "Total leads", value: stats.cards.totalLeads },
    { label: "New leads", value: stats.cards.newLeads },
    { label: "Conversion rate", value: `${stats.cards.conversionRate}%` },
    { label: "Page views · 30d", value: stats.cards.pageViews30d },
    { label: "Blog views", value: stats.cards.blogViews },
    { label: "Open jobs", value: stats.cards.openJobs },
    { label: "New applications", value: stats.cards.pendingApplications },
    { label: "Active users", value: stats.cards.usersCount },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">What&apos;s happening across the site, CRM and hiring pipeline.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{c.label}</div>
            <div className="mt-2 font-display text-2xl font-semibold text-ink">{c.value}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Sales Pipeline</h2>
        <p className="mt-1 text-sm text-slate-500">Opportunities, quotations and revenue moving through the CRM funnel.</p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Open pipeline value", value: money(stats.pipeline.cards.openPipelineValue) },
          { label: "Weighted forecast", value: money(stats.pipeline.cards.weightedForecast) },
          { label: "Won revenue · 30d", value: money(stats.pipeline.cards.wonRevenue30d) },
          { label: "Quotation accept rate", value: `${stats.pipeline.cards.quotationAcceptRate}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{c.label}</div>
            <div className="mt-2 font-display text-2xl font-semibold text-ink">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Pipeline by stage</div>
          <ul className="mt-4 space-y-3">
            {STAGE_ORDER.map((stage) => {
              const entry = stats.pipeline.stageFunnel.find((s) => s.stage === stage);
              const count = entry?.count ?? 0;
              const max = Math.max(1, ...stats.pipeline.stageFunnel.map((s) => s.count));
              const pct = Math.round((count / max) * 100);
              return (
                <li key={stage}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span className={`rounded-full px-2 py-0.5 font-mono-x text-[10px] uppercase tracking-wider ${STAGE_STYLE[stage]}`}>{stage}</span>
                    <span>{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-cobalt" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Top open opportunities</div>
            <Link href="/admin/opportunities" className="text-xs font-medium text-cobalt hover:underline">View all →</Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {stats.pipeline.topOpenOpportunities.map((o) => (
              <li key={o.id} className="py-2.5 text-sm">
                <Link href={`/admin/opportunities/${o.id}`} className="flex items-center justify-between hover:text-cobalt">
                  <div>
                    <span className="font-medium text-ink">{o.title}</span>
                    {o.company && <span className="text-slate-400"> · {o.company}</span>}
                  </div>
                  <span className="text-slate-500">{o.value ? money(Number(o.value)) : "—"}</span>
                </Link>
              </li>
            ))}
            {!stats.pipeline.topOpenOpportunities.length && <li className="py-2 text-xs text-slate-400">No open opportunities yet.</li>}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Website &amp; Leads</h2>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Leads · last 30 days</div>
          <TrendChart points={stats.leadTrend} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Lead sources</div>
          <ul className="mt-4 space-y-3">
            {stats.leadsBySource.map((s) => {
              const total = stats.cards.totalLeads || 1;
              const pct = Math.round((s._count / total) * 100);
              return (
                <li key={s.source}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span className="capitalize">{s.source}</span><span>{s._count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-cobalt" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
            {!stats.leadsBySource.length && <li className="text-xs text-slate-400">No leads yet — they&apos;ll appear as website forms come in.</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Recent leads</div>
            <Link href="/admin/leads" className="text-xs font-medium text-cobalt hover:underline">Open CRM →</Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {stats.recentLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink">{l.name}</span>
                  {l.company && <span className="text-slate-400"> · {l.company}</span>}
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono-x text-[10px] uppercase tracking-wider text-slate-500">{l.status}</span>
              </li>
            ))}
            {!stats.recentLeads.length && <li className="py-2 text-xs text-slate-400">No leads yet.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Recent activity</div>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {stats.recentActivity.map((a) => (
              <li key={a.id} className="py-2.5 text-slate-600">
                <span className="font-medium text-ink">{a.user ? `${a.user.firstName} ${a.user.lastName}` : "System"}</span>
                {" "}{a.action} <span className="font-mono-x text-xs text-slate-400">{a.resource}</span>
              </li>
            ))}
            {!stats.recentActivity.length && <li className="py-2 text-xs text-slate-400">Activity will appear as your team works.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
