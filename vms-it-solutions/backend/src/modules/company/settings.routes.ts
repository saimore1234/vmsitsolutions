import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { cacheGet, cacheSet, cacheDel } from "../../config/redis";
import { logActivity } from "../../middleware/activityLog";

/**
 * Singleton settings (company, website, theme, smtp) + logos + social links.
 * Public GET /public returns everything the storefront needs in one cached call.
 */
export const settingsRoutes = Router();

settingsRoutes.get("/public", asyncHandler(async (_req, res) => {
  const cached = await cacheGet("settings:public");
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [company, theme, website, logos, logoSetting, communicationRaw, socialLinks, headerMenu, footerMenu] = await Promise.all([
    prisma.companySetting.findUnique({ where: { id: "company" } }),
    prisma.themeSetting.findUnique({ where: { id: "theme" } }),
    prisma.websiteSetting.findUnique({ where: { id: "website" } }),
    prisma.logo.findMany(),
    prisma.logoSetting.findUnique({ where: { id: "logo" } }),
    prisma.communicationSetting.findUnique({ where: { id: "communication" } }),
    prisma.socialLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.menu.findUnique({ where: { name: "header" }, include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
    prisma.menu.findUnique({ where: { name: "footer" }, include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
  ]);
  // Only expose the fields the public contact form actually needs — never the reCAPTCHA secret key.
  const communication = communicationRaw && {
    whatsappNumber: communicationRaw.whatsappNumber,
    whatsappDefaultMessage: communicationRaw.whatsappDefaultMessage,
    whatsappEnabled: communicationRaw.whatsappEnabled,
    autoRedirectEnabled: communicationRaw.autoRedirectEnabled,
    thankYouPageEnabled: communicationRaw.thankYouPageEnabled,
    recaptchaEnabled: communicationRaw.recaptchaEnabled,
    recaptchaSiteKey: communicationRaw.recaptchaSiteKey,
  };
  const data = { company, theme, website, logos, logoSetting, communication, socialLinks, menus: { header: headerMenu?.items ?? [], footer: footerMenu?.items ?? [] } };
  await cacheSet("settings:public", data, 120);
  res.json({ success: true, data });
}));

function singleton(model: "companySetting" | "websiteSetting" | "themeSetting" | "smtpSetting" | "communicationSetting", id: string, resource: string) {
  const r = Router();
  const delegate = prisma[model] as unknown as {
    findUnique: (a: unknown) => Promise<unknown>;
    upsert: (a: unknown) => Promise<unknown>;
  };
  r.get("/", requireAuth, authorize(`${resource}:view`, "settings:view"), asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await delegate.findUnique({ where: { id } }) });
  }));
  r.patch("/", requireAuth, authorize(`${resource}:edit`, "settings:edit"), asyncHandler(async (req, res) => {
    const { id: _ignore, updatedAt: _u, ...data } = req.body ?? {};
    const saved = await delegate.upsert({ where: { id }, update: data, create: { id, ...data } });
    logActivity(req, "updated", resource);
    await cacheDel("settings*");
    res.json({ success: true, data: saved });
  }));
  return r;
}

settingsRoutes.use("/company", singleton("companySetting", "company", "settings"));
settingsRoutes.use("/website", singleton("websiteSetting", "website", "settings"));
settingsRoutes.use("/theme", singleton("themeSetting", "theme", "settings"));
settingsRoutes.use("/smtp", singleton("smtpSetting", "smtp", "settings"));
settingsRoutes.use("/communication", singleton("communicationSetting", "communication", "settings"));

// Logos: upsert by kind
settingsRoutes.get("/logos", requireAuth, authorize("settings:view"), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await prisma.logo.findMany() });
}));
settingsRoutes.put("/logos/:kind", requireAuth, authorize("settings:edit"), asyncHandler(async (req, res) => {
  const logo = await prisma.logo.upsert({
    where: { kind: req.params.kind },
    update: { url: req.body.url },
    create: { kind: req.params.kind, url: req.body.url },
  });
  await cacheDel("settings*");
  logActivity(req, "updated", "logos", logo.id);
  res.json({ success: true, data: logo });
}));

// Social links
settingsRoutes.get("/social", requireAuth, authorize("settings:view"), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await prisma.socialLink.findMany({ orderBy: { sortOrder: "asc" } }) });
}));
settingsRoutes.put("/social/:platform", requireAuth, authorize("settings:edit"), asyncHandler(async (req, res) => {
  const link = await prisma.socialLink.upsert({
    where: { platform: req.params.platform },
    update: { url: req.body.url, isActive: req.body.isActive ?? true },
    create: { platform: req.params.platform, url: req.body.url },
  });
  await cacheDel("settings*");
  res.json({ success: true, data: link });
}));
