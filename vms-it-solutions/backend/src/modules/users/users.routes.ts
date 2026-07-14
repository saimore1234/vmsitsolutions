import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import { parse as parseCsv } from "csv-parse/sync";
import { UAParser } from "ua-parser-js";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { hashPassword } from "../../utils/password";
import { parsePageQuery, paged } from "../../utils/pagination";
import { logActivity } from "../../middleware/activityLog";
import { env } from "../../config/env";
import { randomFileName, uploadToStorage, deleteFromStorage, storageKeyFromUrl } from "../../utils/storage";

export const userRoutes = Router();
userRoutes.use(requireAuth);

/** Public — invitation acceptance does not require a session. Mounted separately at /invitations. */
export const invitationRoutes = Router();

export const STATUSES = ["draft", "invited", "active", "inactive", "suspended", "locked", "deleted", "archived"] as const;
const DOC_KINDS = ["resume", "pan", "aadhaar", "passport", "driving_license", "offer_letter", "certificate", "contract", "other"] as const;
const GENDERS = ["male", "female", "other", "undisclosed"] as const;

// isActive/isLocked stay in sync with `status` so the existing login/session security path
// (requireAuth, authService.login) doesn't need to change to understand the richer status field.
// "locked" keeps isActive true so login still reaches the dedicated "account is locked" message.
function statusFlags(status: string) {
  return { isActive: status === "active" || status === "locked", isLocked: status === "locked" };
}

async function nextEmployeeId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.user.count();
    const candidate = `EMP${String(count + 1 + attempt).padStart(5, "0")}`;
    const exists = await prisma.user.findUnique({ where: { employeeId: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `EMP${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

const listSelect = {
  id: true, employeeId: true, email: true, username: true, firstName: true, lastName: true, displayName: true,
  avatarUrl: true, avatarThumbUrl: true, department: true, designation: true, status: true, isActive: true,
  isLocked: true, lastLoginAt: true, createdAt: true,
  role: { select: { id: true, name: true, slug: true } },
} as const;

const detailSelect = {
  ...listSelect,
  middleName: true, phone: true, alternatePhone: true, gender: true, dob: true, joiningDate: true, location: true,
  bio: true, notes: true, language: true, timeZone: true, currency: true, emailVerified: true, mustChangePassword: true,
  invitedAt: true, updatedAt: true,
  manager: { select: { id: true, firstName: true, lastName: true, email: true } },
  branches: { select: { isPrimary: true, branch: { select: { id: true, name: true } } } },
  groups: { select: { group: { select: { id: true, name: true } } } },
  _count: { select: { documents: true, directReports: true } },
} as const;

// ── Static routes first — must be registered before "/:id" so Express doesn't treat
//    "stats" / "export" / "bulk" etc. as an :id value. ──

userRoutes.get("/stats", authorize("users:view"), asyncHandler(async (_req, res) => {
  const [byStatusRaw, byDept, byRoleRaw, roles, activeSessions, recentActivity] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: true }),
    prisma.user.groupBy({ by: ["department"], _count: true, where: { status: { not: "deleted" } } }),
    prisma.user.groupBy({ by: ["roleId"], _count: true, where: { status: { not: "deleted" } } }),
    prisma.role.findMany({ select: { id: true, name: true } }),
    prisma.refreshToken.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, distinct: ["userId"], select: { userId: true } }),
    prisma.activityLog.findMany({ where: { resource: "users" }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { firstName: true, lastName: true } } } }),
  ]);

  const roleNames = new Map(roles.map((r: { id: string; name: string }) => [r.id, r.name]));
  const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of byStatusRaw as unknown as { status: string; _count: number }[]) byStatus[row.status] = row._count;
  const total = STATUSES.filter((s) => s !== "deleted").reduce((sum, s) => sum + byStatus[s], 0);

  res.json({
    success: true,
    data: {
      total,
      active: byStatus.active, inactive: byStatus.inactive, locked: byStatus.locked, suspended: byStatus.suspended,
      pendingInvitations: byStatus.invited, draft: byStatus.draft, archived: byStatus.archived,
      activeSessions: activeSessions.length,
      byDepartment: (byDept as unknown as { department: string | null; _count: number }[])
        .filter((d) => d.department).map((d) => ({ department: d.department, count: d._count })),
      byRole: (byRoleRaw as unknown as { roleId: string; _count: number }[])
        .map((r) => ({ roleId: r.roleId, role: roleNames.get(r.roleId) ?? "Unknown", count: r._count })),
      recentActivity,
    },
  });
}));

userRoutes.get("/export", authorize("users:export"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: { not: "deleted" } },
    select: { employeeId: true, firstName: true, lastName: true, email: true, username: true, phone: true, department: true, designation: true, status: true, joiningDate: true, createdAt: true, role: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const header = "Employee ID,Name,Email,Username,Phone,Department,Designation,Role,Status,Joining Date,Created At";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = users.map((u: typeof users[number]) => [
    u.employeeId, `${u.firstName} ${u.lastName}`, u.email, u.username, u.phone, u.department, u.designation,
    u.role.name, u.status, u.joiningDate?.toISOString() ?? "", u.createdAt.toISOString(),
  ].map(esc).join(","));
  logActivity(_req, "exported", "users");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=users-${Date.now()}.csv`);
  res.send([header, ...rows].join("\n"));
}));

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
userRoutes.post("/import", authorize("users:import"), csvUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Attach a CSV file");
  let records: Record<string, string>[];
  try {
    records = parseCsv(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw ApiError.badRequest("Could not parse CSV file — check it has a header row (email, firstName, lastName, ...)");
  }
  const defaultRole = (await prisma.role.findFirst({ where: { slug: "employee" } })) ?? (await prisma.role.findFirst({ orderBy: { name: "asc" } }));
  if (!defaultRole) throw ApiError.badRequest("No roles exist to assign imported users to");

  const created: string[] = [];
  const errors: { row: number; message: string }[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    try {
      const email = r.email || r.Email;
      const firstName = r.firstName || r["First Name"] || r.firstname;
      const lastName = r.lastName || r["Last Name"] || r.lastname;
      if (!email || !firstName || !lastName) throw new Error("email, firstName and lastName are required");
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error("Email already exists");
      const employeeId = await nextEmployeeId();
      const user = await prisma.user.create({
        data: {
          email, firstName, lastName, employeeId,
          department: r.department || r.Department || undefined,
          designation: r.designation || r.Designation || undefined,
          phone: r.phone || r.Phone || undefined,
          password: await hashPassword(crypto.randomBytes(24).toString("hex")),
          roleId: defaultRole.id,
          status: "invited",
          isActive: false,
          invitedAt: new Date(),
          invitationToken: crypto.randomBytes(32).toString("base64url"),
          invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          createdById: req.auth!.sub,
        },
      });
      created.push(user.email);
    } catch (err) {
      errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  logActivity(req, "bulk_imported", "users", undefined, { created: created.length, failed: errors.length });
  res.json({ success: true, data: { created: created.length, failed: errors.length, errors } });
}));

userRoutes.post("/bulk/status", authorize("users:manage"), validate(z.object({ body: z.object({ ids: z.array(z.string()).min(1), status: z.enum(STATUSES) }) })), asyncHandler(async (req, res) => {
  const ids = (req.body.ids as string[]).filter((id) => id !== req.auth!.sub);
  const status = req.body.status as string;
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status, ...statusFlags(status), tokenVersion: { increment: 1 } } });
  if (status !== "active") await prisma.refreshToken.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "bulk_status_changed", "users", undefined, { ids, status });
  res.json({ success: true, message: `${ids.length} user(s) updated` });
}));

userRoutes.post("/bulk/assign-role", authorize("users:manage"), validate(z.object({ body: z.object({ ids: z.array(z.string()).min(1), roleId: z.string() }) })), asyncHandler(async (req, res) => {
  const ids = (req.body.ids as string[]).filter((id) => id !== req.auth!.sub);
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { roleId: req.body.roleId, tokenVersion: { increment: 1 } } });
  logActivity(req, "bulk_role_assigned", "users", undefined, { ids, roleId: req.body.roleId });
  res.json({ success: true, message: `Role assigned to ${ids.length} user(s)${ids.length !== req.body.ids.length ? " (your own account was skipped)" : ""}` });
}));

userRoutes.post("/bulk/assign-group", authorize("users:manage"), validate(z.object({ body: z.object({ ids: z.array(z.string()).min(1), groupId: z.string(), action: z.enum(["add", "remove"]).default("add") }) })), asyncHandler(async (req, res) => {
  const { ids, groupId, action } = req.body as { ids: string[]; groupId: string; action: "add" | "remove" };
  if (action === "add") {
    await prisma.userGroupMember.createMany({ data: ids.map((userId) => ({ userId, groupId })), skipDuplicates: true });
  } else {
    await prisma.userGroupMember.deleteMany({ where: { userId: { in: ids }, groupId } });
  }
  logActivity(req, "bulk_group_assigned", "users", undefined, { ids, groupId, action });
  res.json({ success: true, message: `Group ${action === "add" ? "assigned to" : "removed from"} ${ids.length} user(s)` });
}));

userRoutes.post("/bulk/delete", authorize("users:delete"), validate(z.object({ body: z.object({ ids: z.array(z.string()).min(1) }) })), asyncHandler(async (req, res) => {
  const ids = (req.body.ids as string[]).filter((id) => id !== req.auth!.sub);
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: "deleted", isActive: false, tokenVersion: { increment: 1 } } });
  await prisma.refreshToken.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "bulk_deleted", "users", undefined, { ids });
  res.json({ success: true, message: `${ids.length} user(s) deleted` });
}));

// ── List / create ──

userRoutes.get("/", authorize("users:view"), asyncHandler(async (req, res) => {
  const q = parsePageQuery(req);
  const where: Record<string, unknown> = { status: { not: "deleted" } };
  if (q.search) where.OR = ["email", "firstName", "lastName", "username", "employeeId", "displayName"].map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.department) where.department = String(req.query.department);
  if (req.query.roleId) where.roleId = String(req.query.roleId);
  if (req.query.branchId) where.branches = { some: { branchId: String(req.query.branchId) } };
  if (req.query.groupId) where.groups = { some: { groupId: String(req.query.groupId) } };

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: listSelect, orderBy: { [q.sortBy]: q.sortDir }, skip: q.skip, take: q.limit }),
    prisma.user.count({ where }),
  ]);
  res.json({ success: true, data: paged(items, total, q) });
}));

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    username: z.string().min(3).optional().nullable(),
    firstName: z.string().min(1),
    middleName: z.string().optional().nullable(),
    lastName: z.string().min(1),
    displayName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    alternatePhone: z.string().optional().nullable(),
    gender: z.enum(GENDERS).optional().nullable(),
    dob: z.string().datetime().optional().nullable(),
    joiningDate: z.string().datetime().optional().nullable(),
    department: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    roleId: z.string().min(1),
    branchIds: z.array(z.string()).default([]),
    groupIds: z.array(z.string()).default([]),
    language: z.string().optional(),
    timeZone: z.string().optional(),
    currency: z.string().optional(),
    bio: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    password: z.string().min(8).optional(),
    sendInvite: z.boolean().default(false),
    mustChangePassword: z.boolean().default(false),
  }).refine((d) => d.sendInvite || d.password, { message: "Provide a password, or send an invitation instead", path: ["password"] }),
});

userRoutes.post("/", authorize("users:create"), validate(createUserSchema), asyncHandler(async (req, res) => {
  const { branchIds, groupIds, sendInvite, password, dob, joiningDate, ...rest } = req.body;
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: rest.email }, ...(rest.username ? [{ username: rest.username }] : [])] } });
  if (existing) throw ApiError.conflict("A user with that email or username already exists");

  const employeeId = await nextEmployeeId();
  const finalPassword = password ?? crypto.randomBytes(24).toString("hex");
  const status = sendInvite ? "invited" : "active";
  const invitationToken = sendInvite ? crypto.randomBytes(32).toString("base64url") : null;

  const user = await prisma.user.create({
    data: {
      ...rest,
      employeeId,
      dob: dob ? new Date(dob) : undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      password: await hashPassword(finalPassword),
      status,
      ...statusFlags(status),
      invitedAt: sendInvite ? new Date() : undefined,
      invitationToken,
      invitationExpiresAt: sendInvite ? new Date(Date.now() + 7 * 86_400_000) : undefined,
      createdById: req.auth!.sub,
      branches: branchIds.length ? { create: branchIds.map((branchId: string, i: number) => ({ branchId, isPrimary: i === 0 })) } : undefined,
      groups: groupIds.length ? { create: groupIds.map((groupId: string) => ({ groupId })) } : undefined,
    },
    select: detailSelect,
  });
  logActivity(req, "created", "users", user.id, { email: user.email });
  res.status(201).json({
    success: true,
    data: user,
    inviteUrl: invitationToken ? `${env.corsOrigin[0]}/accept-invite?token=${invitationToken}` : undefined,
  });
}));

// ── Single-user routes ──

userRoutes.get("/:id", authorize("users:view"), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: detailSelect });
  if (!user) throw ApiError.notFound();
  res.json({ success: true, data: user });
}));

const updateUserSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).optional().nullable(),
    firstName: z.string().min(1).optional(),
    middleName: z.string().optional().nullable(),
    lastName: z.string().min(1).optional(),
    displayName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    alternatePhone: z.string().optional().nullable(),
    gender: z.enum(GENDERS).optional().nullable(),
    dob: z.string().datetime().optional().nullable(),
    joiningDate: z.string().datetime().optional().nullable(),
    department: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    roleId: z.string().optional(),
    branchIds: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional(),
    language: z.string().optional(),
    timeZone: z.string().optional(),
    currency: z.string().optional(),
    bio: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    mustChangePassword: z.boolean().optional(),
  }),
});

userRoutes.patch("/:id", authorize("users:edit"), validate(updateUserSchema), asyncHandler(async (req, res) => {
  const { branchIds, groupIds, dob, joiningDate, ...rest } = req.body;
  const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: detailSelect });
  if (!before) throw ApiError.notFound();

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      dob: dob !== undefined ? (dob ? new Date(dob) : null) : undefined,
      joiningDate: joiningDate !== undefined ? (joiningDate ? new Date(joiningDate) : null) : undefined,
      updatedById: req.auth!.sub,
      branches: branchIds ? { deleteMany: {}, create: branchIds.map((branchId: string, i: number) => ({ branchId, isPrimary: i === 0 })) } : undefined,
      groups: groupIds ? { deleteMany: {}, create: groupIds.map((groupId: string) => ({ groupId })) } : undefined,
    },
    select: detailSelect,
  });

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(rest)) {
    const b = (before as Record<string, unknown>)[key];
    const a = (user as Record<string, unknown>)[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) changed[key] = { from: b, to: a };
  }
  logActivity(req, "updated", "users", user.id, { changed });
  res.json({ success: true, data: user });
}));

userRoutes.get("/:id/activity", authorize("users:view"), asyncHandler(async (req, res) => {
  const items = await prisma.activityLog.findMany({
    where: { OR: [{ resourceId: req.params.id, resource: { in: ["users", "auth"] } }, { userId: req.params.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  res.json({ success: true, data: items });
}));

userRoutes.post("/:id/status", authorize("users:edit"), validate(z.object({ body: z.object({ status: z.enum(STATUSES), reason: z.string().optional() }) })), asyncHandler(async (req, res) => {
  if (req.params.id === req.auth!.sub) throw ApiError.badRequest("You can't change your own account's status");
  const status = req.body.status as string;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status, ...statusFlags(status), tokenVersion: { increment: 1 } },
    select: detailSelect,
  });
  if (status !== "active") await prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "status_changed", "users", user.id, { status, reason: req.body.reason });
  res.json({ success: true, data: user });
}));

userRoutes.post("/:id/reset-password", authorize("users:edit"), asyncHandler(async (req, res) => {
  const newPassword = z.string().min(8).parse(req.body.newPassword);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { password: await hashPassword(newPassword), tokenVersion: { increment: 1 }, mustChangePassword: true },
  });
  await prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "password_reset", "users", req.params.id);
  res.json({ success: true, message: "Password reset — the user must sign in again" });
}));

userRoutes.post("/:id/force-logout", authorize("users:edit"), asyncHandler(async (req, res) => {
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { tokenVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  logActivity(req, "force_logout", "users", req.params.id);
  res.json({ success: true, message: "All sessions ended" });
}));

userRoutes.post("/:id/invite", authorize("users:edit"), asyncHandler(async (req, res) => {
  const invitationToken = crypto.randomBytes(32).toString("base64url");
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { invitationToken, invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000), status: "invited", isActive: false, isLocked: false, invitedAt: new Date() },
    select: detailSelect,
  });
  logActivity(req, "invite_sent", "users", user.id);
  res.json({ success: true, data: user, inviteUrl: `${env.corsOrigin[0]}/accept-invite?token=${invitationToken}` });
}));

userRoutes.post("/:id/invite/cancel", authorize("users:edit"), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { invitationToken: null, invitationExpiresAt: null, status: "draft", isActive: false },
    select: detailSelect,
  });
  logActivity(req, "invite_cancelled", "users", user.id);
  res.json({ success: true, data: user });
}));

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, file, cb) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) return cb(new Error("Use PNG, JPG or WEBP"));
    cb(null, true);
  },
});

async function deleteAvatar(url: string | null | undefined) {
  if (!url) return;
  await deleteFromStorage(storageKeyFromUrl(url));
}

userRoutes.post("/:id/photo", authorize("users:edit"), avatarUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Attach an image");
  const stem = randomFileName(req.file.originalname, "");
  const webpBuffer = await sharp(req.file.buffer).resize(512, 512, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
  const thumbBuffer = await sharp(req.file.buffer).resize(96, 96, { fit: "cover" }).webp({ quality: 80 }).toBuffer();

  const prev = await prisma.user.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true, avatarThumbUrl: true } });
  const avatarUrl = await uploadToStorage(`avatars/${stem}.webp`, webpBuffer, "image/webp");
  const avatarThumbUrl = await uploadToStorage(`avatars/${stem}-thumb.webp`, thumbBuffer, "image/webp");
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { avatarUrl, avatarThumbUrl }, select: detailSelect });
  if (prev) { await deleteAvatar(prev.avatarUrl); await deleteAvatar(prev.avatarThumbUrl); }
  logActivity(req, "photo_updated", "users", user.id);
  res.json({ success: true, data: user });
}));

userRoutes.delete("/:id/photo", authorize("users:edit"), asyncHandler(async (req, res) => {
  const prev = await prisma.user.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true, avatarThumbUrl: true } });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { avatarUrl: null, avatarThumbUrl: null }, select: detailSelect });
  if (prev) { await deleteAvatar(prev.avatarUrl); await deleteAvatar(prev.avatarThumbUrl); }
  res.json({ success: true, data: user });
}));

const DOC_MIME: Record<string, string> = { "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_r, file, cb) => { if (!DOC_MIME[file.mimetype]) return cb(new Error("Use PDF, PNG or JPG")); cb(null, true); },
});

userRoutes.get("/:id/documents", authorize("users:view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await prisma.userDocument.findMany({ where: { userId: req.params.id }, orderBy: { uploadedAt: "desc" } }) });
}));

userRoutes.post("/:id/documents", authorize("users:edit"), docUpload.single("file"), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest("Attach a file");
  const kind = String(req.body.kind ?? "other");
  if (!(DOC_KINDS as readonly string[]).includes(kind)) {
    throw ApiError.badRequest("Unknown document kind");
  }
  const ext = DOC_MIME[file.mimetype] ?? path.extname(file.originalname);
  const url = await uploadToStorage(`documents/${randomFileName(file.originalname, ext)}`, file.buffer, file.mimetype);
  const doc = await prisma.userDocument.create({
    data: { userId: req.params.id, kind, name: file.originalname, url, mimeType: file.mimetype, sizeBytes: file.size },
  });
  logActivity(req, "document_uploaded", "users", req.params.id, { kind });
  res.status(201).json({ success: true, data: doc });
}));

userRoutes.delete("/:id/documents/:docId", authorize("users:edit"), asyncHandler(async (req, res) => {
  const doc = await prisma.userDocument.findUnique({ where: { id: req.params.docId } });
  if (!doc || doc.userId !== req.params.id) throw ApiError.notFound();
  await deleteFromStorage(storageKeyFromUrl(doc.url));
  await prisma.userDocument.delete({ where: { id: doc.id } });
  logActivity(req, "document_deleted", "users", req.params.id, { kind: doc.kind });
  res.json({ success: true, message: "Document deleted" });
}));

userRoutes.get("/:id/sessions", authorize("users:view"), asyncHandler(async (req, res) => {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId: req.params.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
  });
  const enriched = sessions.map((s: { id: string; ip: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date }) => {
    const ua = new UAParser(s.userAgent ?? "").getResult();
    return { ...s, browser: ua.browser.name ?? "Unknown", os: ua.os.name ?? "Unknown", device: ua.device.type ?? "desktop" };
  });
  res.json({ success: true, data: enriched });
}));

userRoutes.post("/:id/sessions/:sessionId/revoke", authorize("users:edit"), asyncHandler(async (req, res) => {
  await prisma.refreshToken.updateMany({ where: { id: req.params.sessionId, userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "session_revoked", "users", req.params.id);
  res.json({ success: true, message: "Session revoked" });
}));

userRoutes.post("/:id/restore", authorize("users:edit"), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: "inactive", isActive: false, isLocked: false }, select: detailSelect });
  logActivity(req, "restored", "users", user.id);
  res.json({ success: true, data: user });
}));

userRoutes.delete("/:id", authorize("users:delete"), asyncHandler(async (req, res) => {
  if (req.params.id === req.auth!.sub) throw ApiError.badRequest("You can't delete your own account");
  await prisma.user.update({ where: { id: req.params.id }, data: { status: "deleted", isActive: false, tokenVersion: { increment: 1 } } });
  await prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
  logActivity(req, "deleted", "users", req.params.id);
  res.json({ success: true, message: "User deleted" });
}));

// ── Public invitation acceptance ──

invitationRoutes.get("/check", asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? "");
  const user = await prisma.user.findUnique({ where: { invitationToken: token }, select: { email: true, firstName: true, lastName: true, invitationExpiresAt: true } });
  if (!user || !user.invitationExpiresAt || user.invitationExpiresAt < new Date()) throw ApiError.badRequest("Invalid or expired invitation");
  res.json({ success: true, data: { email: user.email, firstName: user.firstName, lastName: user.lastName } });
}));

invitationRoutes.post("/accept", validate(z.object({ body: z.object({ token: z.string(), password: z.string().min(8) }) })), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { invitationToken: req.body.token } });
  if (!user) throw ApiError.badRequest("Invalid or expired invitation");
  if (!user.invitationExpiresAt || user.invitationExpiresAt < new Date()) throw ApiError.badRequest("This invitation has expired");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(req.body.password),
      status: "active", isActive: true, isLocked: false, emailVerified: true,
      mustChangePassword: false, invitationToken: null, invitationExpiresAt: null, invitedAt: null,
    },
  });
  res.json({ success: true, message: "Account activated — you can now sign in" });
}));
