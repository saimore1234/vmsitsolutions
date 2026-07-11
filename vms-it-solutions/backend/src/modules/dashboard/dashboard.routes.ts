import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { publicFormLimiter } from "../../middleware/rateLimit";

export const dashboardRoutes = Router();

// Public: lightweight page-view beacon for the analytics dashboard
dashboardRoutes.post("/track", publicFormLimiter, asyncHandler(async (req, res) => {
  const path = String(req.body.path ?? "/").slice(0, 300);
  await prisma.pageView.create({
    data: { path, referrer: req.body.referrer?.slice(0, 300), ip: req.ip, userAgent: req.headers["user-agent"]?.slice(0, 300) },
  });
  res.status(204).end();
}));

dashboardRoutes.get("/stats", requireAuth, authorize("dashboard:view"), asyncHandler(async (_req, res) => {
  const since30d = new Date(Date.now() - 30 * 86_400_000);
  const OPEN_STAGES = ["qualification", "quotation", "negotiation"] as const;

  const [
    totalLeads, newLeads, wonLeads, leadsBySource, leadsByStatus,
    pageViews30d, topPages, blogViews, openJobs, pendingApplications,
    recentLeads, recentActivity, usersCount,
    opportunitiesByStage, openOpportunities, wonRevenueTotal, wonRevenue30d,
    customersCount, quotationsSentCount, quotationsAcceptedCount, topOpenOpportunities,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "new" } }),
    prisma.lead.count({ where: { status: "won" } }),
    prisma.lead.groupBy({ by: ["source"], _count: true }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.pageView.count({ where: { createdAt: { gte: since30d } } }),
    prisma.pageView.groupBy({ by: ["path"], _count: true, orderBy: { _count: { path: "desc" } }, take: 8, where: { createdAt: { gte: since30d } } }),
    prisma.blog.aggregate({ _sum: { views: true } }),
    prisma.career.count({ where: { status: "open" } }),
    prisma.application.count({ where: { status: "received" } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, company: true, kind: true, status: true, createdAt: true } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { firstName: true, lastName: true } } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.opportunity.groupBy({ by: ["stage"], _count: true }),
    prisma.opportunity.findMany({ where: { stage: { in: [...OPEN_STAGES] } }, select: { value: true, probability: true } }),
    prisma.quotation.aggregate({ where: { status: "accepted" }, _sum: { total: true } }),
    prisma.quotation.aggregate({ where: { status: "accepted", respondedAt: { gte: since30d } }, _sum: { total: true } }),
    prisma.customer.count(),
    prisma.quotation.count({ where: { status: { in: ["sent", "accepted", "rejected"] } } }),
    prisma.quotation.count({ where: { status: "accepted" } }),
    prisma.opportunity.findMany({
      where: { stage: { in: [...OPEN_STAGES] } }, orderBy: { value: "desc" }, take: 6,
      select: { id: true, title: true, company: true, stage: true, value: true, currency: true, probability: true },
    }),
  ]);

  const openPipelineValue = openOpportunities.reduce((sum, o) => sum + Number(o.value ?? 0), 0);
  const weightedForecast = openOpportunities.reduce((sum, o) => sum + Number(o.value ?? 0) * (o.probability / 100), 0);
  const quotationAcceptRate = quotationsSentCount ? Math.round((quotationsAcceptedCount / quotationsSentCount) * 1000) / 10 : 0;

  // Daily lead trend for the last 30 days
  const leads30d = await prisma.lead.findMany({ where: { createdAt: { gte: since30d } }, select: { createdAt: true } });
  const trend: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) trend[new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)] = 0;
  for (const l of leads30d) {
    const day = l.createdAt.toISOString().slice(0, 10);
    if (day in trend) trend[day]++;
  }

  const conversionRate = totalLeads ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      cards: { totalLeads, newLeads, conversionRate, pageViews30d, blogViews: blogViews._sum.views ?? 0, openJobs, pendingApplications, usersCount },
      leadsBySource, leadsByStatus, topPages,
      leadTrend: Object.entries(trend).map(([date, count]) => ({ date, count })),
      recentLeads, recentActivity,
      pipeline: {
        cards: {
          openPipelineValue, weightedForecast,
          wonRevenueTotal: Number(wonRevenueTotal._sum.total ?? 0),
          wonRevenue30d: Number(wonRevenue30d._sum.total ?? 0),
          customersCount, quotationAcceptRate,
        },
        stageFunnel: opportunitiesByStage.map((s) => ({ stage: s.stage, count: s._count })),
        topOpenOpportunities,
      },
    },
  });
}));

// Logs viewers
dashboardRoutes.get("/logs/activity", requireAuth, authorize("logs:view"), asyncHandler(async (req, res) => {
  const take = Math.min(200, Number(req.query.limit) || 50);
  const logs = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: { select: { firstName: true, lastName: true, email: true } } } });
  res.json({ success: true, data: logs });
}));

dashboardRoutes.get("/logs/login", requireAuth, authorize("logs:view"), asyncHandler(async (req, res) => {
  const take = Math.min(200, Number(req.query.limit) || 50);
  res.json({ success: true, data: await prisma.loginLog.findMany({ orderBy: { createdAt: "desc" }, take }) });
}));

dashboardRoutes.get("/logs/errors", requireAuth, authorize("logs:view"), asyncHandler(async (req, res) => {
  const take = Math.min(200, Number(req.query.limit) || 50);
  res.json({ success: true, data: await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take }) });
}));

// Notifications for the signed-in user
dashboardRoutes.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.auth!.sub }, orderBy: { createdAt: "desc" }, take: 30 });
  res.json({ success: true, data: items });
}));
dashboardRoutes.post("/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.auth!.sub, readAt: null }, data: { readAt: new Date() } });
  res.json({ success: true });
}));
