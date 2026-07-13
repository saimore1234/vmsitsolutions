import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
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
      <section className="relative py-14">
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i, idx) => (
              <Reveal key={i.id} delayMs={Math.min(idx, 5) * 60}>
                <div id={i.slug} className="glass scroll-mt-24 rounded-xl p-6 hover-glow hover:-translate-y-1">
                  <h2 className="font-display text-[17px] font-semibold text-fg">{i.name}</h2>
                  {i.description && <p className="mt-2 text-sm leading-relaxed text-haze">{i.description}</p>}
                </div>
              </Reveal>
            ))}
            {!items.length && <p className="text-sm text-haze">No industries published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
