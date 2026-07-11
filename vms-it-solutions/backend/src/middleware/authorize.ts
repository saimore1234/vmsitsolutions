import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * RBAC guard. Usage: authorize("leads:view") or authorize("blogs:edit", "blogs:manage").
 * "manage" on a resource implies every action; the "super-admin" role bypasses all checks.
 */
export function authorize(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(ApiError.unauthorized());
    if (auth.role === "super-admin") return next();

    const perms = new Set(auth.perms);
    const ok = required.some((r) => {
      if (perms.has(r)) return true;
      const [resource] = r.split(":");
      return perms.has(`${resource}:manage`);
    });
    return ok ? next() : next(ApiError.forbidden());
  };
}
