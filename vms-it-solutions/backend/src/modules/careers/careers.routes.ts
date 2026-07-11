import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { slugify } from "../../utils/slugify";
import { parsePageQuery, paged } from "../../utils/pagination";

export const careerRoutes = Router();

const jobBody = z.object({
  title: z.string().min(3), department: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  jobType: z.enum(["full_time", "part_time", "contract", "remote"]).optional(),
  experience: z.string().optional().nullable(), salaryRange: z.string().optional().nullable(),
  description: z.string().min(10), requirements: z.string().optional().nullable(),
  status: z.enum(["open", "closed"]).optional(),
});

const applySchema = z.object({
  body: z.object({
    careerId: z.string().min(1),
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    resumeUrl: z.string().optional(),
    coverNote: z.string().max(4000).optional(),
  }),
});

// Public: apply online
careerRoutes.post("/apply", publicFormLimiter, validate(applySchema), asyncHandler(async (req, res) => {
  const career = await prisma.career.findFirst({ where: { id: req.body.careerId, status: "open" } });
  if (!career) return res.status(404).json({ success: false, message: "This role is no longer open" });
  await prisma.application.create({ data: req.body });
  res.status(201).json({ success: true, message: "Application received — we'll be in touch" });
}));

// Admin: application tracking
careerRoutes.get("/applications", requireAuth, authorize("careers:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (req.query.careerId) where.careerId = String(req.query.careerId);
  if (req.query.status) where.status = String(req.query.status);
  if (q.search) where.OR = ["name", "email"].map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
  const [items, total] = await Promise.all([
    prisma.application.findMany({ where, include: { career: { select: { title: true } } }, orderBy: { createdAt: "desc" }, skip: q.skip, take: q.limit }),
    prisma.application.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

careerRoutes.patch("/applications/:id", requireAuth, authorize("careers:edit"), asyncHandler(async (req, res) => {
  const status = z.enum(["received", "screening", "interview", "offered", "rejected", "hired"]).optional().parse(req.body.status);
  const app = await prisma.application.update({
    where: { id: req.params.id },
    data: { status, remarks: req.body.remarks },
  });
  res.json({ success: true, data: app });
}));

careerRoutes.use("/", crudRouter({
  resource: "careers", model: prisma.career, searchFields: ["title", "department", "location"],
  publicRead: { status: "open" },
  include: { _count: { select: { applications: true } } },
  createSchema: z.object({ body: jobBody }), updateSchema: z.object({ body: jobBody.partial() }),
  beforeCreate: (b) => ({ ...b, slug: slugify(String(b.title)) }),
  beforeUpdate: (b) => (b.title ? { ...b, slug: slugify(String(b.title)) } : b),
}));
