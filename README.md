# AGRI HUB — GRIS Canada's agri-food marketplace & ecosystem

AGRI HUB connects British Columbia's fresh-produce ecosystem: growers, buyers (retail, food service, processors, exporters), universities, consultants, EDC / FCC / financing, BC & federal government programs, ag-tech, suppliers, equipment dealers and sales & marketing partners. It is the MVP of the GRIS Canada initiative (Abbotsford hub) and is designed to be mounted at **griscanada.org/hub** with the same branding.

> Non-profit framing: AGRI HUB is a *sector-development and connection tool*. It takes no commission on deals between members.

## What's inside

| Area | Highlights |
|---|---|
| Marketplace | Harvest-window-aware listings (in season / pre-order), multi-photo upload (drag & drop + phone camera, compressed in the browser), filters (category, region, certification, season), text search, sort by newest / price / distance / harvest, grid + map view, saved searches with "notify me" alerts, favourites, lot traceability QR + public trace page |
| Connect | In-app messaging with read receipts & unread badges, structured RFQ → quote → accept/decline workflow, demand board (buyers post needs; matching growers are notified), offers to supply |
| Directory | 9 stakeholder types + Processors / Suppliers / Dealers tabs (the "eight doors" of griscanada.org/hub), map view, verified badges, reviews (only between members who exchanged an RFQ), unclaimed profiles for real organisations with a claim workflow |
| Programs hub | Grants, financing, export support, courses, research, demos — one-click "express interest" → partner leads pipeline |
| Events | Webinars, farm tours, workshops, trade shows; RSVP with capacity |
| Community | Spaces (Circle/Mighty-style), posts, comments, reactions, pinned announcements |
| Dashboards | Grower (KPIs from DB, demand-signal chart, recommended actions, listings table), buyer (quotes, demand, supply matches), partner (programs, leads, events) |
| Admin console | Approvals queue (listings, profiles, programs, events, demand, certificates), user management (suspend, verify, revoke sessions), reports & claims, configurable KPI targets (5-year plan + 90/180-day goals), settings (pre/post moderation, announcement, email-verification rule), community spaces, regions (expand to new provinces/countries without code), audit log, outgoing mailbox, assisted "create listing for a grower" |
| Platform | REST API `/api/v1/*` (ready for a mobile app), PWA (installable, offline page), SEO (sitemap, robots, per-page metadata), market insights page (price index, supply vs demand) |

## Three separate sign-ins

| Portal | URL | Who |
|---|---|---|
| Members | `/login` | Growers and buyers |
| Partners | `/partners/login` | Universities, consultants, EDC/FCC/financing, government, ag-tech, suppliers, dealers, sales & marketing |
| Admin | `/admin/login` | GRIS Canada staff (8-hour sessions, two-factor recommended) |

One account system underneath; the API refuses sign-in through the wrong portal and points to the right one.

**Demo accounts** (local seed data only) are listed at the top of [`prisma/seed.ts`](prisma/seed.ts), together with the shared demo password. Change or remove them before any public deployment.

## Security layers

- **Passwords:** Argon2id (OWASP parameters), strength rules, constant-time responses for unknown emails.
- **Sessions:** signed JWT in an `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie, re-validated against the DB on every request; `sessionVersion` revokes all sessions on password change, suspension or "sign out everywhere".
- **Two-factor (TOTP, RFC 6238)** for any account; admins are nudged to enable it.
- **Brute force:** per-IP and per-account rate limits, account lockout after 5 failures (with email alert).
- **CSRF:** `Sec-Fetch-Site` / `Origin` checks on every state-changing API call (in `src/proxy.ts`).
- **CSP:** per-request nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`; plus HSTS (prod), nosniff, referrer and permissions policies.
- **Uploads:** short-lived HMAC-signed upload URLs, content-type allow-list, size limits, magic-byte sniffing, sandboxed media responses; media URLs must come from our own storage.
- **Authorisation:** role + ownership checks on every route, IDOR-safe thread access, admin-only moderation.
- **Validation:** Zod on every input; React escaping on output; no raw HTML from users.
- **Audit log** for sign-ins, lockouts, 2FA changes and every admin action.
- **Tokens** (email verification, password reset) are random, single-use, expiring and stored only as SHA-256 hashes.

## Tech stack

Next.js 16 (App Router, React 19, React Compiler-ready, Turbopack) · TypeScript strict · Tailwind CSS v4 · PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) · jose · @node-rs/argon2 · Zod · Leaflet/OpenStreetMap · S3/R2 presigned uploads · SendGrid (optional).

**Deviation from the original plan:** a single Next.js app with REST route handlers (`src/app/api/v1`) instead of a separate NestJS service. That's faster to ship and host, and the API is versioned and stateless, so it can be split out later. PostGIS is optional: lat/lng are stored as numbers and distance sort uses haversine.

## Run it locally (Windows / macOS / Linux, no Docker needed)

```bash
npm install
```

```bash
npm run db:start
```
Starts a real local PostgreSQL (UTF-8) on port 54329 with data in `.data/`. Leave it running in its own terminal.

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```
Loads Abbotsford/Fraser Valley sample growers, buyers, partners, 21 listings, programs, events and community posts. Re-running it **wipes** the database.

```bash
npm run dev
```
Open http://localhost:3000 (or set a port with `npx next dev -p 3100` and update `APP_URL`).

Other scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:reset`.

### Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | 32+ random characters (sessions, signed upload URLs) |
| `APP_URL` | Public base URL incl. base path, e.g. `https://griscanada.org/hub` |
| `NEXT_PUBLIC_BASE_PATH` | `/hub` when mounted under griscanada.org/hub (empty for a root domain) |
| `STORAGE_DRIVER` | `local` (dev), `db` (store images in Postgres — simplest hosting), `s3` (S3/R2, recommended at scale) |
| `S3_*` | Bucket, endpoint (R2), keys and public base URL when `STORAGE_DRIVER=s3` |
| `SENDGRID_API_KEY`, `EMAIL_FROM` | Real email delivery; without it emails are stored in **Admin → Mailbox** |
| `RATE_LIMIT_SCALE` | Keep `1` in production (raised only for QA load tests) |

## Deploying

**Fastest (pilot):** Vercel + Neon (or Prisma Postgres) with `STORAGE_DRIVER=db`.

1. Create a Postgres database and set `DATABASE_URL`.
2. Set `JWT_SECRET`, `APP_URL`, `STORAGE_DRIVER=db` (or R2 keys + `STORAGE_DRIVER=s3`), and optionally `SENDGRID_API_KEY`.
3. Build command `npx prisma migrate deploy && next build`.
4. Seed only a staging database. In production, create the first admin with a one-off script, then turn on two-factor.

**At scale:** move images to Cloudflare R2 (`STORAGE_DRIVER=s3`), move the in-memory rate limiter to Redis/Upstash (`src/server/security.ts`), and replace message polling with WebSockets or Pusher (`src/components/ThreadView.tsx`).

### Mounting at griscanada.org/hub

1. Deploy AGRI HUB with `NEXT_PUBLIC_BASE_PATH=/hub` and `APP_URL=https://griscanada.org/hub`.
2. On the griscanada.org site, proxy `/hub` and `/hub/*` to the AGRI HUB deployment (e.g. a Vercel/Netlify rewrite `"/hub/:path*" → "https://<agri-hub-deployment>/hub/:path*"`, or an nginx `location /hub`).
3. Cookies are scoped to `/hub`, so they don't collide with the main site. The brand tokens (Archivo + Newsreader, pine `#0C3520`, gold `#BC8A2E`, cream `#FBFAF5`, 18px cards) are copied from griscanada.org, so the two sites look like one.

## Project structure

```
src/
  app/
    (site)/            public site, auth pages, member dashboard, messages
    admin/             admin login + (console) pages
    api/v1/            REST API (auth, listings, profile, uploads, threads, rfqs, demand, resources, events, posts, reviews, reports, notifications, admin)
    media/[...key]     serves uploaded files for local/db storage
  components/          UI kit, layout, listings, forms, charts, admin
  server/              session, security, api wrapper, guards, queries, storage, notify, settings
  lib/                 constants (roles, categories, certifications), utils, client fetch, base-path helper
  proxy.ts             CSP nonce, CSRF guard, route protection (Next 16 "proxy", formerly middleware)
prisma/                schema, migrations, seed, placeholder art generator
docs/                  competitive analysis, QA reports
scripts/db.mjs         local embedded PostgreSQL
```

## Out of scope for this MVP (per the GRIS plan)

Payments / Stripe Connect, SMS, native mobile apps, multi-language (EN/Punjabi/FR is Phase 2), Elasticsearch/Algolia, bulk CSV upload, and a Calendly-style scheduler.

## AI assistant

`Ask AGRI HUB` (bottom-right on every public page) answers questions with Claude (`claude-opus-5-5`). It uses read-only tools over listings, the directory, Buy BC products, programs, events and buyer demand (`src/server/assistant.ts`). Set `ANTHROPIC_API_KEY` to enable AI answers. Without a key, or if the API is unavailable, it falls back to a keyword search over the same data. The endpoint is rate limited (20 questions per 10 minutes per user/IP).

## Buy BC data

`prisma/data/buybc.json` is generated from the Buy BC workbook (968 organisations, 10,413 products). `npm run db:seed` imports them as unclaimed directory entries with a `BuyBcProduct` catalogue.

## Production seed

Set `SEED_PASSWORD` when seeding any public database, so the demo accounts don't use the documented local password.
