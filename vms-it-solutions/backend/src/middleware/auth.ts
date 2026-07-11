import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken, AccessPayload } from "../utils/jwt";
import { prisma } from "../config/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessPayload;
    }
  }
}

/** Requires a valid Bearer access token. Also enforces tokenVersion (force logout). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw ApiError.unauthorized();
    const payload = verifyAccessToken(header.slice(7));

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, isActive: true, isLocked: true },
    });
    if (!user || !user.isActive || user.isLocked) throw ApiError.unauthorized("Account is disabled");
    if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized("Session expired, please sign in again");

    req.auth = payload;
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized("Invalid or expired token"));
  }
}
