import Link from "next/link";
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
    <article className="bg-paper pb-20 pt-32">
      <div className="mx-auto max-w-3xl px-5">
        <Link href="/blog" className="text-xs text-slate-500 hover:text-cobalt">← Back to blog</Link>
        {post.category && <p className="eyebrow mt-6 text-cobalt">{post.category.name}</p>}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{post.title}</h1>
        <div className="mt-4 font-mono-x text-[11px] uppercase tracking-widest text-slate-400">
          {post.author && `${post.author.firstName} ${post.author.lastName} · `}
          {post.publishAt && new Date(post.publishAt).toLocaleDateString()}
        </div>
        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImage} alt="" className="mt-8 w-full rounded-xl object-cover" />
        )}
        <div className="prose mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{post.content}</div>
        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
