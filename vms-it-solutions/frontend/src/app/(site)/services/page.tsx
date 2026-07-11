import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { publicGet } from "@/lib/api";

interface Service { id: string; name: string; slug: string; shortDesc?: string | null; description?: string | null }

export const revalidate = 60;
export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { items } = await publicGet<{ items: Service[] }>("/services?limit=100&sortBy=sortOrder&sortDir=asc", { items: [] });

  return (
    <>
      <PageHero
        eyebrow="Services"
        title="From first workshop to years of support"
        subtitle="Implementation, customisation, data migration, integrations, managed support and hosting."
      />
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {items.map((s) => (
              <div key={s.id} id={s.slug} className="scroll-mt-24 flex gap-4 border-l-2 border-cobalt/30 pl-5">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">{s.name}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.description ?? s.shortDesc}</p>
                  <Link href="/contact" className="mt-2 inline-block text-sm font-semibold text-cobalt hover:text-cobalt-soft">
                    Talk to us →
                  </Link>
                </div>
              </div>
            ))}
            {!items.length && <p className="text-sm text-slate-400">No services published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
