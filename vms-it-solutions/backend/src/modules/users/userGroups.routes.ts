import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logActivity } from "../../middleware/activityLog";

export const userGroupRoutes = Router();
userGroupRoutes.use(requireAuth);

const groupSchema = z.object({
  body: z.object({ name: z.string().min(2), description: z.string().optional().nullable() }),
});

userGroupRoutes.get("/", authorize("users:view"), asyncHandler(async (_req, res) => {
  const groups = await prisma.userGroup.findMany({ include: { _count: { select: { members: true } } }, orderBy: { name: "asc" } });
  res.json({ success: true, data: groups });
}));

userGroupRoutes.get("/:id", authorize("users:view"), asyncHandler(async (req, res) => {
  const group = await prisma.userGroup.findUnique({
    where: { id: req.params.id },
    include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarThumbUrl: true } } } } },
  });
  if (!group) throw ApiError.notFound();
  res.json({ success: true, data: group });
}));

userGroupRoutes.post("/", authorize("users:manage"), validate(groupSchema), asyncHandler(async (req, res) => {
  const group = await prisma.userGroup.create({ data: req.body });
  logActivity(req, "created", "user_groups", group.id);
  res.status(201).json({ success: true, data: group });
}));

userGroupRoutes.patch("/:id", authorize("users:manage"), validate(groupSchema), asyncHandler(async (req, res) => {
  const group = await prisma.userGroup.update({ where: { id: req.params.id }, data: req.body });
  logActivity(req, "updated", "user_groups", group.id);
  res.json({ success: true, data: group });
}));

userGroupRoutes.delete("/:id", authorize("users:manage"), asyncHandler(async (req, res) => {
  await prisma.userGroup.delete({ where: { id: req.params.id } });
  logActivity(req, "deleted", "user_groups", req.params.id);
  res.json({ success: true, message: "Group deleted" });
}));
