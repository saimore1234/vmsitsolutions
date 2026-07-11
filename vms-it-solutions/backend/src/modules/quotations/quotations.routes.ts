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

export const quotationRoutes = Router();

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
});
type QuotationItemInput = z.infer<typeof itemSchema>;

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") return (v as { toNumber: () => number }).toNumber();
  return Number(v);
}

const createSchema = z.object({
  body: z.object({
    opportunityId: z.string(),
    items: z.array(itemSchema).min(1, "Add at least one line item"),
    discount: z.number().nonnegative().default(0),
    tax: z.number().nonnegative().default(0),
    currency: z.string().optional(),
    validUntil: z.string().datetime().nullable().optional(),
    notes: z.string().optional(),
  }),
});

function computeTotals(items: { quantity: number; unitPrice: number }[], discount: number, tax: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal, total };
}

async function nextQuotationNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quotation.count({ where: { quotationNumber: { startsWith: `QTN-${year}-` } } });
  return `QTN-${year}-${String(count + 1).padStart(4, "0")}`;
}

const detailInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
  opportunity: { select: { id: true, title: true, company: true, stage: true } },
};

quotationRoutes.post("/", requireAuth, authorize("quotations:create"), validate(createSchema), asyncHandler(async (req, res) => {
  const { opportunityId, items, discount, tax, currency, validUntil, notes } = req.body;
  await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  const { subtotal, total } = computeTotals(items, discount, tax);

  const quotation = await prisma.quotation.create({
    data: {
      opportunityId,
      quotationNumber: await nextQuotationNumber(),
      subtotal, discount, tax, total,
      currency: currency || "INR",
      validUntil: validUntil ? new Date(validUntil) : undefined,
      notes,
      createdById: req.auth!.sub,
      items: { create: items.map((i: QuotationItemInput, idx: number) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.quantity * i.unitPrice, sortOrder: idx })) },
    },
    include: detailInclude,
  });
  logActivity(req, "created", "quotations", quotation.id, { opportunityId });
  res.status(201).json({ success: true, data: quotation });
}));

quotationRoutes.get("/", requireAuth, authorize("quotations:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (q.search) where.quotationNumber = { contains: q.search, mode: "insensitive" };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.opportunityId) where.opportunityId = String(req.query.opportunityId);

  const [items, total] = await Promise.all([
    prisma.quotation.findMany({ where, skip: q.skip, take: q.limit, orderBy: { [q.sortBy]: q.sortDir }, include: detailInclude }),
    prisma.quotation.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

quotationRoutes.get("/export", requireAuth, authorize("quotations:export"), asyncHandler(async (req, res) => {
  const rows = await prisma.quotation.findMany({ orderBy: { createdAt: "desc" }, include: { opportunity: { select: { title: true } } } });
  const header = "Number,Opportunity,Status,Subtotal,Discount,Tax,Total,Currency,Valid Until,Created At";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => [r.quotationNumber, r.opportunity.title, r.status, r.subtotal, r.discount, r.tax, r.total, r.currency,
    r.validUntil?.toISOString() ?? "", r.createdAt.toISOString()].map(esc).join(","));
  logActivity(req, "exported", "quotations");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=quotations-${Date.now()}.csv`);
  res.send([header, ...csv].join("\n"));
}));

quotationRoutes.get("/:id", requireAuth, authorize("quotations:view"), asyncHandler(async (req, res) => {
  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: req.params.id }, include: detailInclude });
  res.json({ success: true, data: quotation });
}));

const updateSchema = z.object({
  body: z.object({
    items: z.array(itemSchema).min(1).optional(),
    discount: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    validUntil: z.string().datetime().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

quotationRoutes.patch("/:id", requireAuth, authorize("quotations:edit"), validate(updateSchema), asyncHandler(async (req, res) => {
  const existing = await prisma.quotation.findUniqueOrThrow({ where: { id: req.params.id }, include: { items: true } });
  if (existing.status !== "draft") throw ApiError.badRequest("Only draft quotations can be edited");

  const { items, discount, tax, validUntil, notes } = req.body as {
    items?: QuotationItemInput[]; discount?: number; tax?: number; validUntil?: string | null; notes?: string | null;
  };
  const effectiveItems = (items ?? existing.items).map((i: { quantity: unknown; unitPrice: unknown }) => ({ quantity: toNum(i.quantity), unitPrice: toNum(i.unitPrice) }));
  const { subtotal, total } = computeTotals(effectiveItems, discount ?? toNum(existing.discount), tax ?? toNum(existing.tax));

  const quotation = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.quotationItem.deleteMany({ where: { quotationId: req.params.id } });
      await tx.quotationItem.createMany({
        data: items.map((i: QuotationItemInput, idx: number) => ({ quotationId: req.params.id, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.quantity * i.unitPrice, sortOrder: idx })),
      });
    }
    return tx.quotation.update({
      where: { id: req.params.id },
      data: {
        subtotal, total,
        discount: discount ?? undefined,
        tax: tax ?? undefined,
        validUntil: validUntil === undefined ? undefined : validUntil ? new Date(validUntil) : null,
        notes: notes === undefined ? undefined : notes,
      },
      include: detailInclude,
    });
  });
  logActivity(req, "updated", "quotations", quotation.id);
  res.json({ success: true, data: quotation });
}));

const statusSchema = z.object({ body: z.object({ status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]) }) });

quotationRoutes.patch("/:id/status", requireAuth, authorize("quotations:edit"), validate(statusSchema), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const existing = await prisma.quotation.findUniqueOrThrow({ where: { id: req.params.id } });

  const quotation = await prisma.quotation.update({
    where: { id: req.params.id },
    data: {
      status,
      sentAt: status === "sent" ? new Date() : existing.sentAt,
      respondedAt: status === "accepted" || status === "rejected" ? new Date() : existing.respondedAt,
    },
    include: detailInclude,
  });

  if (status === "accepted") {
    await prisma.opportunity.updateMany({
      where: { id: existing.opportunityId, stage: { in: ["qualification", "quotation"] } },
      data: { stage: "negotiation" },
    });
  }

  logActivity(req, "status_changed", "quotations", quotation.id, { status });
  res.json({ success: true, data: quotation });
}));

quotationRoutes.delete("/:id", requireAuth, authorize("quotations:delete"), asyncHandler(async (req, res) => {
  const existing = await prisma.quotation.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existing.status !== "draft") throw ApiError.badRequest("Only draft quotations can be deleted");
  await prisma.quotation.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "quotations", req.params.id);
  res.json({ success: true, message: "Quotation deleted" });
}));
