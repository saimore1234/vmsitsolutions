import { Router } from "express";
import multer from "multer";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { parsePageQuery, paged } from "../../utils/pagination";
import { logActivity } from "../../middleware/activityLog";
import { randomFileName, uploadToStorage, deleteFromStorage, storageKeyFromUrl } from "../../utils/storage";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
  "image/svg+xml": "svg", "video/mp4": "video", "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
  "application/vnd.ms-excel": "sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "sheet",
  "application/vnd.ms-powerpoint": "slide",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slide",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error("File type not allowed"));
    cb(null, true);
  },
});

export const mediaRoutes = Router();
mediaRoutes.use(requireAuth);

mediaRoutes.get("/", authorize("media:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = {};
  if (req.query.folderId) where.folderId = req.query.folderId === "root" ? null : String(req.query.folderId);
  if (req.query.kind) where.kind = String(req.query.kind);
  if (q.search) where.name = { contains: q.search, mode: "insensitive" };
  const [items, total, folders] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: q.skip, take: q.limit }),
    prisma.media.count({ where }),
    prisma.mediaFolder.findMany({ orderBy: { name: "asc" } }),
  ]);
  res.json({ success: true, data: { ...paged(items, total, q), folders } });
}));

mediaRoutes.post("/upload", authorize("media:create"), upload.array("files", 10), asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) throw ApiError.badRequest("Attach at least one file");
  const folderId = req.body.folderId || null;

  const uploaded = await Promise.all(files.map(async (f) => {
    const fileName = randomFileName(f.originalname);
    const url = await uploadToStorage(`media/${fileName}`, f.buffer, f.mimetype);
    return { f, fileName, url };
  }));

  const records = await prisma.$transaction(
    uploaded.map(({ f, fileName, url }) => prisma.media.create({
      data: {
        name: f.originalname,
        fileName,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        kind: ALLOWED[f.mimetype] ?? "other",
        url,
        folderId,
      },
    })),
  );
  logActivity(req, "uploaded", "media", undefined, { count: records.length });
  res.status(201).json({ success: true, data: records });
}));

mediaRoutes.patch("/:id", authorize("media:edit"), asyncHandler(async (req, res) => {
  const item = await prisma.media.update({
    where: { id: req.params.id },
    data: { name: req.body.name, folderId: req.body.folderId },
  });
  res.json({ success: true, data: item });
}));

mediaRoutes.delete("/:id", authorize("media:delete"), asyncHandler(async (req, res) => {
  const item = await prisma.media.delete({ where: { id: req.params.id } });
  await deleteFromStorage(storageKeyFromUrl(item.url));
  logActivity(req, "deleted", "media", req.params.id);
  res.json({ success: true, message: "File deleted" });
}));

mediaRoutes.post("/folders", authorize("media:create"), asyncHandler(async (req, res) => {
  const folder = await prisma.mediaFolder.create({ data: { name: String(req.body.name), parentId: req.body.parentId ?? null } });
  res.status(201).json({ success: true, data: folder });
}));

mediaRoutes.delete("/folders/:id", authorize("media:delete"), asyncHandler(async (req, res) => {
  await prisma.mediaFolder.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: "Folder deleted" });
}));
