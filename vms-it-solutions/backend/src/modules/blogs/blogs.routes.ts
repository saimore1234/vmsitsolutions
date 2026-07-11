import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";
import { asyncHandler } from "../../utils/asyncHandler";
import { slugify } from "../../utils/slugify";
import { ApiError } from "../../utils/ApiError";

const blogBody = z.object({
  title: z.string().min(3),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  featuredImage: z.string().optional().nullable(),
  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
  publishAt: z.string().datetime().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
});

function toPrisma(body: Record<string, unknown>, authorId?: string) {
  const { tagIds, publishAt, ...rest } = body as z.infer<typeof blogBody> & { tagIds?: string[] };
  return {
    ...rest,
    ...(authorId ? { authorId } : {}),
    slug: slugify(String(rest.title ?? "")) || undefined,
    publishAt: publishAt ? new Date(publishAt) : rest.status === "published" ? new Date() : null,
    ...(tagIds ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}),
  };
}

export const blogRoutes = Router();

// Public: published posts by slug
blogRoutes.get("/public/:slug", asyncHandler(async (req, res) => {
  const blog = await prisma.blog.findFirst({
    where: { slug: req.params.slug, status: "published", publishAt: { lte: new Date() } },
    include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } }, category: true, tags: true },
  });
  if (!blog) throw ApiError.notFound("Post not found");
  await prisma.blog.update({ where: { id: blog.id }, data: { views: { increment: 1 } } });
  res.json({ success: true, data: blog });
}));

blogRoutes.use("/categories", crudRouter({
  resource: "blogs", model: prisma.blogCategory, searchFields: ["name"], defaultSort: "name", publicRead: true,
  beforeCreate: (b) => ({ ...b, slug: slugify(String(b.name)) }),
  beforeUpdate: (b) => (b.name ? { ...b, slug: slugify(String(b.name)) } : b),
}));

blogRoutes.use("/tags", crudRouter({
  resource: "blogs", model: prisma.blogTag, searchFields: ["name"], defaultSort: "name", publicRead: true,
  beforeCreate: (b) => ({ ...b, slug: slugify(String(b.name)) }),
}));

blogRoutes.use("/", crudRouter({
  resource: "blogs",
  model: prisma.blog,
  searchFields: ["title", "excerpt"],
  include: { author: { select: { firstName: true, lastName: true } }, category: true, tags: true },
  publicRead: { status: "published", publishAt: { lte: new Date() } },
  createSchema: z.object({ body: blogBody }),
  updateSchema: z.object({ body: blogBody.partial() }),
  beforeCreate: (b, req) => toPrisma(b, req.auth!.sub),
  beforeUpdate: (b) => toPrisma(b),
}));
