import { Router, Request, Response } from "express";
import { AnyZodObject } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { parsePageQuery, paged } from "./pagination";
import { ApiError } from "./ApiError";
import { logActivity } from "../middleware/activityLog";
import { cacheDel } from "../config/redis";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args?: any) => Promise<any[]>;
  count: (args?: any) => Promise<number>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

export interface CrudOptions {
  /** RBAC resource name, e.g. "services" → services:view / services:create ... */
  resource: string;
  /** Prisma model delegate, e.g. prisma.service */
  model: Delegate;
  /** Fields matched by ?search= */
  searchFields?: string[];
  /** Zod schemas for create/update bodies */
  createSchema?: AnyZodObject;
  updateSchema?: AnyZodObject;
  /** Prisma `include`/`orderBy` defaults */
  include?: Record<string, unknown>;
  defaultSort?: string;
  /** If set, GET list & GET one are public (no auth) with this extra where-filter, e.g. { isActive: true } */
  publicRead?: Record<string, unknown> | true;
  /** Hooks for derived fields (e.g. slugs) */
  beforeCreate?: (body: Record<string, unknown>, req: Request) => Record<string, unknown>;
  beforeUpdate?: (body: Record<string, unknown>, req: Request) => Record<string, unknown>;
}

/**
 * Builds a standard REST resource:
 *   GET    /            list (pagination, search, sort, filters)
 *   GET    /:id         read one
 *   POST   /            create        [resource:create]
 *   PATCH  /:id         update        [resource:edit]
 *   DELETE /:id         delete        [resource:delete]
 */
export function crudRouter(opts: CrudOptions): Router {
  const r = Router();
  const { resource, model } = opts;

  const list = asyncHandler(async (req: Request, res: Response) => {
    const q = parsePageQuery(req, { sortBy: opts.defaultSort ?? "createdAt" });
    const where: Record<string, unknown> = {};

    if (q.search && opts.searchFields?.length) {
      where.OR = opts.searchFields.map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } }));
    }
    // Simple equality filters: any query param prefixed with f_ → where clause
    for (const [key, val] of Object.entries(req.query)) {
      if (key.startsWith("f_") && typeof val === "string" && val !== "") {
        where[key.slice(2)] = val === "true" ? true : val === "false" ? false : val;
      }
    }
    const isPublic = !req.auth;
    if (isPublic && typeof opts.publicRead === "object") Object.assign(where, opts.publicRead);

    const [items, total] = await Promise.all([
      model.findMany({ where, include: opts.include, orderBy: { [q.sortBy]: q.sortDir }, skip: q.skip, take: q.limit }),
      model.count({ where }),
    ]);
    res.json({ success: true, data: paged(items, total, q) });
  });

  const readOne = asyncHandler(async (req: Request, res: Response) => {
    const item = await model.findUnique({ where: { id: req.params.id }, include: opts.include });
    if (!item) throw ApiError.notFound();
    res.json({ success: true, data: item });
  });

  const maybeAuth = opts.publicRead
    ? [optionalAuth]
    : [requireAuth, authorize(`${resource}:view`)];

  r.get("/", ...maybeAuth, list);
  r.get("/:id", ...maybeAuth, readOne);

  r.post(
    "/",
    requireAuth,
    authorize(`${resource}:create`),
    ...(opts.createSchema ? [validate(opts.createSchema)] : []),
    asyncHandler(async (req, res) => {
      const data = opts.beforeCreate ? opts.beforeCreate(req.body, req) : req.body;
      const item = await model.create({ data });
      logActivity(req, "created", resource, (item as { id?: string }).id);
      await cacheDel(`${resource}*`);
      res.status(201).json({ success: true, data: item });
    }),
  );

  r.patch(
    "/:id",
    requireAuth,
    authorize(`${resource}:edit`),
    ...(opts.updateSchema ? [validate(opts.updateSchema)] : []),
    asyncHandler(async (req, res) => {
      const data = opts.beforeUpdate ? opts.beforeUpdate(req.body, req) : req.body;
      const item = await model.update({ where: { id: req.params.id }, data });
      logActivity(req, "updated", resource, req.params.id);
      await cacheDel(`${resource}*`);
      res.json({ success: true, data: item });
    }),
  );

  r.delete(
    "/:id",
    requireAuth,
    authorize(`${resource}:delete`),
    asyncHandler(async (req, res) => {
      await model.delete({ where: { id: req.params.id } });
      logActivity(req, "deleted", resource, req.params.id);
      await cacheDel(`${resource}*`);
      res.json({ success: true, message: "Deleted" });
    }),
  );

  return r;
}

/** Attaches req.auth if a valid token is present, but never rejects. */
import { NextFunction } from "express";
import { verifyAccessToken } from "./jwt";
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try { req.auth = verifyAccessToken(header.slice(7)); } catch { /* treat as anonymous */ }
  }
  next();
}
