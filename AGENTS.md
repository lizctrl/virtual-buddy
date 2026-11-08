<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

- **Next.js 16.3.3** (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **PostgreSQL** via Prisma ORM (local only for now: there is no production
  database or deploy yet; the planned app host is Vercel)
- **Auth**: JWT in httpOnly cookie (`token`), bcryptjs password hashing

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint (flat config)
npm run db:generate  # regenerate Prisma client (run after schema changes)
npm run db:push      # sync schema to database
npm run db:seed      # dev fixtures (see below)
npm run db:constraints # lowercase-email CHECK (after db:push)
```

`npm test` runs Vitest (`tests/**/*.test.ts`). It needs `npm install` and a
local PostgreSQL with `DATABASE_URL` in `.env`. `vitest.config.ts` points `DATABASE_URL` at `<dev db>_test` on the
same server, or at `TEST_DATABASE_URL` (shell or `.env.test.local`; its name
must also end in `_test`), then runs `prisma db push`, which creates the
database if the role may (otherwise run `createdb virtual_buddy_test`), and
`npm run db:constraints` against that same test database.
The guard rejects non-localhost hosts, but a tunnel on 127.0.0.1 passes it:
the `_test` suffix is the real safeguard. `tests/isolation.test.ts` truncates
every table in its `beforeAll`; a new test file must set up its own rows.
Route handlers are called directly with `getCurrentUser` mocked. The suite
covers cross-business reads/writes and concurrent double booking.

`db:seed` runs `prisma/seed.ts` through `tsx`. It writes every row with an
`upsert` on a pinned id in the 9000 block, so it is idempotent and does not
wipe anything. Sign in with `owner@virtualbuddy.test` / `password123`; there is
also a `client@` and a `banned@` variant, the latter barred from the studio so
the 403 booking path is reachable.

Gotcha: the project is CJS (no `"type": "module"` in package.json), so
`tsx` refuses top-level `await`. The seed wraps its body in `main()`.

## Database

- Schema: `prisma/schema.prisma` — models use `@@map` to snake_case table names (e.g., `User` → `users`)
- All models have a `state: boolean` field — always filter with `state: true` in queries (soft-delete pattern)
- After editing `schema.prisma`, run `npm run db:generate` then `npm run db:push`
- An API 500 with an empty body after pulling schema changes usually means
  the local database is behind the schema (e.g. missing `businesses.cantonCode`).
  Preview with `npx prisma migrate diff --from-url "$DATABASE_URL"
  --to-schema-datamodel prisma/schema.prisma --script`, then `npm run db:push`
  and `npm run db:constraints`

## Auth

- `app/lib/auth.ts` — `hashPassword`, `comparePassword`, `generateToken`, `verifyToken`, `getCurrentUser`
- `getCurrentUser()` reads the JWT from the `token` cookie (not an `Authorization` header)
- Login sets an httpOnly cookie with `secure: process.env.NODE_ENV === "production"`

## API Routes

- All routes live under `app/api/v1/<resource>/route.ts` (versioned)
- `app/api/health` is intentionally unversioned (infrastructure-level)
- Use the `ApiResponse` class and `ApiResponseCode` enum from `app/lib/api/responses.ts` for consistent responses
- Helpers in `app/lib/api/`: `parsePagination`, `sorting`, `ranges`, `boolean`
- **Never call `fetch` directly from a component.** Use `app/lib/api/client.ts`
  (`apiGet`/`apiPost`/`apiPut`/...). It unwraps the `ApiResponse` envelope and
  the two bare routes (`/auth/me`, `/auth/register`) into one shape, and returns
  a `ApiResult<T>` discriminated union. Branch on `.ok` and surface `.message` —
  collapsing failures to an empty list is what hid the envelope bug for weeks
- Path alias: `@/*` maps to project root (`./*`)
- `ownerId` on `appointment` and `notification` means the **owner user id**,
  not a business id. `business?ownerId=` takes the user id too
- `startTime`/`endTime` are `DateTime` columns but the API exchanges them as
  `"HH:mm"` strings. Go through `app/lib/api/times.ts` rather than
  `new Date(...)` — the raw ISO string used to leak straight into the UI
- **Always `await` the helpers in `app/lib/auth.ts`.** They are `async`, and a
  forgotten `await` leaves a truthy Promise in a boolean context — that bug once
  made login accept any password, and neither the type checker nor the linter
  caught it

## Conventions

- Tailwind CSS v4 via `@tailwindcss/postcss` — no `tailwind.config.js`
- ESLint flat config (`eslint.config.mjs`) with custom `globalIgnores` overriding eslint-config-next defaults
- `app/layout.tsx` uses `LayoutProps<">"` — a Next.js 16 typed-routes feature
- Table kit lives in `app/components/table/`: `Datatable.tsx` (generic, presentational)
  pairs with `Pagination.tsx` (dumb, driven by props)
- `Datatable` sorting is **controlled** — it never reorders `rows`, it only emits
  `onSortChange` so the page can refetch. Selection is **uncontrolled** (internal
  `Set`, pruned to visible rows on change)
- A `Column`'s `key` is its identity, not a field name. If the column is sortable
  and the key is not a field the route accepts, set `sortBy` explicitly —
  otherwise the header click sends a value `parseSorting` rejects with a 400
- React Compiler lint rules are on: no `setState` inside `useEffect`. Adjust state
  during render when syncing to changed props instead

## Commits

Format is [Conventional Commits](https://conventionalcommits.org), English only.

```
<type>(<optional scope>): <description>
```

- **Types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes**: the module touched — `auth`, `api`, `schema`, `dashboard`, `ui`
- Lowercase type, lowercase description, no trailing period, ≤72 chars in the header
- Description states *what changed and why*, in the imperative: `add`, not `added` / `adding`

```bash
feat(api): add register route
fix(auth): point client fetches at v1 auth routes
refactor(schema): add state column to tables
chore(deps): add husky and commitlint
```

Enforced by `commitlint.config.mjs` via a husky `commit-msg` hook. A non-conforming
message is rejected at `git commit` time. Bypass deliberately with
`git commit --no-verify` only for throwaway/WIP commits.

**Not enforced by tooling — check these yourself before committing:**
- Spelling. commitlint validates structure, not typos (`tebles`, `pasword` have both landed in this history).
- Clarity. `fix: change the to remove token cookie` passes the linter but is useless in a `git bisect`. Name the module and the intent.
- Atomicity. One logical change per commit — don't mix the API v1 move with unrelated edits.

## Rules

- Modify AGENTS.md y MEMORY.md after each task

## Booking calendar

- Public availability comes from `GET /api/v1/service/[serviceId]/slots`. Use
  its timestamps when posting a booking. The API confirms automatically and
  checks the timestamp again under a PostgreSQL transaction lock per business.
- Weekly hours and dated openings use Costa Rica wall-clock values. Bookings
  and business-wide blocks store instants. Format those with
  `app/lib/calendar.ts` so browser timezones do not change what users see.
- Set `RESEND_API_KEY` and `BOOKING_EMAIL_FROM` (a verified Resend sender) in
  the server environment to email both parties. The booking is committed before
  email submission, and its API response includes the email outcome.

- Existing appointments with `pending` came from the earlier request flow or
  seed fixtures. Keep their stored status until the owner resolves them.
  Booking confirmation status is separate from the email submission outcome.

## Hydration diagnostics

- If a development hydration diff shows unfamiliar attributes on `html` or
  `body`, compare the server response with the live DOM in a clean browser
  context. Browser extensions can modify the DOM before React hydrates.

## Owner agenda

- The owner dashboard opens on Agenda. Keep the daily details and month cells
  in Costa Rica time. Fetch the whole visible grid using `dueDateFrom` and
  exclusive `dueDateTo` on appointment GET, and follow the returned pagination.
- Schedule block GET accepts `from` and `to` to find overlapping blocks for
  the grid. The availability panel omits the range to show current blocks.

- Selecting a date in Agenda opens the day timeline. Double-click a timeline
  event or use its details button to open the appointment dialog.
- Appointment descriptions are optional booking notes. In appointment GET,
  only the owner agenda query (matching ownerId and businessId) includes the
  description and client contact details. Restart a running Next dev server
  after generating the Prisma client for a schema change.

- Day view exposes a labeled return button. Returning to the month keeps
  the selected date and restores focus to that day in the grid.

- The Catalogs and Services panel uses the agenda's indigo and lavender
  palette. Keep the catalog filter and service list scoped to the selected
  business. Reuse the existing catalog and service endpoints for edits.

- The Availability panel separates business-wide blocks from the selected
  service's weekly hours and dated openings. Keep full-day end dates inclusive
  in the form and convert them to an exclusive midnight in the block request.

## SEO and brand assets

- `app/lib/site.ts` builds the public origin used by `metadataBase`, canonical
  URLs, Open Graph images, `robots.txt` and `sitemap.xml`. Order:
  `NEXT_PUBLIC_SITE_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL`
  (as `https://`), then `http://localhost:3000`. On Vercel nothing needs
  setting; set `NEXT_PUBLIC_SITE_URL` (Vercel project environment variables)
  only for another domain, as the full origin with scheme, e.g.
  `https://<domain>`. `NEXT_PUBLIC_*` is inlined at build, so redeploy after
  changing it. A value without a scheme makes `new URL()` throw and the build
  fail. Off Vercel and without it, nothing fails but every URL points at
  localhost, so search engines index nothing useful.
- Root metadata is Spanish (`lang="es"`, `es_CR`) with a `%s · Virtual Buddy`
  title template. Never put `alternates.canonical` in a layout that wraps other
  pages: children inherit it. Set it per page.
- `app/robots.ts` keeps signed-in areas and `/api/` out. `app/sitemap.ts` is
  rendered per request (the build never needs the database) and lists public
  businesses and their active services; the query is cached for an hour with
  `unstable_cache`, which never stores a failed call. If the database is
  unreachable, that one response has only `/` and `/explore`. Business and service detail pages are client components, so
  their titles come from `generateMetadata` in a sibling `layout.tsx`: unknown
  ids get `noindex`, a database error falls back to a generic title, and they
  pass the parent's `openGraph.images` on because a page-level `openGraph`
  replaces the root one.
- "Public" means `publicBusinessWhere` (`app/lib/public-business.ts`): the
  business and its owner's account are active. The directory, business
  detail, sitemap and both detail `generateMetadata` share it; keep them
  together.
- Brand images are rendered with Lienzo from the designs in `design/brand/`.
  Lienzo is the owner's internal JSON-to-PNG tool and is not public; without
  it, each JSON still records the image's size, colours, shapes and text, so
  it can be redrawn by hand. The JSON files are the reference for every
  colour and position (e.g. the icon's light dot, the card's `#4338ca`
  background). The same design gives byte-identical output on the same Chrome:
  - `icon-512.json` -> `app/icon.png`; `apple-icon-180.json` -> `app/apple-icon.png`
  - `social-card.json` -> `app/opengraph-image.png` and `app/twitter-image.png`
    (content kept inside the centred 630x630 so square crops such as
    WhatsApp's still show it); alt text in the matching `.alt.txt` files
  - `favicon-16/32/48.json` -> three PNGs, then
    `node design/brand/make-ico.mjs app/favicon.ico <16.png> <32.png> <48.png>`
    packs them (it re-reads the result as a self-check).

## Public directory

- Explore loads active businesses across all owners from the paginated
  directory endpoint. The directory and public business detail share a safe
  projection containing active catalogs and services, plus a booking flag.
  Keep account details out of public responses.

## Personal calendar

- The owner agenda and Mis citas share AppointmentCalendar and AgendaDay.
  Personal queries use `mine=true&business=true` on appointment GET. The
  server scopes `mine` to the authenticated client even when an owner is
  signed in. Keep business blocks and owner controls in business mode.

## Notification inbox

- The bell leads to the notification inbox. Its count is the total returned
  by the API. Group notices by their creation date in Costa Rica time and
  use the existing notification access rules for clients and owners.

## Profile and navigation

- AppLayout uses AppIcon for every main navigation item. The profile picture
  is a user-supplied HTTP(S) URL, with initials as its preview fallback.
- Profile endpoints are scoped to the signed-in user. The collection POST
  updates the latest active profile or creates the first profile under a
  user row lock. An empty picture string restores initials.

## Owner and client workflow

- An account can own several businesses. Panel shows the onboarding form
  when it has none and a "Nuevo negocio" button otherwise, which reuses the
  same form with a cancel action. It adds the business from the POST
  response to the list before reloading, so Panel never shows another one.
  The form is in Spanish ("Crea tu negocio" / "Nuevo negocio"). Opening it
  focuses the name and scrolls to the top; cancelling returns focus to the
  button; creating focuses the Panel h1 (`#business-title`, tabIndex -1).
  Business POST caps the name at 100 and the description at 1000 characters
  (it is public in the directory); there is no per-account business cap yet.
- The same account can manage businesses and make personal bookings. Keep
  Panel scoped to the selected business and Mis citas scoped to the client
  identified by the session. The workflow audit is in flujo-dueno-y-cliente.txt.

- Mi perfil edits the signed-in user's name, surname and phone via
  `PUT /api/v1/user/[userId]`. Verify the target against the session user ID.
  Sign-in email and password need a separate verified change flow.

## Ownership checks

- Every write and private read scopes by the session: filter Prisma with
  `business: { ownerId: currentUser.id, state: true }` (or `ownedService`),
  never trust a `businessId`/`inventoryId` from the body. Check the target of
  a move too. Not-owned answers 404; acting on another account answers 403.
- User routes are self-only (no admin role yet): `GET /user` lists only the
  session user. Inventory and item GET default `state` to `false` when the
  query omits it, so pass `state=true` to list active rows.
- `GET /business` and `GET /catalog` (list and by ID) are owner-only
  (session required); public data comes from `/api/v1/directory`.
- Register returns the user without its hash and sets only the cookie.
  Emails are stored lowercased and trimmed: the CHECK `users_email_lowercase`
  enforces it, so `@unique` also blocks case-only duplicates and login and
  register look up the normalized email exactly. Never use
  `mode: "insensitive"` on email: Prisma turns it into ILIKE, where `%` and
  `_` act as wildcards and leak which emails exist.
- `prisma/sql/users-email-lowercase.sql` (`npm run db:constraints`) aborts
  on case-only duplicates, then lowercases existing rows and adds the CHECK.
  Prisma cannot declare it and `db push` keeps it, but
  `db push --force-reset` or recreating `users` drops it: run
  `db:constraints` again afterwards.
- Before running the CHECK on any database that already has users (the
  first production database included), in one release with no gap between
  steps 2 and 3 (any other order locks out users who type their email with
  capitals):
  1. In `psql` or the provider's console (`prisma db execute` prints no rows),
     run both queries and resolve every row by hand:
     `SELECT lower(btrim(email)), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;`
     `SELECT id, email FROM users WHERE email ~ '[^\x20-\x7E]' OR email <> btrim(email, E' \t\r\n');`
  2. Run `DATABASE_URL="<database url>" npm run db:constraints` with that URL
     passed for this one command only; check its host first and never edit
     `.env`.
  3. Deploy the code. The app host runs neither `db push` nor this SQL.
- Notifications are written by the server inside booking transactions; the
  notification API is read-only.
