import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
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
      <section className="relative py-14">
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((s, i) => (
              <Reveal key={s.id} delayMs={Math.min(i, 5) * 60}>
                <div id={s.slug} className="glass scroll-mt-24 flex gap-4 rounded-xl p-5 hover-glow hover:-translate-y-1">
                  <span className="btn-brand mt-1 h-2 w-2 shrink-0 rounded-full" />
                  <div>
                    <h2 className="font-display text-base font-semibold text-fg">{s.name}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-haze">{s.description ?? s.shortDesc}</p>
                    <Link href="/contact" className="mt-2 inline-block text-sm font-semibold text-aqua transition-colors duration-200 ease-out hover:text-fg">
                      Talk to us →
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
            {!items.length && <p className="text-sm text-haze">No services published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
