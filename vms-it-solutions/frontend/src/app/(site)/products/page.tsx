import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { publicGet } from "@/lib/api";

interface Product { id: string; name: string; slug: string; shortDesc?: string | null; description?: string | null }

export const revalidate = 60;
export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { items } = await publicGet<{ items: Product[] }>("/products?limit=100&sortBy=sortOrder&sortDir=asc", { items: [] });

  return (
    <>
      <PageHero
        eyebrow="Products"
        title="The modules your operation actually runs on"
        subtitle="ERPNext and SAP Business One modules, implemented, customised and supported end to end."
      />
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <Reveal key={p.id} delayMs={Math.min(i, 5) * 60}>
                <div id={p.slug} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-cobalt/50 hover:shadow-lg hover:shadow-cobalt/5">
                  <h2 className="font-display text-[17px] font-semibold text-ink">{p.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.description ?? p.shortDesc}</p>
                  <Link href="/book-demo" className="mt-4 inline-block text-sm font-semibold text-cobalt transition-colors duration-200 ease-out hover:text-cobalt-soft">
                    Book a demo →
                  </Link>
                </div>
              </Reveal>
            ))}
            {!items.length && <p className="text-sm text-slate-400">No products published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
