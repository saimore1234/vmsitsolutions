import { Router } from "express";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { cacheDel } from "../../config/redis";
import { logActivity } from "../../middleware/activityLog";
import { randomFileName, uploadToStorage, deleteFromStorage, storageKeyFromUrl } from "../../utils/storage";

export const brandingRoutes = Router();

export const LOGO_KINDS = [
  "primary", "dark", "light", "favicon", "login", "dashboard", "sidebar", "mobile",
  "footer", "email", "invoice", "quotation", "letterhead", "watermark", "loader",
  "og_image", "default_banner", "default_thumbnail",
] as const;

const RASTER_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_MIME: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
  "image/svg+xml": ".svg", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // hard ceiling; the admin-configured soft limit is checked after accept
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) return cb(new Error("Unsupported image format — use PNG, JPG, SVG, WEBP or ICO"));
    cb(null, true);
  },
});

async function deleteQuiet(url: string | null | undefined) {
  if (!url) return;
  await deleteFromStorage(storageKeyFromUrl(url));
}

// ── Public: current branding (logos + display settings) — consumed by the site chrome, login and admin sidebar ──
brandingRoutes.get("/", asyncHandler(async (_req, res) => {
  const [logos, settings] = await Promise.all([
    prisma.logo.findMany(),
    prisma.logoSetting.upsert({ where: { id: "logo" }, update: {}, create: { id: "logo" } }),
  ]);
  res.json({ success: true, data: { logos, settings } });
}));

brandingRoutes.get("/logos/:kind/history", requireAuth, authorize("settings:view"), asyncHandler(async (req, res) => {
  const items = await prisma.logoHistory.findMany({ where: { kind: req.params.kind }, orderBy: { createdAt: "desc" }, take: 5 });
  res.json({ success: true, data: items });
}));

brandingRoutes.post("/logos/:kind", requireAuth, authorize("settings:edit"), upload.single("file"), asyncHandler(async (req, res) => {
  const kind = req.params.kind;
  const file = req.file;
  if (!file) throw ApiError.badRequest("Attach an image file");
  if (!(LOGO_KINDS as readonly string[]).includes(kind)) {
    throw ApiError.badRequest(`Unknown logo kind "${kind}"`);
  }

  const settings = await prisma.logoSetting.upsert({ where: { id: "logo" }, update: {}, create: { id: "logo" } });
  if (file.size > settings.maxUploadSizeMb * 1024 * 1024) {
    throw ApiError.badRequest(`Image exceeds the ${settings.maxUploadSizeMb}MB limit configured in logo settings`);
  }

  const stem = randomFileName(file.originalname, "");
  let url: string;
  let thumbUrl: string | null = null;

  if (RASTER_MIME.has(file.mimetype)) {
    // Auto-convert raster uploads to WebP and generate a transparent-padded thumbnail; drop the original.
    const webpBuffer = await sharp(file.buffer).webp({ quality: 90 }).toBuffer();
    const thumbBuffer = await sharp(file.buffer)
      .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toBuffer();
    url = await uploadToStorage(`branding/${stem}.webp`, webpBuffer, "image/webp");
    thumbUrl = await uploadToStorage(`branding/${stem}-thumb.webp`, thumbBuffer, "image/webp");
  } else {
    const ext = ALLOWED_MIME[file.mimetype] ?? path.extname(file.originalname);
    url = await uploadToStorage(`branding/${stem}${ext}`, file.buffer, file.mimetype);
  }

  const existing = await prisma.logo.findUnique({ where: { kind } });
  if (existing) {
    await prisma.logoHistory.create({ data: { kind, url: existing.url } });
    if (existing.thumbUrl) await deleteQuiet(existing.thumbUrl); // thumbnails aren't versioned; safe to drop

    const historyCount = await prisma.logoHistory.count({ where: { kind } });
    if (historyCount > 5) {
      const stale = await prisma.logoHistory.findMany({ where: { kind }, orderBy: { createdAt: "asc" }, take: historyCount - 5 });
      await Promise.all(stale.map((h: { url: string }) => deleteQuiet(h.url)));
      await prisma.logoHistory.deleteMany({ where: { id: { in: stale.map((h: { id: string }) => h.id) } } });
    }
  }

  const logo = await prisma.logo.upsert({
    where: { kind },
    update: { url, thumbUrl },
    create: { kind, url, thumbUrl },
  });
  logActivity(req, existing ? "updated" : "created", "logos", logo.id, { kind });
  await cacheDel("settings*");
  res.status(201).json({ success: true, data: logo });
}));

brandingRoutes.post("/logos/:kind/restore", requireAuth, authorize("settings:edit"),
  validate(z.object({ body: z.object({ historyId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const kind = req.params.kind;
    const history = await prisma.logoHistory.findUnique({ where: { id: req.body.historyId } });
    if (!history || history.kind !== kind) throw ApiError.notFound("History entry not found");

    const existing = await prisma.logo.findUnique({ where: { kind } });
    if (existing) {
      await prisma.logoHistory.create({ data: { kind, url: existing.url } });
      if (existing.thumbUrl) await deleteQuiet(existing.thumbUrl);
    }
    const logo = await prisma.logo.upsert({
      where: { kind },
      update: { url: history.url, thumbUrl: null },
      create: { kind, url: history.url },
    });
    await prisma.logoHistory.delete({ where: { id: history.id } });
    logActivity(req, "restored", "logos", logo.id, { kind });
    await cacheDel("settings*");
    res.json({ success: true, data: logo });
  }));

brandingRoutes.delete("/logos/:kind", requireAuth, authorize("settings:edit"), asyncHandler(async (req, res) => {
  const existing = await prisma.logo.findUnique({ where: { kind: req.params.kind } });
  if (!existing) throw ApiError.notFound("No logo uploaded for this kind");
  await deleteQuiet(existing.url);
  await deleteQuiet(existing.thumbUrl);
  await prisma.logo.delete({ where: { kind: req.params.kind } });
  logActivity(req, "deleted", "logos", existing.id, { kind: req.params.kind });
  await cacheDel("settings*");
  res.json({ success: true, message: "Logo deleted" });
}));

const logoSettingSchema = z.object({
  body: z.object({
    width: z.number().int().min(16).max(1000).optional(),
    height: z.number().int().min(16).max(1000).optional(),
    position: z.enum(["left", "center", "right"]).optional(),
    padding: z.number().int().min(0).max(100).optional(),
    background: z.string().optional().nullable(),
    borderRadius: z.number().int().min(0).max(100).optional(),
    headerLogoHeight: z.number().int().min(16).max(200).optional(),
    footerLogoHeight: z.number().int().min(16).max(200).optional(),
    mobileLogoHeight: z.number().int().min(16).max(200).optional(),
    stickyHeaderLogo: z.boolean().optional(),
    darkModeLogoEnabled: z.boolean().optional(),
    retinaLogo: z.boolean().optional(),
    enableSvgLogo: z.boolean().optional(),
    maxUploadSizeMb: z.number().int().min(1).max(50).optional(),
  }),
});

brandingRoutes.patch("/logo-settings", requireAuth, authorize("settings:edit"), validate(logoSettingSchema), asyncHandler(async (req, res) => {
  const settings = await prisma.logoSetting.upsert({ where: { id: "logo" }, update: req.body, create: { id: "logo", ...req.body } });
  logActivity(req, "updated", "logo_settings");
  await cacheDel("settings*");
  res.json({ success: true, data: settings });
}));
