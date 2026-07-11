import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";

export const crmProjectRoutes = Router();

const body = z.object({
  customerId: z.string(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  status: z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  budget: z.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  projectManagerId: z.string().optional().nullable(),
});

crmProjectRoutes.use("/", crudRouter({
  resource: "crm-projects",
  model: prisma.crmProject,
  searchFields: ["title"],
  defaultSort: "createdAt",
  include: {
    customer: { select: { id: true, companyName: true } },
    projectManager: { select: { id: true, firstName: true, lastName: true } },
  },
  createSchema: z.object({ body }),
  updateSchema: z.object({ body: body.partial() }),
}));
