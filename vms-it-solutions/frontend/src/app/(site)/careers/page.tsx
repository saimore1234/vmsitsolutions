import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { publicGet } from "@/lib/api";

interface Career {
  id: string; title: string; department: string | null; location: string | null;
  jobType: string; experience: string | null;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", remote: "Remote",
};

export const revalidate = 60;
export const metadata: Metadata = { title: "Careers" };

export default async function CareersPage() {
  const { items } = await publicGet<{ items: Career[] }>("/careers?limit=50", { items: [] });

  return (
    <>
      <PageHero eyebrow="Careers" title="Build ERP that manufacturers actually use" subtitle="Open roles across implementation, engineering and customer success." />
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-4xl px-5">
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {items.map((c) => (
              <Link key={c.id} href={`/careers/${c.id}`} className="group flex items-center justify-between gap-4 p-6 transition hover:bg-slate-50">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink group-hover:text-cobalt">{c.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {[c.department, c.location, JOB_TYPE_LABEL[c.jobType] ?? c.jobType, c.experience].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-cobalt">Apply →</span>
              </Link>
            ))}
            {!items.length && <p className="p-6 text-sm text-slate-400">No open roles right now — check back soon.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
