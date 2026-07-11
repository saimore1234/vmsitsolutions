import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";

export const amcContractRoutes = Router();

const body = z.object({
  customerId: z.string(),
  contractNumber: z.string().min(2),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  value: z.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  status: z.enum(["active", "expired", "cancelled", "renewed"]).optional(),
  renewalReminderAt: z.string().datetime().optional().nullable(),
  terms: z.string().optional().nullable(),
});

amcContractRoutes.use("/", crudRouter({
  resource: "amc-contracts",
  model: prisma.amcContract,
  searchFields: ["contractNumber"],
  defaultSort: "createdAt",
  include: { customer: { select: { id: true, companyName: true } } },
  createSchema: z.object({ body }),
  updateSchema: z.object({ body: body.partial() }),
}));
