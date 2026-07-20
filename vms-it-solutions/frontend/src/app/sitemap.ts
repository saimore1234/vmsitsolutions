import type { MetadataRoute } from "next";
import { publicGet } from "@/lib/api";

const SITE_URL = "https://www.vmsitsolutions.me";

const STATIC_ROUTES = [
  "", "about", "services", "products", "industries", "careers", "blog",
  "contact", "book-demo", "privacy", "terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items: blogs }, { items: careers }] = await Promise.all([
    publicGet<{ items: { slug: string; updatedAt?: string }[] }>("/blogs?limit=200", { items: [] }),
    publicGet<{ items: { id: string; updatedAt?: string }[] }>("/careers?limit=200", { items: [] }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogs.map((b) => ({
    url: `${SITE_URL}/blog/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const careerEntries: MetadataRoute.Sitemap = careers.map((c) => ({
    url: `${SITE_URL}/careers/${c.id}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticEntries, ...blogEntries, ...careerEntries];
}
