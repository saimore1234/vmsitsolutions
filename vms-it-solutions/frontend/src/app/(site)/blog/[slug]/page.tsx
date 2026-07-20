import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { API_URL } from "@/lib/api";

interface Blog {
  id: string; title: string; content: string; featuredImage: string | null; publishAt: string | null;
  metaTitle: string | null; metaDescription: string | null;
  author: { firstName: string; lastName: string } | null;
  category: { name: string } | null;
  tags: { id: string; name: string }[];
}

async function getPost(slug: string): Promise<Blog | null> {
  try {
    const res = await fetch(`${API_URL}/blogs/public/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return { title: post.metaTitle ?? post.title, description: post.metaDescription ?? undefined };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="relative pb-14 pt-28">
      <div className="glow-orb -left-24 top-10 h-72 w-72 bg-iris/25" />
      <div className="relative mx-auto max-w-3xl px-5">
        <Link href="/blog" className="text-xs text-haze transition-colors duration-200 ease-out hover:text-fg">← Back to blog</Link>
        {post.category && <p className="eyebrow mt-6 text-aqua">{post.category.name}</p>}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{post.title}</h1>
        <div className="mt-4 font-mono-x text-[11px] uppercase tracking-widest text-haze">
          {post.author && `${post.author.firstName} ${post.author.lastName} · `}
          {post.publishAt && new Date(post.publishAt).toLocaleDateString()}
        </div>
        {post.featuredImage && (
          <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-xl">
            <Image src={post.featuredImage} alt={post.title} fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority />
          </div>
        )}
        <div className="glass prose prose-invert mt-8 max-w-none whitespace-pre-wrap rounded-xl p-6 text-[15px] leading-relaxed text-mist">{post.content}</div>
        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t.id} className="glass rounded-full px-3 py-1 text-xs text-haze">{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
