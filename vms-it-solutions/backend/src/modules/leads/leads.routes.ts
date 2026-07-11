import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { parsePageQuery, paged } from "../../utils/pagination";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { logActivity } from "../../middleware/activityLog";
import { sendMail } from "../../utils/mailer";
import { verifyRecaptcha } from "../../utils/recaptcha";

export const leadRoutes = Router();

const publicLeadSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Tell us your name"),
    email: z.string().email("Enter a valid email").optional(),
    phone: z.string().min(7).optional(),
    company: z.string().optional(),
    message: z.string().max(4000).optional(),
    kind: z.enum(["contact", "demo", "quote", "general"]).default("contact"),
    meta: z.record(z.unknown()).optional(),
    recaptchaToken: z.string().optional(),
  }).refine((d) => d.email || d.phone, { message: "Provide an email or phone number" }),
});

// Public: website forms (contact / demo / quote)
leadRoutes.post("/", publicFormLimiter, validate(publicLeadSchema), asyncHandler(async (req, res) => {
  const { recaptchaToken, ...body } = req.body;

  const recaptcha = await verifyRecaptcha(recaptchaToken);
  if (!recaptcha.ok) throw ApiError.badRequest(recaptcha.reason ?? "Verification failed — please try again");

  const commSettings = await prisma.communicationSetting.upsert({ where: { id: "communication" }, update: {}, create: { id: "communication" } });

  let lead: { id: string; kind: string; name: string; message: string | null } | null = null;
  if (commSettings.databaseSaveEnabled) {
    lead = await prisma.lead.create({
      data: {
        ...body,
        source: body.kind === "contact" ? "contact" : body.kind,
        meta: body.meta as never,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 300),
      },
    });

    // Notify every user who can manage leads
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { permissions: { some: { permission: { resource: "leads", action: { in: ["view", "manage"] } } } } } },
      select: { id: true },
    });
    if (managers.length) {
      await prisma.notification.createMany({
        data: managers.map((m: { id: string }) => ({ userId: m.id, title: `New ${lead!.kind} lead: ${lead!.name}`, kind: "lead", body: lead!.message ?? undefined })),
      });
    }
  }

  if (commSettings.emailEnabled && commSettings.notifyEmail) {
    const text = [
      "A new website enquiry has been submitted.",
      "",
      `Name: ${body.name}`,
      `Email: ${body.email ?? "—"}`,
      `Phone: ${body.phone ?? "—"}`,
      `Company: ${body.company ?? "—"}`,
      `Interested In: ${body.kind}`,
      `Message: ${body.message ?? "—"}`,
      "",
      "Submitted from: Website Contact Form",
    ].join("\n");
    sendMail({ to: commSettings.notifyEmail, subject: `New ${body.kind} enquiry: ${body.name}`, text }); // fire-and-forget; sendMail never rejects
  }

  res.status(201).json({ success: true, message: "Thanks — our team will reach out within one business day" });
}));

// Public: newsletter
leadRoutes.post("/newsletter", publicFormLimiter, asyncHandler(async (req, res) => {
  const email = z.string().email().parse(req.body.email);
  await prisma.newsletterSubscriber.upsert({ where: { email }, update: { isActive: true }, create: { email } });
  res.status(201).json({ success: true, message: "You're subscribed" });
}));

// ── Admin CRM ──
const adminLeadSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
    phone: z.string().min(7, "Enter a valid phone number").or(z.literal("")).optional(),
    company: z.string().optional(),
    message: z.string().max(4000).optional(),
    kind: z.enum(["contact", "demo", "quote", "general"]).default("general"),
    status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).default("new"),
    assignedToId: z.string().optional(),
  }).refine((d) => d.email || d.phone, { message: "Provide an email or phone number" }),
});

leadRoutes.post("/manual", requireAuth, authorize("leads:create"), validate(adminLeadSchema), asyncHandler(async (req, res) => {
  const { email, phone, assignedToId, ...rest } = req.body;
  const lead = await prisma.lead.create({
    data: { ...rest, email: email || undefined, phone: phone || undefined, assignedToId: assignedToId || undefined, source: "manual" },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
  });
  logActivity(req, "created", "leads", lead.id);
  res.status(201).json({ success: true, data: lead });
}));

leadRoutes.get("/", requireAuth, authorize("leads:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (q.search) where.OR = ["name", "email", "phone", "company"].map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.kind) where.kind = String(req.query.kind);
  if (req.query.assignedToId) where.assignedToId = String(req.query.assignedToId);

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip: q.skip, take: q.limit,
      orderBy: { [q.sortBy]: q.sortDir },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { remarks: true } } },
    }),
    prisma.lead.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

leadRoutes.get("/export", requireAuth, authorize("leads:export"), asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { firstName: true, lastName: true } } } });
  const header = "Name,Email,Phone,Company,Kind,Source,Status,Assigned To,Created At";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = leads.map((l: Record<string, unknown> & { createdAt: Date; assignedTo: { firstName: string; lastName: string } | null }) => [l.name, l.email, l.phone, l.company, l.kind, l.source, l.status,
    l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "", l.createdAt.toISOString()].map(esc).join(","));
  logActivity(req, "exported", "leads");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=leads-${Date.now()}.csv`);
  res.send([header, ...rows].join("\n"));
}));

leadRoutes.get("/:id", requireAuth, authorize("leads:view"), asyncHandler(async (req, res) => {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true } }, remarks: { orderBy: { createdAt: "desc" } } },
  });
  res.json({ success: true, data: lead });
}));

const updateLeadSchema = z.object({
  body: z.object({
    status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
    assignedToId: z.string().nullable().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
  }),
});

leadRoutes.patch("/:id", requireAuth, authorize("leads:edit"), validate(updateLeadSchema), asyncHandler(async (req, res) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { ...req.body, reminderAt: req.body.reminderAt ? new Date(req.body.reminderAt) : req.body.reminderAt },
  });
  logActivity(req, "updated", "leads", lead.id, { status: lead.status });
  res.json({ success: true, data: lead });
}));

leadRoutes.post("/:id/remarks", requireAuth, authorize("leads:edit"), asyncHandler(async (req, res) => {
  const content = z.string().min(1).parse(req.body.content);
  const remark = await prisma.leadRemark.create({ data: { leadId: req.params.id, authorId: req.auth!.sub, content } });
  res.status(201).json({ success: true, data: remark });
}));

leadRoutes.delete("/:id", requireAuth, authorize("leads:delete"), asyncHandler(async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "leads", req.params.id);
  res.json({ success: true, message: "Lead deleted" });
}));
