import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { slugify } from "../../utils/slugify";
import { logActivity } from "../../middleware/activityLog";
import { cacheGet, cacheSet, cacheDel } from "../../config/redis";

/** Dynamic page builder: pages are ordered lists of typed JSON sections. */
export const pageRoutes = Router();

const sectionSchema = z.object({
  id: z.string().optional(),
  kind: z.string().min(1),
  content: z.record(z.unknown()),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const pageSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    slug: z.string().optional(),
    status: z.enum(["draft", "published"]).default("draft"),
    isLanding: z.boolean().optional(),
    sections: z.array(sectionSchema).default([]),
  }),
});

// Public: render a published page by slug (cached)
pageRoutes.get("/public/:slug", asyncHandler(async (req, res) => {
  const key = `pages:public:${req.params.slug}`;
  const cached = await cacheGet(key);
  if (cached) return res.json({ success: true, data: cached });
  const page = await prisma.page.findFirst({
    where: { slug: req.params.slug, status: "published" },
    include: { sections: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, seo: true },
  });
  if (!page) throw ApiError.notFound("Page not found");
  await cacheSet(key, page, 120);
  res.json({ success: true, data: page });
}));

pageRoutes.use(requireAuth);

pageRoutes.get("/", authorize("pages:view"), asyncHandler(async (_req, res) => {
  const pages = await prisma.page.findMany({
    include: { _count: { select: { sections: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ success: true, data: pages });
}));

pageRoutes.get("/:id", authorize("pages:view"), asyncHandler(async (req, res) => {
  const page = await prisma.page.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { sections: { orderBy: { sortOrder: "asc" } }, seo: true },
  });
  res.json({ success: true, data: page });
}));

pageRoutes.post("/", authorize("pages:create"), validate(pageSchema), asyncHandler(async (req, res) => {
  const { sections, ...rest } = req.body;
  const page = await prisma.page.create({
    data: {
      ...rest,
      slug: rest.slug ? slugify(rest.slug) : slugify(rest.title),
      sections: { create: sections.map((s: z.infer<typeof sectionSchema>, i: number) => ({ kind: s.kind, content: s.content as never, sortOrder: s.sortOrder ?? i, isActive: s.isActive })) },
    },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  logActivity(req, "created", "pages", page.id);
  res.status(201).json({ success: true, data: page });
}));

pageRoutes.patch("/:id", authorize("pages:edit"), validate(pageSchema), asyncHandler(async (req, res) => {
  const { sections, ...rest } = req.body;
  const page = await prisma.$transaction(async (tx) => {
    await tx.pageSection.deleteMany({ where: { pageId: req.params.id } });
    return tx.page.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        slug: rest.slug ? slugify(rest.slug) : undefined,
        sections: { create: sections.map((s: z.infer<typeof sectionSchema>, i: number) => ({ kind: s.kind, content: s.content as never, sortOrder: s.sortOrder ?? i, isActive: s.isActive })) },
      },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
  });
  await cacheDel("pages*");
  logActivity(req, "updated", "pages", page.id);
  res.json({ success: true, data: page });
}));

pageRoutes.delete("/:id", authorize("pages:delete"), asyncHandler(async (req, res) => {
  await prisma.page.delete({ where: { id: req.params.id } });
  await cacheDel("pages*");
  logActivity(req, "deleted", "pages", req.params.id);
  res.json({ success: true, message: "Page deleted" });
}));
