import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";

export const supportTicketRoutes = Router();

const body = z.object({
  customerId: z.string(),
  subject: z.string().min(2),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  assignedToId: z.string().optional().nullable(),
});

supportTicketRoutes.use("/", crudRouter({
  resource: "support-tickets",
  model: prisma.supportTicket,
  searchFields: ["subject"],
  defaultSort: "createdAt",
  include: {
    customer: { select: { id: true, companyName: true } },
    assignedTo: { select: { id: true, firstName: true, lastName: true } },
  },
  createSchema: z.object({ body }),
  updateSchema: z.object({ body: body.partial() }),
  beforeUpdate: (b) => (b.status === "resolved" || b.status === "closed" ? { ...b, resolvedAt: new Date() } : b),
}));
