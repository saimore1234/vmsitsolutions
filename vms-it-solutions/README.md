# VMS IT Solutions — Enterprise Website, CMS, CRM & Admin Portal

A production-grade monorepo for an ERP consulting company: a public marketing site whose content
is fully driven by an admin portal, backed by a REST API with JWT auth, RBAC, audit logs,
lead management (CRM), blog CMS, dynamic page builder, media library and career portal.

## Stack

| Layer      | Tech |
|------------|------|
| Frontend   | Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 |
| Backend    | Node.js · Express · TypeScript · Zod validation |
| Database   | PostgreSQL 16 via Prisma ORM |
| Cache      | Redis 7 (public-content caching; API degrades gracefully without it) |
| Auth       | JWT access tokens + rotating httpOnly refresh cookies, bcrypt hashing, force-logout via token versioning |
| Security   | Helmet, CORS allow-list, rate limiting (global / auth / public forms), Prisma-parameterised queries, audit + login + error logs |
| Deploy     | Docker & Docker Compose (4 services), Next standalone output |

## Quick start

```bash
cp .env.example .env          # set real JWT secrets
docker compose up --build     # postgres + redis + api + web
```

Then seed the database (roles, full permission matrix, super admin, catalog content):

```bash
docker compose exec backend npx prisma db seed
```

- Website → http://localhost:3000
- Admin portal → http://localhost:3000/login — `admin@vmsitsolutions.com` / `Admin@12345` (change immediately)
- API health → http://localhost:4000/health

### Local development (no Docker)

```bash
# terminal 1
cd backend && cp .env.example .env && npm i
npx prisma migrate dev && npm run seed && npm run dev

# terminal 2
cd frontend && cp .env.example .env && npm i && npm run dev
```

## Architecture

```
backend/
  prisma/schema.prisma      # ~45 tables: RBAC, settings, CMS, CRM, careers, media, logs
  prisma/seed.ts            # roles, permission matrix, super admin, catalog content
  src/
    config/                 # env, prisma client, redis (cache helpers)
    middleware/             # requireAuth, authorize(RBAC), validate(Zod), rate limits,
                            # central error handler (writes error_logs), audit logger
    utils/                  # ApiError, jwt (access + rotating refresh), pagination,
                            # crudFactory — generic REST resource generator
    modules/
      auth/                 # login, refresh rotation w/ reuse detection, logout, me, change password
      users/                # CRUD + reset password, lock/unlock, force logout
      roles/                # roles + full permission matrix editor
      company/              # singleton settings: company/website/theme/smtp + logos + social
      leads/                # public forms → CRM: search, filters, assign, remarks, CSV export
      blogs/                # posts, categories, tags, scheduling, public slug route, view counts
      services/             # catalog: services, products, industries, team, clients,
                            # testimonials, faq, branches, banners (via crudFactory)
      careers/              # jobs + public apply + application tracking pipeline
      media/                # multipart uploads (type allow-list), folders, rename, delete
      pages/                # dynamic page builder: pages = ordered JSON sections, cached
      dashboard/            # analytics stats, page-view beacon, logs viewers, notifications
frontend/
  src/app/                  # public homepage (fully API-driven, ISR 60s)
    login/                  # admin sign-in
    admin/                  # portal: dashboard, leads CRM, company settings
  src/components/site/      # navbar, hero (ERP module node-graph), sections, contact form
  src/lib/api.ts            # fetch client with silent refresh-token retry
```

### RBAC model

Permissions are `resource:action` pairs (17 resources × 9 actions, seeded). Roles hold sets of
permissions; `resource:manage` implies every action on that resource; the `super-admin` role
bypasses checks. Route guards read permissions from the JWT, and `tokenVersion` on the user row
lets admins invalidate every issued token instantly (force logout / password reset).

### Refresh-token security

Refresh tokens are opaque 384-bit random strings stored only as SHA-256 hashes, delivered as
httpOnly cookies scoped to `/api/v1/auth`, and **rotated on every use**. Reuse of a revoked token
revokes the user's entire session family (theft detection).

### API conventions

`GET /api/v1/<resource>?page=&limit=&search=&sortBy=&sortDir=&f_<field>=` — every list endpoint
supports pagination, search, sorting and equality filters, and returns
`{ success, data: { items, pagination } }`. Errors return `{ success: false, message, details }`.

## Module status

Built and wired end-to-end in this foundation:
auth · users · roles/permissions · company/website/theme/smtp/logo/social settings ·
leads CRM (+ export, remarks, notifications) · blog CMS · services/products/industries/
team/clients/testimonials/faq/branches/banners · careers + applications · media library ·
dynamic page builder · analytics dashboard · activity/login/error logs · newsletter ·
languages & translations (schema + seed-ready).

Admin UI screens shipped: dashboard, leads CRM, company settings, login. Remaining admin
screens (users, roles, blog editor, page builder UI, media browser, careers, theme editor)
follow the exact same `api()` + table/form patterns as `admin/leads` and
`admin/settings/company` — each is a single page component against an API that already exists.

Deliberately deferred (need product decisions or external accounts): OTP/Google login,
SMTP sending (settings stored; wire nodemailer transport in `smtp_settings`), WhatsApp/SMS/push
providers, payment gateway, GSAP/Three.js embellishments, multi-language UI switching.

## Production notes

- Set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`; put the stack behind TLS (the refresh
  cookie is `secure` in production).
- Postgres and Redis are volume-backed; back up `pgdata` and the `uploads` volume.
- Horizontal scaling: the API is stateless (sessions live in Postgres/JWT), so run multiple
  backend replicas behind a load balancer; Redis cache is shared.
