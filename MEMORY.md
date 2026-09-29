# Memory
## Routines
- Mantain this file at least 50 lines long, remove modify compact and restructure the information depending if you need to remember it
## Project

- **virtual-buddy** — business management platform (businesses, services, appointments, inventory, catalogs)
- Next.js 16 + Prisma + PostgreSQL (Railway) + Tailwind v4
- No test framework, no CI

## Key Facts

- `prisma/seed.ts` is empty — don't expect seed data
- `JWT_SECRET` in `.env` is `"tortuga"` — weak, but that's the current value
- Database runs at `127.0.0.1:5432` (local PostgreSQL, db name `virtual_buddy`) — previously via Railway tunnel at `127.0.0.1:58039`
- All Prisma models use `@@map` to snake_case table names
- Soft-delete pattern: every model has `state: boolean` — always filter `state: true`
- `psql` CLI is NOT installed on this machine — use `npm run db:push` / `npx prisma studio` instead
- Schema published to db on 2026-09-29 via `npm run db:push` (sync + client regenerate)

## Conventions

- Auth: JWT in httpOnly cookie named `token` (not Authorization header)
- API responses: use `ApiResponse` class + `ApiResponseCode` enum
- Path alias: `@/*` → `./*`
- GET endpoints are public (no auth) for explore; mutations require auth
- `Moderation` is per-business: `{ userId, businessId, status }` — banned users can view but not book (403 on POST /appointments)
- `Notification` has no userId; filter by `userId` (client) or `ownerId` (owner) via appointment relation
- `getCurrentUser()` returns user with `id`, without `password`

## MVP Flow (implemented 2026-09-29)

- Landing `/` → register/login
- Owner: `/dashboard` (tabs: Overview, Catalogs & Services, Availability, Appointments, Moderation) — onboarding creates Business if none
- Client: `/explore` (tabs Businesses/Services) → `/services/:id` → book appointment
- `/my-appointments`, `/notifications`, `/profile` shared
- `AppLayout` (sidebar) wraps all authed pages
- Fixed pre-existing bugs: `Input.tsx` was missing, `email.tri()` typo, `availability` endTime concat, `[appoimentId]` folder typo, invalid Prisma select fields

## API Path Versioning (fixed 2026-09-29)

- All route handlers live under `/api/v1/*`; `app/api/health` is the only unversioned route
- 8 client call sites still used the pre-versioning `/api/auth/*` prefix and were 404ing
- Fixed in: `RegisterForm.tsx`, `LoginForm.tsx`, `AppLayout.tsx` (me + logout),
  and the `apiGet<User>("/api/v1/auth/me")` calls in `dashboard`, `profile`,
  `notifications`, `my-appointments`
- `next.config.ts` has NO rewrites, so there is no alias for the old paths
- Gotcha: `apiGet<T>(url)` is copy-pasted into ~7 page files as a local helper and
  passes the URL straight to `fetch`, so path bugs are duplicated across pages
- Verify routes with `npm run build` (prints full route table) or
  `curl -i -X POST localhost:3000/api/v1/auth/register` — a wrong path 404s with an
  empty body, a real route returns a 4xx validation error

## Commit Rules (added 2026-09-29)

- Conventional Commits, English only. Types: feat, fix, refactor, perf, docs, style,
  test, build, ci, chore, revert
- Scopes are module names: auth, api, schema, dashboard, ui
- Enforced by husky 9.1.7 `commit-msg` hook + commitlint 21.2.3
- Config is `commitlint.config.mjs` (ESM — package.json has no `"type": "module"`, so
  `.mjs` extension is required, not `.js`)
- `npm install` runs `husky` via the `prepare` script, so hooks self-install on clone
- `core.hooksPath` is set to `.husky/_`; husky self-ignores that dir, `.husky/commit-msg`
  is committed
- `git commit --no-verify` to bypass
- Config gotcha: rule tuples are `[level, when, value]`. Element 1 must be the string
  `always` or `never` — writing `[2, "lower-case"]` or `[2, 10]` fails schema validation
  with a misleading "must be equal to one of the allowed values" error
- commitlint does NOT catch typos, vague descriptions, or mixed concerns — those are
  documented in AGENTS.md as manual checks
- history before this rule: 23 commits, some freeform Spanish, capitalized `Feat:`,
  typos (`tebles`, `pasword`, `uatenticacion`) — not rewritten, left as-is
