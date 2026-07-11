import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { slugify } from "../../utils/slugify";
import { logActivity } from "../../middleware/activityLog";

export const roleRoutes = Router();
roleRoutes.use(requireAuth);

const roleSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissionIds: z.array(z.string()).default([]),
  }),
});

roleRoutes.get("/", authorize("roles:view"), asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, data: roles });
}));

roleRoutes.get("/permissions", authorize("roles:view"), asyncHandler(async (_req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
  res.json({ success: true, data: permissions });
}));

roleRoutes.post("/", authorize("roles:create"), validate(roleSchema), asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;
  const role = await prisma.role.create({
    data: {
      name,
      slug: slugify(name),
      description,
      permissions: { create: permissionIds.map((permissionId: string) => ({ permissionId })) },
    },
    include: { permissions: { include: { permission: true } } },
  });
  logActivity(req, "created", "roles", role.id);
  res.status(201).json({ success: true, data: role });
}));

roleRoutes.patch("/:id", authorize("roles:edit"), validate(roleSchema), asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;
  const existing = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existing.isSystem && slugify(name) !== existing.slug) {
    throw ApiError.badRequest("System roles can't be renamed");
  }
  const role = await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: req.params.id } });
    return tx.role.update({
      where: { id: req.params.id },
      data: {
        name, description,
        slug: existing.isSystem ? existing.slug : slugify(name),
        permissions: { create: permissionIds.map((permissionId: string) => ({ permissionId })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  });
  logActivity(req, "updated", "roles", role.id);
  res.json({ success: true, data: role });
}));

roleRoutes.delete("/:id", authorize("roles:delete"), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id }, include: { _count: { select: { users: true } } } });
  if (role.isSystem) throw ApiError.badRequest("System roles can't be deleted");
  if (role._count.users > 0) throw ApiError.badRequest("Reassign this role's users before deleting it");
  await prisma.role.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "roles", req.params.id);
  res.json({ success: true, message: "Role deleted" });
}));
