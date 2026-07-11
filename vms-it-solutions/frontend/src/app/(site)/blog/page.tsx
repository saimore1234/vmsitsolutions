import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { publicGet } from "@/lib/api";

interface Blog {
  id: string; title: string; slug: string; excerpt: string | null; featuredImage: string | null;
  publishAt: string | null; author: { firstName: string; lastName: string } | null;
}

export const revalidate = 60;
export const metadata: Metadata = { title: "Blog" };

export default async function BlogListPage() {
  const { items } = await publicGet<{ items: Blog[] }>("/blogs?limit=50&sortBy=publishAt&sortDir=desc", { items: [] });

  return (
    <>
      <PageHero eyebrow="Blog" title="Notes from ERP implementations" subtitle="What we learn shipping ERPNext and SAP Business One for manufacturers and distributors." />
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <Link key={b.id} href={`/blog/${b.slug}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-cobalt/50 hover:shadow-lg hover:shadow-cobalt/5">
                {b.featuredImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.featuredImage} alt="" className="h-40 w-full object-cover" />
                )}
                <div className="p-5">
                  <h2 className="font-display text-base font-semibold text-ink group-hover:text-cobalt">{b.title}</h2>
                  {b.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{b.excerpt}</p>}
                  <div className="mt-4 font-mono-x text-[10px] uppercase tracking-widest text-slate-400">
                    {b.author && `${b.author.firstName} ${b.author.lastName} · `}
                    {b.publishAt && new Date(b.publishAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
            {!items.length && <p className="text-sm text-slate-400">No posts published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
