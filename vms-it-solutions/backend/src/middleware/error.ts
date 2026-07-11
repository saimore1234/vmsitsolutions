import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound("Route not found"));
}

export async function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = "Something went wrong";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (isPrismaKnownError(err)) {
    if (err.code === "P2002") { status = 409; message = "A record with that value already exists"; }
    else if (err.code === "P2025") { status = 404; message = "Resource not found"; }
    else { status = 400; message = "Database request failed"; }
  } else if (err instanceof Error) {
    message = env.isProd ? message : err.message;
  }

  if (status >= 500) {
    console.error(err);
    prisma.errorLog.create({
      data: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        path: req.originalUrl,
        method: req.method,
        statusCode: status,
      },
    }).catch(() => undefined);
  }

  res.status(status).json({ success: false, message, details });
}

function isPrismaKnownError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && typeof (err as { code?: unknown }).code === "string" && /^P\d{4}$/.test(String((err as { code?: unknown }).code));
}
