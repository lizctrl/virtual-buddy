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

## Table Kit (2026-09-29)

- `app/components/table/Datatable.tsx` was an empty placeholder committed on
  2026-09-25 in `52cf22b` — implemented now, ~470 lines
- Presentational and generic: `<T>` rows, `Column<T>[]` with `accessor` +
  optional `render(row)`. No fetch, no data ownership
- Sorting is **controlled** (`sortBy` + `onSortChange`) because the API already
  supports `sortBy`/`sortOrder`; the table never reorders `rows`
- Selection is **uncontrolled** — internal `Set` keyed by `rowKey`, pruned to
  visible rows, notifies via `onSelectionChange(keys)`
- State precedence: `error` → `loading` (5 skeleton rows) → empty → rows
- Reuses `Pagination.tsx` unchanged, deriving `hasPreviousPage`/`hasNextPage`;
  only rendered when `onPageChange` is given and `totalPages > 1`
- `Pagination`'s `hasPreviousPage`/`hasNextPage` props are redundant (derivable
  from `page`/`totalPages`) — left alone to avoid churn while it has no consumers
- Clickable `<tr>` carries `tabIndex={0}` + Enter/Space `onKeyDown`; the
  selection and actions cells `stopPropagation` so they don't trigger `onRowClick`
- `ui/Checkbox.tsx` gained `indeterminate?: boolean` for the tri-state select-all.
  It needs `"use client"` + a `useRef`/`useEffect` because `indeterminate` is a
  DOM property, not an HTML attribute, so it can't travel through `...props`

## Lint Rule: no setState in useEffect

- `react-hooks/set-state-in-effect` (React Compiler rules) is an **error** here,
  not a warning. Pruning selection via `useEffect(() => setSelected(...))` fails
- The accepted alternative is adjusting state *during render* against a stored
  identity of the prop that changed (`prunedFor` holds the last `rows` array)
- Same rule will bite any future "sync state to prop change" code

## Shared API Client (fixed 2026-09-29)

- `app/lib/api/client.ts` — `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`,
  all returning a discriminated `ApiResult<T>`:
  `{ ok: true, data, message }` | `{ ok: false, data: null, message, code, status }`
- It normalizes the two response shapes: routes return the envelope
  `{ code, message, data }`, but `/api/v1/auth/me` returns the **bare** user.
  `unwrap()` pulls `data` when both `code` and `data` keys are present
- Replaced the 7 copy-pasted `apiGet` helpers in `dashboard`, `explore`,
  `my-appointments`, `notifications`, `profile`, `businesses/[id]`,
  `services/[id]`, plus the raw `fetch` in `AppLayout`
- **Why a Result and not `T | null`:** the old `?? []` collapsed every HTTP
  error into an empty list, which is exactly what hid the envelope bug for
  weeks. Callers must now branch on `.ok` and surface `.message`
- Undocumented shape: `/auth/register` also returns **bare** `{ user, token }`
  (no envelope), while `/auth/login` returns the envelope. LoginForm and
  RegisterForm read `result.message ?? result.error`, which tolerates both

## Fixed: appointment GET filters were mandatory

- `app/api/v1/appointment/route.ts` did `Number(userIdParam)` where
  `userIdParam` is `null` when absent, so `Number(null) === 0` and the
  `userId <= 0` guard rejected every request missing either filter
- Now `userIdParam !== null ? Number(userIdParam) : null`, guarding only when
  non-null — the same pattern `catalog/route.ts` and `notification/route.ts`
  already used
- Verified: `GET /api/v1/appointment?ownerId=2&state=true&limit=100` went from
  400 to 200

## 🚨 Auth Bypass: login accepted any password (fixed 2026-09-29)

- `auth/login/route.ts` did `const isPasswordCorrect = comparePassword(password, user.password)`
  **without `await`**. `comparePassword` is `async`, so the variable held a
  Promise, which is always truthy — `!isPasswordCorrect` was never `true` and the
  401 branch was dead code
- Every login succeeded with any password, for any account, and set a valid
  session cookie. Full authentication bypass
- TypeScript does not catch this: `!promise` is a legal expression
- **Always await bcrypt/jsonwebtoken helpers before branching on them**
- Caught only by asserting a wrong password returns 401, not by any linter or
  type check. Add that assertion to any future auth work

## Fixed: appointment `ownerId` is a USER id, not a business id

- The route filters `where.service = { catalog: { business: { ownerId } } }`,
  and `notification/route.ts` does the same — `ownerId` is the owner user id
- `dashboard/page.tsx` was passing `?ownerId=${businessId}` (the business id),
  so Overview and Appointments matched nothing and rendered zero rows
- Now `DashboardPage` passes `business.ownerId` down to both sub-components;
  `Appointments` takes only `ownerId` and `Overview` takes both ids
- The "business has no owner" message is derived during render, not stored in
  state from an effect, to satisfy `react-hooks/set-state-in-effect`
- The parameter name is still a trap for the next reader

## Fixed: availability/workingHours "HH:mm" parsing

- `startTime`/`endTime` are `DateTime` columns, but the UI sends
  `<input type="time">` values like `"09:00"` and every client interface already
  declared them as `string`. The routes did `new Date(data.startTime)`, which is
  Invalid Date → 400, so the Availability tab could never create a slot
- Added `app/lib/api/times.ts`: `toTimeOfDay(value, date?)` parses "HH:mm" (and
  full timestamps), `toTimeString()` renders back, `withTimeStrings()` maps a row
  pinned to UTC so values round-trip regardless of server timezone
- Availability anchors to `data.date`; workingHours has no date so it anchors to
  `1970-01-01`
- Applied to the list, create and `[id]` GET responses of both resources
- **Still the wrong column type.** The honest fix is `String` columns plus a
  Prisma migration, which needs `--accept-data-loss` on a non-empty table. Not
  done — this helper is the non-destructive stopgap

## Test Data Pollution (2026-09-29)

- End-to-end verification wrote real rows into the dev database: user 5,
  business 2, catalog 2, service 2, appointment 2, availability 2,
  workingHours 2, plus a notification
- `prisma/seed.ts` is empty, so there is no fixture to reset to



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
