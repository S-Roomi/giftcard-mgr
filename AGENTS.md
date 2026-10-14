# Gift Card Manager — agent guidance

This file applies to the entire repository. Follow the user's current request;
the conventions below describe the existing app and should guide related changes.

## Project and structure

This is a self-hosted gift card organizer and spending planner. All authenticated
users share the same categories and cards; there is no per-user card ownership.

- Stack: Next.js 15 App Router, React 19, strict TypeScript, Tailwind CSS 4,
  tRPC 11, TanStack Query 5, Prisma 6, and SQLite.
- Use npm and the existing lockfile. Check `package.json` and `.tool-versions`
  for the project's tooling configuration.
- `src/app/page.tsx`: authenticated homepage and server-side data prefetch.
- `src/app/_components/use-page.tsx`: category cards, sorting, spending plans,
  and homepage management controls.
- `src/app/_components/card-modal.tsx`: shared add/edit card dialog.
- `src/app/_components/category-form.tsx`: category creation and renaming.
- `src/server/api/routers/`: validated category and gift-card operations.
- `src/server/auth/`, `src/middleware.ts`, and `src/app/api/auth/`:
  authentication, sessions, origin checks, and login/logout.
- `src/trpc/`: query providers and client/server tRPC helpers.
- `prisma/schema.prisma`: data model; `src/server/db.ts`: shared Prisma client.
- `src/env.js`: environment validation; `src/styles/globals.css`: theme tokens.
- `tests/auth.integration.mjs`: integration tests using an isolated database.

## Development and verification

- `npm install` installs dependencies and generates the Prisma client.
- `npm run dev` starts development on port 3000.
- `npm run dev:lan` listens on all interfaces on port 6565.
- `npm run typecheck` checks TypeScript.
- `npm run test:auth` starts a test server on port 3107 with a temporary SQLite
  database and a separate `.next-auth-test` build directory.
- `npm run build` builds production; `npm run start` serves that build.
- `npm run db:push` synchronizes the configured database schema.
- `npm run auth:user -- username` creates an account or resets its password.
  There is no default account or public registration.

Run checks appropriate to the change. Use typechecking for TypeScript changes and
integration tests for authentication, API, and protected-route changes. For UI
changes, check mobile and desktop behavior when a browser is available, and state
when visual or interaction testing was not performed. Documentation-only changes
do not require an application build.

Next.js generates route types. If typechecking reports a removed route under a
`.next*` directory, regenerate types for that directory, for example
`NEXT_DIST_DIR=.next-auth-test npx next typegen`. Do not weaken TypeScript checks
to hide stale generated files.

## UI and behavior conventions

- Management belongs on the homepage: category creation in the header, a header
  add-card button, category action menus, and card edit/delete controls in the
  expanded card list. Keep empty categories visible so users can add cards.
- Mobile uses a minimal centered single column. At 768px use two columns; at
  1280px use three. Preserve shared component state when the viewport changes.
- Sorting is local to each category. Show its sort control only when
  **Show all cards** is expanded. The selected order drives both the displayed
  cards and spending-plan allocation.
- Persist sorting by stable category ID in browser localStorage
  (`giftcard-category-sort:<id>`). Default to soonest expiry. Handle unavailable
  storage gracefully and do not reset the selection when collapsing the list.
- Confirm card/category deletion; category deletion cascades to its cards.
- Reuse the existing dialog and forms. Preserve keyboard access, labels, focus
  handling, mobile scrolling, pending states, and visible mutation errors.
- Invalidate `category.getAll` after relevant mutations so balances and lists
  refresh. Preserve currency formatting and cent rounding in spending logic.

## Themes and environment

- Use semantic Tailwind utilities such as `bg-canvas`, `bg-surface`,
  `text-foreground`, `text-accent`, and `text-on-primary`. Do not introduce
  hard-coded palette colors into components.
- `APP_THEME` supports `default`, `rosepine`, `catppuccin` (Mocha), and
  `catppuccin-{mocha,frappe,macchiato,latte}`. Latte is a light theme; preserve
  readable foregrounds and light native controls. The server-rendered root
  `data-theme` selects CSS variables; preserve runtime selection for Docker.
- Add new themes to both the validation enum in `src/env.js` and the matching
  CSS variable block in `src/styles/globals.css`.
- `APP_URL` must match the browser's exact origin, including scheme and port.
  Redirects and mutation-origin checks depend on it. Restart after env changes.
- Update `.env.example` and documentation when adding configuration. Never print
  or commit private `.env` contents, credentials, card codes, PINs, or session tokens.

## Authentication and data safety

- Use `requirePageSession` for protected pages and `protectedProcedure` for
  business APIs. Keep server-side validation and mutation-origin checks intact.
- Preserve hashed session storage, password hashing, secure cookie behavior,
  session revocation, and persistent login throttling.
- Reuse the shared Prisma client and validate API inputs with Zod. Use
  `RouterOutputs` for client data types and the `~/` import alias.
- Do not hand-edit `generated/prisma`, `.next*`, or other generated outputs.
- Verify the target database before schema changes. Do not reset databases,
  remove Docker volumes, or use data-loss flags as routine troubleshooting.
  Back up existing data before a potentially destructive migration.
- The repository currently has no Prisma migration history; Docker startup uses
  `prisma db push --skip-generate`. Do not assume migration scripts alone
  initialize the schema.
- Compose currently points SQLite outside its mounted `/app/data` volume.
  Do not silently change that URL: moving an existing deployment requires
  locating, backing up, and migrating its database.

## Scope and handoff

Inspect the current files and git status before editing; preserve unrelated work.
Keep changes focused and follow nearby code style. Treat source code as the
authority when documentation or tests lag behind it: for example, older references
to `/manage` remain, but that page is currently absent.

Update relevant documentation for behavior changes. Report what changed, which
checks ran, and any unresolved failures without claiming unperformed verification.
