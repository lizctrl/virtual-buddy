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
  2026-09-25 in `52cf22b` — implemented now
- Presentational and generic: `<T>` rows, `Column<T>[]` with `accessor` +
  optional `render(row)`. No fetch, no data ownership
- **`Column.sortBy` exists because `key` is not a field name.** A column keyed
  `service` that renders `a.service.name` must declare `sortBy: "serviceId"`,
  otherwise clicking its header sends `sortBy=service` and `parseSorting`
  rejects it with 400. `sortBy` defaults to `key`, so the bug only appears the
  moment a key and a backend field diverge
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
- **First adopter:** the dashboard Appointments tab. It pages with `limit=10`
  off the route's `pagination` block, which also removed a silent `limit=100`
  cap that dropped appointments past the hundredth


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

## Prisma Seed (added 2026-09-29)

- `prisma/seed.ts` was empty; it now writes dev fixtures
- Every row is an `upsert` on a pinned id in the **9000 block**, so re-running
  refreshes instead of duplicating, and nothing outside that block is touched
  (the dev DB already had users 1-4, business 1 and a moderation from before,
  so a wipe was not an option)
- `syncSequences()` pushes each table's sequence past the seeded ids. Without it
  the app would try to reuse an id from the block. It uses `$executeRawUnsafe`
  because the table name is an identifier and cannot be parameterised
- Ids only move forward: rows the app creates after a seed continue upward from
  9000, so ids stop distinguishing fixtures from real data after the first run
- Credentials: `owner@virtualbuddy.test`, `client@virtualbuddy.test`,
  `banned@virtualbuddy.test`, all with `password123`. The banned one is barred
  from the studio so the 403 booking path is reachable
- **Gotcha:** `tsx` was missing from devDependencies even though `db:seed` calls
  it, so `npx` was downloading it on every run. Added
- **Gotcha:** the project is CJS (no `"type": "module"`), so `tsx` rejects
  top-level `await` with `ERR_REQUIRE_ASYNC_MODULE`. Same root cause as
  commitlint needing `.mjs`. The seed wraps everything in `main()`
- `prisma/seed.ts` is covered by `tsc --noEmit` — tsconfig `include` is
  `["**/*.ts"]`, so seed code must type-check
- Passwords hash with `bcryptjs` directly, not `app/lib/auth.ts`: that module
  imports `next/headers` and throws without `JWT_SECRET`, neither of which
  belongs in a standalone script

## Test Data Pollution (2026-09-29)

- End-to-end verification left manual rows in the dev database alongside the
  seed: user 5, business 2, catalog 2, service 2, appointments 2-7,
  availability 2, workingHours 2, plus notifications
- Those predate the seed and are still there. The seed's 9000 block does not
  cover them; a wipe would remove them along with the older users 1-4




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

## Self-service booking (2026-11-07)

- `/services/:id` shows available dates and times publicly. The existing
  client account is required to confirm. Sign-in returns to that service.
- `app/lib/booking.ts` is the source of availability for both the public
  picker and booking creation. It offers the next 60 days in Costa Rica time,
  using weekly windows, dated openings, exclusions and existing appointments.
- One appointment occupies the business across all its services. Booking
  writes, rescheduling, cancellations and creation of business-wide blocks
  share a PostgreSQL transaction advisory lock keyed by business id.
- New services default to 30 minutes. The duration can be set in the service
  panel and a new appointment snapshots its end time. Legacy active appointments
  without an end time occupy 30 minutes. Cancelling preserves the record and
  makes the time available again if it is still in the configured calendar.
- Resend receives a separate confirmation for each recipient. Enable it using
  `RESEND_API_KEY` and `BOOKING_EMAIL_FROM`. Provider acceptance is tracked in
  the response, with transient retry and an idempotency key. A mail failure
  leaves the booking confirmed. No background retry queue is configured.
- Prisma schema was applied to the local DB. An isolated schema was used to
  verify overlapping requests, automatic confirmation, permissions, cancellation,
  blocks and the two email recipients using a simulated provider.

## Local hydration report (2026-11-07)

- `/services/9301` on port 3000 loaded without hydration errors in a clean
  Chrome context. Server and live root attributes matched, and the slots
  endpoint returned HTTP 200.
- Injecting `data-lt-installed` and `suppresshydrationwarning` on `html` and
  `cz-shortcut-listen` on `body` before hydration reproduced the reported diff.
  These attributes were absent from the server HTML. The app required no code change.

## Pending appointments after switching booking flows

- The old appointment POST defaulted to `pending`. Seed fixtures also include
  pending rows. Existing pending appointments still hold their time and can
  be confirmed or rejected manually by the owner in the Citas tab.
- Verified in the local API that the reported 8:54 a.m. appointment on Nov 8
  is the stored pending row #9405. The later 9:30 a.m. row #9406 is confirmed.
  New self-service reservations persist as confirmed before email submission.

## Owner agenda calendar

- The Dashboard opens with the selected business's monthly Agenda. Choose a
  date for the client's name, service, time, status and appointment actions.
  The day detail is beside the month on wide screens and below it on mobile.
- The agenda uses the existing appointment and schedule block routes with
  range filters. It includes adjacent dates in the visible grid and fetches
  every appointment page for that interval.

## Daily agenda and appointment details

- A date click switches from Mes to Día. The day timeline and mini-calendar
  share the selected date in Costa Rica time. The timeline puts overlapping
  appointments in separate lanes and marks schedule blocks.
- Double-clicking a timeline appointment opens an anchored dialog. The event
  details button and daily list also open it. The dialog includes service,
  status, reservation number, time, duration, client contact and booking note.
- Booking POST accepts an optional description of up to 500 characters.
  Existing appointments have a null description. The schema was pushed to
  local PostgreSQL and the dev server refreshed to load the regenerated client.

- The daily toolbar uses «Volver al calendario» in place of the Day/Month
  switch. The monthly view keeps and highlights the date the user came from.

## Catalog and service management

- CatalogsServices lives under app/components/dashboard. It displays active
  services grouped by catalog, with a sidebar filter and inline editors.
- Successful creates and duration edits update the list from the API response.
  Changing the dashboard business remounts the panel and clears its selection.

## Availability panel

- BusinessAvailability uses the agenda's indigo and lavender styling and
  selects the first active service initially. A service change remounts its
  schedule editor so old requests and drafts cannot appear under another service.
- Weekly rows are ordered Monday to Sunday. Block, weekly, and dated forms
  open on demand and update their lists from existing API responses.

## Explore directory

- Explore lists all active businesses and supports accent-insensitive search
  by business name, description, catalog, or service. Business cards use
  initials and a deterministic color because the schema has no logo field.
- Business profiles are publicly readable and offer the existing service
  slot picker. A booking still requires an account. Businesses without an
  active owner or services remain visible in the business directory but do
  not offer booking links.

## Mis citas calendar

- Mis citas uses AppointmentCalendar in personal mode for the same month,
  day and appointment dialog as the owner agenda. Events show the service
  and business name. Personal mode has no owner actions or schedule blocks.
- Appointment GET supports `mine=true` to filter by the authenticated client
  and `business=true` to include the associated business ID and name.

## Notification inbox design

- The navigation and inbox header use a bell icon. The inbox groups notices
  by local date, shows event-specific icons, and pages the existing feed.
- The notification list's optional appointment payload includes the client
  name, service, and business. It formats legacy booking notices in Spanish
  with the appointment's current time.

## Profile and menu icons

- Mi perfil shows account details and a picture URL editor. It previews the
  draft image, falls back to initials, and shows save feedback in Spanish.
- The profile reads the newest active record with `picture=true`. Previously
  the list ignored the user filter and omitted the image by default, and POST
  created a new row on every save. Profile access is now limited to its owner.
- The main menu uses consistent outline icons and Spanish labels.

## Owner and client workflow audit

- flujo-dueno-y-cliente.txt records the current dual-context workflow, UI
  limits, API-only actions, and priorities. Highest priority is ownership
  enforcement for catalog and moderation writes and user deactivation.

- Mi perfil now has an Editar datos form for name, surname and phone, with
  immediate updates in the account header and sidebar. The owner/client
  workflow report includes a suggested customer cancellation policy.
