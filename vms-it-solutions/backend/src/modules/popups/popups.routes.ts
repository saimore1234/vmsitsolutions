import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { parsePageQuery, paged } from "../../utils/pagination";
import { logActivity } from "../../middleware/activityLog";
import { publicFormLimiter } from "../../middleware/rateLimit";

export const popupRoutes = Router();

const TYPES = ["announcement", "newsletter", "offer", "discount", "exit_intent", "lead_capture", "cookie_consent", "download_brochure", "book_demo", "whatsapp", "schedule"] as const;
const TRIGGERS = ["immediate", "delay", "scroll", "exit_intent"] as const;
const FREQUENCIES = ["always", "session", "day", "once"] as const;

const popupSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name is required"),
    type: z.enum(TYPES).default("announcement"),
    title: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    ctaText: z.string().optional().nullable(),
    ctaUrl: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    trigger: z.enum(TRIGGERS).default("delay"),
    delaySeconds: z.number().int().min(0).max(600).default(5),
    scrollPercent: z.number().int().min(0).max(100).default(50),
    frequency: z.enum(FREQUENCIES).default("session"),
    pageRules: z.array(z.string()).default([]),
    deviceRules: z.array(z.enum(["desktop", "mobile", "tablet"])).default([]),
    priority: z.number().int().min(0).max(100).default(0),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
  }),
});

type PopupBody = z.infer<typeof popupSchema>["body"];

function toData(body: PopupBody) {
  return {
    ...body,
    startAt: body.startAt ? new Date(body.startAt) : body.startAt === null ? null : undefined,
    endAt: body.endAt ? new Date(body.endAt) : body.endAt === null ? null : undefined,
  };
}

// ── Admin CRM ──
popupRoutes.get("/", requireAuth, authorize("popups:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (q.search) where.name = { contains: q.search, mode: "insensitive" };
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.isActive) where.isActive = req.query.isActive === "true";

  const [items, total] = await Promise.all([
    prisma.popup.findMany({ where, skip: q.skip, take: q.limit, orderBy: { [q.sortBy]: q.sortDir } }),
    prisma.popup.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

popupRoutes.get("/:id", requireAuth, authorize("popups:view"), asyncHandler(async (req, res) => {
  const popup = await prisma.popup.findUnique({ where: { id: req.params.id } });
  if (!popup) throw ApiError.notFound();
  res.json({ success: true, data: popup });
}));

popupRoutes.post("/", requireAuth, authorize("popups:create"), validate(popupSchema), asyncHandler(async (req, res) => {
  const popup = await prisma.popup.create({ data: toData(req.body) });
  logActivity(req, "created", "popups", popup.id);
  res.status(201).json({ success: true, data: popup });
}));

popupRoutes.patch("/:id", requireAuth, authorize("popups:edit"), validate(popupSchema), asyncHandler(async (req, res) => {
  const popup = await prisma.popup.update({ where: { id: req.params.id }, data: toData(req.body) });
  logActivity(req, "updated", "popups", popup.id);
  res.json({ success: true, data: popup });
}));

popupRoutes.delete("/:id", requireAuth, authorize("popups:delete"), asyncHandler(async (req, res) => {
  await prisma.popup.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "popups", req.params.id);
  res.json({ success: true, message: "Popup deleted" });
}));

// ── Public: popups eligible for the requesting page ──
// Device/trigger/frequency are evaluated client-side (the client knows real viewport & local storage);
// the server narrows down to active, in-schedule popups whose page rules match the requested path.
function pathMatches(rules: unknown, path: string): boolean {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  return rules.some((r) => {
    if (typeof r !== "string" || !r) return false;
    if (r === "*" || r === "all") return true;
    if (r.endsWith("*")) return path.startsWith(r.slice(0, -1));
    return r === path;
  });
}

popupRoutes.get("/public/active", asyncHandler(async (req, res) => {
  const path = String(req.query.path || "/");
  const now = new Date();
  const popups = await prisma.popup.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: { priority: "desc" },
  });
  const matching = popups.filter((p: { pageRules: unknown }) => pathMatches(p.pageRules, path));
  res.json({ success: true, data: matching });
}));

const trackSchema = z.object({
  body: z.object({ type: z.enum(["view", "dismiss", "conversion"]) }),
});

popupRoutes.post("/:id/track", publicFormLimiter, validate(trackSchema), asyncHandler(async (req, res) => {
  const field = req.body.type === "view" ? "views" : req.body.type === "dismiss" ? "dismissals" : "conversions";
  await prisma.popup.update({ where: { id: req.params.id }, data: { [field]: { increment: 1 } } }).catch(() => null);
  res.json({ success: true });
}));
