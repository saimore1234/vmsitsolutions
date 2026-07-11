import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { crudRouter } from "../../utils/crudFactory";
import { slugify } from "../../utils/slugify";

/**
 * Catalog resources built on the CRUD factory:
 * services, service categories, products, industries, team, clients,
 * testimonials, FAQ, branches. All publicly readable when active.
 */
export const catalogRoutes = Router();

const withSlug = (nameField = "name") => ({
  beforeCreate: (b: Record<string, unknown>) => ({ ...b, slug: slugify(String(b[nameField] ?? "")) }),
  beforeUpdate: (b: Record<string, unknown>) => (b[nameField] ? { ...b, slug: slugify(String(b[nameField])) } : b),
});

const serviceBody = z.object({
  name: z.string().min(2), shortDesc: z.string().optional().nullable(),
  description: z.string().optional().nullable(), icon: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(), price: z.number().optional().nullable(),
  categoryId: z.string().optional().nullable(), isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(), gallery: z.array(z.string()).optional(),
  metaTitle: z.string().optional().nullable(), metaDescription: z.string().optional().nullable(),
});

catalogRoutes.use("/services/categories", crudRouter({
  resource: "services", model: prisma.serviceCategory, searchFields: ["name"], defaultSort: "name",
  publicRead: true, ...withSlug(),
}));
catalogRoutes.use("/services", crudRouter({
  resource: "services", model: prisma.service, searchFields: ["name", "shortDesc"],
  include: { category: true }, defaultSort: "sortOrder", publicRead: { isActive: true },
  createSchema: z.object({ body: serviceBody }), updateSchema: z.object({ body: serviceBody.partial() }),
  ...withSlug(),
}));

const productBody = z.object({
  name: z.string().min(2), shortDesc: z.string().optional().nullable(),
  description: z.string().optional().nullable(), icon: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(), features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(), sortOrder: z.number().int().optional(),
  metaTitle: z.string().optional().nullable(), metaDescription: z.string().optional().nullable(),
});
catalogRoutes.use("/products", crudRouter({
  resource: "products", model: prisma.product, searchFields: ["name", "shortDesc"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
  createSchema: z.object({ body: productBody }), updateSchema: z.object({ body: productBody.partial() }),
  ...withSlug(),
}));

catalogRoutes.use("/industries", crudRouter({
  resource: "industries", model: prisma.industry, searchFields: ["name"],
  defaultSort: "sortOrder", publicRead: { isActive: true }, ...withSlug(),
}));

catalogRoutes.use("/team", crudRouter({
  resource: "team", model: prisma.teamMember, searchFields: ["name", "designation"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));

catalogRoutes.use("/clients", crudRouter({
  resource: "clients", model: prisma.client, searchFields: ["name", "industry"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));

catalogRoutes.use("/testimonials", crudRouter({
  resource: "testimonials", model: prisma.testimonial, searchFields: ["name", "company"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));

catalogRoutes.use("/faq", crudRouter({
  resource: "faq", model: prisma.faq, searchFields: ["question"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));

catalogRoutes.use("/branches", crudRouter({
  resource: "settings", model: prisma.branch, searchFields: ["name", "city"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));

catalogRoutes.use("/banners", crudRouter({
  resource: "settings", model: prisma.banner, searchFields: ["title"],
  defaultSort: "sortOrder", publicRead: { isActive: true },
}));
