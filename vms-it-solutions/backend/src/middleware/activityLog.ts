import { Request } from "express";
import { prisma } from "../config/prisma";

/** Fire-and-forget audit trail. Never blocks or fails the request. */
export function logActivity(
  req: Request,
  action: string,
  resource: string,
  resourceId?: string,
  detail?: Record<string, unknown>,
) {
  prisma.activityLog.create({
    data: {
      userId: req.auth?.sub,
      action,
      resource,
      resourceId,
      detail: detail as never,
      ip: req.ip,
    },
  }).catch(() => undefined);
}
