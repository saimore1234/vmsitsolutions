import { Request } from "express";

export interface PageQuery {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export function parsePageQuery(req: Request, defaults: Partial<PageQuery> = {}): PageQuery {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || defaults.limit || 20));
  const sortBy = String(req.query.sortBy || defaults.sortBy || "createdAt");
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const search = req.query.search ? String(req.query.search) : undefined;
  return { page, limit, skip: (page - 1) * limit, search, sortBy, sortDir };
}

export function paged<T>(items: T[], total: number, q: PageQuery) {
  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}
