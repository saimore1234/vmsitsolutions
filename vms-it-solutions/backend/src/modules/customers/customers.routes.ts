import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { logActivity } from "../../middleware/activityLog";
import { parsePageQuery, paged } from "../../utils/pagination";

export const customerRoutes = Router();

const managerSelect = { id: true, firstName: true, lastName: true } as const;
const listInclude = {
  accountManager: { select: managerSelect },
  _count: { select: { crmProjects: true, supportTickets: true, amcContracts: true } },
};
const detailInclude = {
  opportunity: { select: { id: true, title: true, stage: true } },
  accountManager: { select: managerSelect },
  crmProjects: { orderBy: { createdAt: "desc" as const } },
  supportTickets: { orderBy: { createdAt: "desc" as const } },
  amcContracts: { orderBy: { createdAt: "desc" as const } },
};

const bodySchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  accountManagerId: z.string().optional(),
  status: z.enum(["active", "inactive", "churned"]).optional(),
});

customerRoutes.post("/", requireAuth, authorize("customers:create"), validate(z.object({ body: bodySchema })), asyncHandler(async (req, res) => {
  const { email, ...rest } = req.body;
  const customer = await prisma.customer.create({ data: { ...rest, email: email || undefined }, include: listInclude });
  logActivity(req, "created", "customers", customer.id);
  res.status(201).json({ success: true, data: customer });
}));

customerRoutes.get("/", requireAuth, authorize("customers:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (q.search) where.OR = ["companyName", "contactName", "email", "phone"].map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.accountManagerId) where.accountManagerId = String(req.query.accountManagerId);

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, skip: q.skip, take: q.limit, orderBy: { [q.sortBy]: q.sortDir }, include: listInclude }),
    prisma.customer.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

customerRoutes.get("/export", requireAuth, authorize("customers:export"), asyncHandler(async (req, res) => {
  const rows = await prisma.customer.findMany({ orderBy: { createdAt: "desc" }, include: { accountManager: { select: managerSelect } } });
  const header = "Company,Contact,Email,Phone,Status,GST,Account Manager,Converted At";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((c) => [c.companyName, c.contactName, c.email, c.phone, c.status, c.gstNumber,
    c.accountManager ? `${c.accountManager.firstName} ${c.accountManager.lastName}` : "", c.convertedAt.toISOString()].map(esc).join(","));
  logActivity(req, "exported", "customers");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=customers-${Date.now()}.csv`);
  res.send([header, ...csv].join("\n"));
}));

customerRoutes.get("/:id", requireAuth, authorize("customers:view"), asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: req.params.id }, include: detailInclude });
  res.json({ success: true, data: customer });
}));

customerRoutes.get("/:id/dashboard", requireAuth, authorize("customers:view"), asyncHandler(async (req, res) => {
  const customerId = req.params.id;
  const [projectCounts, ticketCounts, amcCounts, quotationTotal] = await Promise.all([
    prisma.crmProject.groupBy({ by: ["status"], where: { customerId }, _count: true }),
    prisma.supportTicket.groupBy({ by: ["status"], where: { customerId }, _count: true }),
    prisma.amcContract.groupBy({ by: ["status"], where: { customerId }, _count: true }),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { opportunity: { select: { quotations: { where: { status: "accepted" }, select: { total: true, currency: true } } } } },
    }),
  ]);
  const wonValue = quotationTotal?.opportunity?.quotations.reduce((sum, q) => sum + Number(q.total), 0) ?? 0;
  res.json({
    success: true,
    data: {
      projects: projectCounts.reduce((acc, c) => ({ ...acc, [c.status]: c._count }), {} as Record<string, number>),
      supportTickets: ticketCounts.reduce((acc, c) => ({ ...acc, [c.status]: c._count }), {} as Record<string, number>),
      amcContracts: amcCounts.reduce((acc, c) => ({ ...acc, [c.status]: c._count }), {} as Record<string, number>),
      wonQuotationValue: wonValue,
    },
  });
}));

customerRoutes.get("/:id/timeline", requireAuth, authorize("customers:view"), asyncHandler(async (req, res) => {
  const entries = await prisma.activityLog.findMany({
    where: { resource: "customers", resourceId: req.params.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: managerSelect } },
  });
  res.json({ success: true, data: entries });
}));

customerRoutes.patch("/:id", requireAuth, authorize("customers:edit"), validate(z.object({ body: bodySchema.partial() })), asyncHandler(async (req, res) => {
  const { email, ...rest } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { ...rest, email: email === undefined ? undefined : email || null },
    include: listInclude,
  });
  logActivity(req, "updated", "customers", customer.id);
  res.json({ success: true, data: customer });
}));

customerRoutes.delete("/:id", requireAuth, authorize("customers:delete"), asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "customers", req.params.id);
  res.json({ success: true, message: "Customer deleted" });
}));
