<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

- **Next.js 16.3.3** (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **PostgreSQL** via Prisma ORM (hosted on Railway)
- **Auth**: JWT in httpOnly cookie (`token`), bcryptjs password hashing

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint (flat config)
npm run db:generate  # regenerate Prisma client (run after schema changes)
npm run db:push      # sync schema to database
npm run db:seed      # run seed (currently empty)
```

No test framework is configured.

## Database

- Schema: `prisma/schema.prisma` — models use `@@map` to snake_case table names (e.g., `User` → `users`)
- All models have a `state: boolean` field — always filter with `state: true` in queries (soft-delete pattern)
- After editing `schema.prisma`, run `npm run db:generate` then `npm run db:push`

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