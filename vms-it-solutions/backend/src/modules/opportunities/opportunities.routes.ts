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

export const opportunityRoutes = Router();

const assigneeSelect = { id: true, firstName: true, lastName: true } as const;
const listInclude = {
  lead: { select: { id: true, name: true } },
  assignedTo: { select: assigneeSelect },
  _count: { select: { quotations: true, remarks: true } },
};
const detailInclude = {
  lead: { select: { id: true, name: true, email: true, phone: true } },
  assignedTo: { select: assigneeSelect },
  remarks: { orderBy: { createdAt: "desc" as const } },
  quotations: { orderBy: { createdAt: "desc" as const } },
  customer: { select: { id: true, companyName: true } },
};

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title is required"),
    leadId: z.string().optional(),
    company: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().or(z.literal("")).optional(),
    contactPhone: z.string().optional(),
    value: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.string().datetime().nullable().optional(),
    assignedToId: z.string().optional(),
  }),
});

opportunityRoutes.post("/", requireAuth, authorize("opportunities:create"), validate(createSchema), asyncHandler(async (req, res) => {
  const { contactEmail, expectedCloseDate, ...rest } = req.body;
  const opportunity = await prisma.opportunity.create({
    data: {
      ...rest,
      contactEmail: contactEmail || undefined,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    },
    include: listInclude,
  });
  logActivity(req, "created", "opportunities", opportunity.id);
  res.status(201).json({ success: true, data: opportunity });
}));

opportunityRoutes.get("/", requireAuth, authorize("opportunities:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (q.search) where.OR = ["title", "company", "contactName", "contactEmail"].map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
  if (req.query.stage) where.stage = String(req.query.stage);
  if (req.query.assignedToId) where.assignedToId = String(req.query.assignedToId);
  if (req.query.leadId) where.leadId = String(req.query.leadId);

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({ where, skip: q.skip, take: q.limit, orderBy: { [q.sortBy]: q.sortDir }, include: listInclude }),
    prisma.opportunity.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

opportunityRoutes.get("/export", requireAuth, authorize("opportunities:export"), asyncHandler(async (req, res) => {
  const rows = await prisma.opportunity.findMany({ orderBy: { createdAt: "desc" }, include: { assignedTo: { select: assigneeSelect } } });
  const header = "Title,Company,Contact,Stage,Value,Currency,Probability,Expected Close,Assigned To,Created At";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((o) => [o.title, o.company, o.contactName, o.stage, o.value, o.currency, o.probability,
    o.expectedCloseDate?.toISOString() ?? "", o.assignedTo ? `${o.assignedTo.firstName} ${o.assignedTo.lastName}` : "", o.createdAt.toISOString()].map(esc).join(","));
  logActivity(req, "exported", "opportunities");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=opportunities-${Date.now()}.csv`);
  res.send([header, ...csv].join("\n"));
}));

opportunityRoutes.get("/:id", requireAuth, authorize("opportunities:view"), asyncHandler(async (req, res) => {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: req.params.id }, include: detailInclude });
  res.json({ success: true, data: opportunity });
}));

opportunityRoutes.get("/:id/timeline", requireAuth, authorize("opportunities:view"), asyncHandler(async (req, res) => {
  const entries = await prisma.activityLog.findMany({
    where: { resource: "opportunities", resourceId: req.params.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: assigneeSelect } },
  });
  res.json({ success: true, data: entries });
}));

const updateSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    company: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    contactEmail: z.string().email().or(z.literal("")).nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    value: z.number().nonnegative().nullable().optional(),
    currency: z.string().optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.string().datetime().nullable().optional(),
    assignedToId: z.string().nullable().optional(),
  }),
});

opportunityRoutes.patch("/:id", requireAuth, authorize("opportunities:edit"), validate(updateSchema), asyncHandler(async (req, res) => {
  const { expectedCloseDate, ...rest } = req.body;
  const opportunity = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: { ...rest, expectedCloseDate: expectedCloseDate === undefined ? undefined : expectedCloseDate ? new Date(expectedCloseDate) : null },
    include: listInclude,
  });
  logActivity(req, "updated", "opportunities", opportunity.id);
  res.json({ success: true, data: opportunity });
}));

const stageSchema = z.object({
  body: z.object({
    stage: z.enum(["qualification", "quotation", "negotiation", "won", "lost"]),
    lostReason: z.string().optional(),
  }),
});

opportunityRoutes.patch("/:id/stage", requireAuth, authorize("opportunities:edit"), validate(stageSchema), asyncHandler(async (req, res) => {
  const { stage, lostReason } = req.body;
  if (stage === "lost" && !lostReason) throw ApiError.badRequest("A reason is required when marking an opportunity as lost");

  const opportunity = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: {
      stage,
      lostReason: stage === "lost" ? lostReason : null,
      wonAt: stage === "won" ? new Date() : stage === "lost" ? null : undefined,
    },
    include: listInclude,
  });
  logActivity(req, "stage_changed", "opportunities", opportunity.id, { stage });
  res.json({ success: true, data: opportunity });
}));

opportunityRoutes.post("/:id/remarks", requireAuth, authorize("opportunities:edit"), asyncHandler(async (req, res) => {
  const content = z.string().min(1).parse(req.body.content);
  const remark = await prisma.opportunityRemark.create({ data: { opportunityId: req.params.id, authorId: req.auth!.sub, content } });
  res.status(201).json({ success: true, data: remark });
}));

opportunityRoutes.post("/:id/convert-to-customer", requireAuth, authorize("customers:create", "opportunities:edit"), asyncHandler(async (req, res) => {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: req.params.id }, include: { customer: true } });
  if (opportunity.customer) throw ApiError.conflict("This opportunity has already been converted to a customer");
  if (!opportunity.company && !opportunity.contactName) throw ApiError.badRequest("Add a company or contact name before converting to a customer");

  const [customer] = await prisma.$transaction([
    prisma.customer.create({
      data: {
        opportunityId: opportunity.id,
        companyName: opportunity.company || opportunity.contactName || opportunity.title,
        contactName: opportunity.contactName,
        email: opportunity.contactEmail,
        phone: opportunity.contactPhone,
      },
    }),
    prisma.opportunity.update({ where: { id: opportunity.id }, data: { stage: "won", wonAt: opportunity.wonAt ?? new Date() } }),
  ]);
  logActivity(req, "converted", "opportunities", opportunity.id, { customerId: customer.id });
  logActivity(req, "created", "customers", customer.id, { fromOpportunityId: opportunity.id });
  res.status(201).json({ success: true, data: customer });
}));

opportunityRoutes.delete("/:id", requireAuth, authorize("opportunities:delete"), asyncHandler(async (req, res) => {
  await prisma.opportunity.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "opportunities", req.params.id);
  res.json({ success: true, message: "Opportunity deleted" });
}));
