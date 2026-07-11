import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { publicGet } from "@/lib/api";

interface Industry { id: string; name: string; slug: string; description?: string | null }

export const revalidate = 60;
export const metadata: Metadata = { title: "Industries" };

export default async function IndustriesPage() {
  const { items } = await publicGet<{ items: Industry[] }>("/industries?limit=100&sortBy=sortOrder&sortDir=asc", { items: [] });

  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Built for how you actually operate"
        subtitle="Manufacturing, distribution and services companies — the processes, compliance and reporting each industry needs."
      />
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <div key={i.id} id={i.slug} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-[17px] font-semibold text-ink">{i.name}</h2>
                {i.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{i.description}</p>}
              </div>
            ))}
            {!items.length && <p className="text-sm text-slate-400">No industries published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
