import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
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
      <section className="relative py-14">
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b, i) => (
              <Reveal key={b.id} delayMs={Math.min(i, 5) * 60}>
                <Link href={`/blog/${b.slug}`} className="group glass block overflow-hidden rounded-xl hover-glow hover:-translate-y-1">
                  {b.featuredImage && (
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image
                        src={b.featuredImage}
                        alt={b.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="font-display text-base font-semibold text-fg transition-colors group-hover:text-gradient">{b.title}</h2>
                    {b.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-haze">{b.excerpt}</p>}
                    <div className="mt-4 font-mono-x text-[10px] uppercase tracking-widest text-haze/70">
                      {b.author && `${b.author.firstName} ${b.author.lastName} · `}
                      {b.publishAt && new Date(b.publishAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
            {!items.length && <p className="text-sm text-haze">No posts published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
